/**
 * postProcessScan.ts — Centralized post-scan side-effects handler.
 *
 * Called by the queue worker (processQueue.ts) after every runScan() invocation.
 * Owns ALL of these responsibilities:
 *   - Persisting scan results to the scans table
 *   - Updating websites.last_scanned_at and risk_score
 *   - Creating security alerts (SSL, score, risk-increase)
 *   - Triggering the alert email (with 24h deduplication)
 *
 * No other file should replicate this logic.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { assessRisk } from '@/lib/riskEngine';
import { sendSecurityAlert } from '@/lib/sendAlertEmail';
import { generateAndStoreReport, extractDomain } from '@/lib/ai/storeReport';
import { updateLeaderboard } from '@/lib/leaderboard/update';
import { triggerScanEmailFunnel } from '@/lib/email/funnel';
import { emitEvent } from '@/lib/brain/eventBus';
import type { ScanResult } from './runScan';
import { getActiveOrgId } from '@/lib/org/context';
import { buildRiskBreakdown } from './riskBreakdown';

export async function postProcessScan(params: {
  scanId: string;
  websiteId: string;
  userId: string;
  url: string;
  scanResult: ScanResult;
}): Promise<void> {
  const { scanId, websiteId, userId, url, scanResult } = params;

  console.log(
    `[POST-PROCESS] ${new Date().toISOString()} — scanId=${scanId} websiteId=${websiteId} score=${scanResult.score} riskLevel=${scanResult.riskLevel}`,
  );

  const supabase = createAdminClient();
  const risk = assessRisk(scanResult);
  const riskBreakdown = buildRiskBreakdown(scanResult);
  const now = new Date().toISOString();
  const newRiskScore = 100 - scanResult.score;

  const { data: websiteRow } = await supabase
    .from('websites')
    .select('org_id')
    .eq('id', websiteId)
    .single();
  const orgId = websiteRow?.org_id ?? (await getActiveOrgId(userId));

  // Fetch the previous scan's risk score for risk-increase detection
  const { data: prevScans } = await supabase
    .from('scans')
    .select('risk_score')
    .eq('website_id', websiteId)
    .eq('status', 'completed')
    .neq('id', scanId)
    .order('completed_at', { ascending: false })
    .limit(1);

  const previousRiskScore: number | null = prevScans?.[0]?.risk_score ?? null;

  // 1. Persist scan results
  const { error: scanUpdateErr } = await supabase.from('scans').update({
    status: scanResult.error ? 'failed' : 'completed',
    completed_at: now,
    security_score: scanResult.score,
    risk_score: newRiskScore,
    risk_level: scanResult.riskLevel,
    ssl_valid: scanResult.ssl,
    headers: scanResult.headers,
    issues: scanResult.issues,
    passed: scanResult.passed,
    explanation: scanResult.explanation,
    findings: scanResult.issues,
    breakdown: riskBreakdown,
    recommendations: risk.recommendations,
    vulnerabilities_count: scanResult.issues.length,
    error_message: scanResult.error ?? null,
  }).eq('id', scanId);

  if (scanUpdateErr) {
    console.error('[POST-PROCESS] Failed to update scan record:', scanUpdateErr);
    throw scanUpdateErr; // Bubble up so worker marks job failed
  }

  // 2. Update website metadata
  await supabase.from('websites').update({
    risk_score: newRiskScore,
    last_scanned_at: now,
  }).eq('id', websiteId);

  console.log(`[POST-PROCESS] Scan record and website updated for scanId=${scanId}`);

  // 3a. SSL alert — existence check prevents duplicates on retry/recovery
  if (!scanResult.ssl) {
    const { data: existingSSL } = await supabase
      .from('alerts')
      .select('id')
      .eq('scan_id', scanId)
      .eq('type', 'ssl')
      .limit(1);

    if (!existingSSL || existingSSL.length === 0) {
      try {
        await supabase.from('alerts').insert({
          user_id: userId,
          website_id: websiteId,
          scan_id: scanId,
          org_id: orgId,
          title: `No HTTPS detected on ${url}`,
          message:
            'This website does not use HTTPS. All traffic is unencrypted and users are at risk of data interception.',
          severity: 'critical',
          type: 'ssl',
          is_read: false,
        });
      } catch (err) {
        console.error('[POST-PROCESS] SSL alert creation failed (non-fatal):', err);
      }
    }
  }

  // 3b. Security score alert + email (24h dedup handled inside sendSecurityAlert)
  if (scanResult.score < 60) {
    try {
      const { data: existingSecIssue } = await supabase
        .from('alerts')
        .select('id')
        .eq('scan_id', scanId)
        .eq('type', 'security_issue')
        .limit(1);

      if (!existingSecIssue || existingSecIssue.length === 0) {
        const severity: 'critical' | 'high' = scanResult.score < 40 ? 'critical' : 'high';
        const { data: alert } = await supabase.from('alerts').insert({
          user_id: userId,
          website_id: websiteId,
          scan_id: scanId,
          org_id: orgId,
          title: `Security issues detected on ${url}`,
          message: scanResult.explanation,
          severity,
          type: 'security_issue',
          is_read: false,
        }).select('id').single();

        if (alert?.id) {
          try {
            const emailResult = await sendSecurityAlert(alert.id);
            if (!emailResult.sent && !emailResult.skipped) {
              console.error(
                `[POST-PROCESS] Alert email not sent for alert=${alert.id} reason=${emailResult.reason ?? 'unknown'}`,
              );
            }
          } catch (err) {
            console.error('[POST-PROCESS] Alert email failed (non-fatal):', err);
          }
        }
      }
    } catch (err) {
      console.error('[POST-PROCESS] Security alert creation failed (non-fatal):', err);
    }
  }

  // 3c. Risk increase alert (only when there is a previous baseline to compare against)
  if (previousRiskScore !== null && newRiskScore > previousRiskScore + 10) {
    const { data: existingRiskIncrease } = await supabase
      .from('alerts')
      .select('id')
      .eq('scan_id', scanId)
      .eq('type', 'risk_increase')
      .limit(1);

    if (!existingRiskIncrease || existingRiskIncrease.length === 0) {
      try {
        await supabase.from('alerts').insert({
          user_id: userId,
          website_id: websiteId,
          scan_id: scanId,
          org_id: orgId,
          type: 'risk_increase',
          title: 'Risk Score Increased',
          message: `Risk on ${url} increased from ${previousRiskScore} to ${newRiskScore}`,
          severity: 'high',
          is_read: false,
          resolved: false,
        });
      } catch (err) {
        console.error('[POST-PROCESS] Risk increase alert creation failed (non-fatal):', err);
      }
    }

    console.log(
      `[POST-PROCESS] Risk increase detected for ${url}: ${previousRiskScore} → ${newRiskScore}`,
    );
  }

  // 4. Growth Engine V2 — fire-and-forget (never block critical path)
  const domain = extractDomain(url);

  void generateAndStoreReport({ scanId, domain, userId, scanResult }).catch((err) =>
    console.error('[POST-PROCESS] Report generation failed (non-fatal):', err),
  );

  void updateLeaderboard(domain, scanResult.score).catch((err) =>
    console.error('[POST-PROCESS] Leaderboard update failed (non-fatal):', err),
  );

  void emitEvent(
    'scan_completed',
    { domain, score: scanResult.score, websiteId, scanId },
    userId,
    null,
    'app',
  );

  void (async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (profile?.email) {
        await triggerScanEmailFunnel({
          userId,
          email: profile.email,
          domain,
          score: scanResult.score,
          reportSummary: scanResult.explanation,
        });
      }
    } catch (err) {
      console.error('[POST-PROCESS] Email funnel failed (non-fatal):', err);
    }
  })();

  console.log(`[POST-PROCESS] Complete — scanId=${scanId}`);
}
