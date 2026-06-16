/**
 * postProcessScan.ts — Centralized post-scan side-effects handler.
 *
 * Called by the queue worker (processQueue.ts) after every runScan() invocation.
 * Core DB writes complete synchronously; alerts, AI reports, and email run async.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { assessRisk } from '@/lib/riskEngine';
import { sendMonitoringAlert } from '@/lib/sendAlertEmail';
import { generateAndStoreReport, extractDomain } from '@/lib/ai/storeReport';
import { updateLeaderboard } from '@/lib/leaderboard/update';
import { triggerScanEmailFunnel } from '@/lib/email/funnel';
import { emitEvent } from '@/lib/brain/eventBus';
import type { ScanResult } from './runScan';
import { getActiveOrgId } from '@/lib/org/context';
import { buildRiskBreakdown } from './riskBreakdown';
import { getUserWithPlan } from '@/lib/billing/planService';
import { getEffectivePlan } from '@/lib/auth/permissions';
import {
  computeNextScanAt,
  resolveScanModeForWebsite,
} from '@/lib/jobs/scanFrequency';
import {
  buildSnapshotFromDbRow,
  buildSnapshotFromScanResult,
} from './pageSnapshot';
import {
  buildMonitoringChangeDetails,
  detectScanChanges,
  formatChangeAlert,
  groupChangesByMonitoringAlertType,
  maxChangeSeverity,
  shouldAlertOnChanges,
  type MonitoringAlertType,
} from './diffDetection';
import { finalizeScanQueueJob, type ScanQueueFinalizeResult } from './finalizeScan';

type PreviousScanRow = {
  id: string;
  risk_score: number | null;
  security_score: number | null;
  ssl_valid: boolean | null;
  headers: unknown;
  issues: unknown;
  scan_snapshot: unknown;
};

/** Non-blocking side effects — alerts, reports, growth. Must not block scan completion. */
export function postProcessScanSideEffects(params: {
  scanId: string;
  websiteId: string;
  userId: string;
  url: string;
  scanResult: ScanResult;
  orgId: string | null;
  previousScanRow: PreviousScanRow | null;
  previousRiskScore: number | null;
  previousSecurityScore: number | null;
  currentSnapshot: ReturnType<typeof buildSnapshotFromScanResult>;
  newRiskScore: number;
}): void {
  void (async () => {
    const {
      scanId,
      websiteId,
      userId,
      url,
      scanResult,
      orgId,
      previousScanRow,
      previousRiskScore,
      previousSecurityScore,
      currentSnapshot,
      newRiskScore,
    } = params;

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    if (!scanResult.ssl) {
      const { data: existingSSL } = await supabase
        .from('alerts')
        .select('id')
        .eq('scan_id', scanId)
        .eq('type', 'ssl_changed')
        .limit(1);

      if (!existingSSL || existingSSL.length === 0) {
        try {
          const { data: sslAlert } = await supabase.from('alerts').insert({
            user_id: userId,
            website_id: websiteId,
            scan_id: scanId,
            org_id: orgId,
            title: `No HTTPS detected on ${url}`,
            message:
              'This website does not use HTTPS. All traffic is unencrypted and users are at risk of data interception.',
            severity: 'critical',
            type: 'ssl_changed',
            is_read: false,
          }).select('id').single();

          if (sslAlert?.id) {
            try {
              const emailResult = await sendMonitoringAlert(sslAlert.id, {
                changeDetails: [
                  {
                    label: 'ssl status',
                    severity: 'critical',
                    summary: 'HTTPS/SSL is not detected on this website',
                    before: previousScanRow?.ssl_valid ? 'HTTPS enabled' : 'HTTPS not detected',
                    after: 'HTTPS not detected',
                  },
                ],
              });
              if (!emailResult.sent && !emailResult.skipped) {
                console.error(
                  `[POST-PROCESS] SSL alert email not sent for alert=${sslAlert.id} reason=${emailResult.reason ?? 'unknown'}`,
                );
              }
            } catch (err) {
              console.error('[POST-PROCESS] SSL alert email failed (non-fatal):', err);
            }
          }
        } catch (err) {
          console.error('[POST-PROCESS] SSL alert creation failed (non-fatal):', err);
        }
      }
    }

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
              const emailResult = await sendMonitoringAlert(alert.id, {
                currentScore: scanResult.score,
                previousScore: previousSecurityScore ?? undefined,
                changeDetails: [
                  {
                    label: 'security score',
                    severity,
                    summary: scanResult.explanation,
                    before:
                      previousSecurityScore !== null
                        ? `${previousSecurityScore}/100`
                        : 'No prior baseline',
                    after: `${scanResult.score}/100`,
                  },
                ],
              });
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

    if (
      previousSecurityScore !== null &&
      scanResult.score <= previousSecurityScore - 10
    ) {
      try {
        const { data: existingScoreDrop } = await supabase
          .from('alerts')
          .select('id')
          .eq('scan_id', scanId)
          .eq('type', 'security_score_drop')
          .limit(1);

        if (!existingScoreDrop || existingScoreDrop.length === 0) {
          const dropAmount = previousSecurityScore - scanResult.score;
          const severity: 'critical' | 'high' | 'medium' =
            dropAmount >= 25 ? 'critical' : dropAmount >= 15 ? 'high' : 'medium';

          const { data: scoreDropAlert } = await supabase.from('alerts').insert({
            user_id: userId,
            website_id: websiteId,
            scan_id: scanId,
            org_id: orgId,
            title: `Security score dropped on ${url}`,
            message: `Security score decreased from ${previousSecurityScore} to ${scanResult.score} (−${dropAmount} points).`,
            severity,
            type: 'security_score_drop',
            is_read: false,
          }).select('id').single();

          if (scoreDropAlert?.id) {
            try {
              const emailResult = await sendMonitoringAlert(scoreDropAlert.id, {
                previousScore: previousSecurityScore,
                currentScore: scanResult.score,
                changeDetails: [
                  {
                    label: 'security score',
                    severity,
                    summary: `Score dropped by ${dropAmount} points since the last scan`,
                    before: `${previousSecurityScore}/100`,
                    after: `${scanResult.score}/100`,
                  },
                ],
              });
              if (!emailResult.sent && !emailResult.skipped) {
                console.error(
                  `[POST-PROCESS] Score drop email not sent for alert=${scoreDropAlert.id} reason=${emailResult.reason ?? 'unknown'}`,
                );
              }
            } catch (err) {
              console.error('[POST-PROCESS] Score drop email failed (non-fatal):', err);
            }
          }
        }
      } catch (err) {
        console.error('[POST-PROCESS] Score drop alert creation failed (non-fatal):', err);
      }
    }

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

    if (!scanResult.error) {
      const previousSnapshot = previousScanRow
        ? buildSnapshotFromDbRow(previousScanRow)
        : null;
      const changeDiff = detectScanChanges(previousSnapshot, currentSnapshot, now);

      if (changeDiff.changes.length > 0) {
        try {
          await supabase.from('scan_changes').insert(
            changeDiff.changes.map((change) => ({
              scan_id: scanId,
              website_id: websiteId,
              type: change.type,
              severity: change.severity,
              description: change.description,
              detected_at: change.detectedAt,
            })),
          );
        } catch (err) {
          console.error('[POST-PROCESS] scan_changes persistence failed (non-fatal):', err);
        }

        if (shouldAlertOnChanges(changeDiff)) {
          const groupedChanges = groupChangesByMonitoringAlertType(changeDiff.changes);

          for (const [alertType, typeChanges] of groupedChanges) {
            const { data: existingChangeAlert } = await supabase
              .from('alerts')
              .select('id')
              .eq('scan_id', scanId)
              .eq('type', alertType)
              .limit(1);

            if (existingChangeAlert && existingChangeAlert.length > 0) continue;

            const { title, message } = formatChangeAlert(url, typeChanges);
            const alertSeverity = maxChangeSeverity(typeChanges);
            const changeDetails = buildMonitoringChangeDetails(
              previousSnapshot,
              currentSnapshot,
              typeChanges,
            );

            try {
              const { data: changeAlert } = await supabase.from('alerts').insert({
                user_id: userId,
                website_id: websiteId,
                scan_id: scanId,
                org_id: orgId,
                title,
                message,
                severity: alertSeverity,
                type: alertType as MonitoringAlertType,
                is_read: false,
              }).select('id').single();

              if (changeAlert?.id) {
                try {
                  const emailResult = await sendMonitoringAlert(changeAlert.id, { changeDetails });
                  if (!emailResult.sent && !emailResult.skipped) {
                    console.error(
                      `[POST-PROCESS] Change alert email not sent for alert=${changeAlert.id} type=${alertType} reason=${emailResult.reason ?? 'unknown'}`,
                    );
                  }
                } catch (err) {
                  console.error('[POST-PROCESS] Change alert email failed (non-fatal):', err);
                }
              }
            } catch (err) {
              console.error(
                `[POST-PROCESS] Website change alert creation failed for type=${alertType} (non-fatal):`,
                err,
              );
            }
          }
        }

        console.log(
          `[POST-PROCESS] Detected ${changeDiff.changes.length} website change(s) for scanId=${scanId}`,
        );
      }
    }

    const domain = extractDomain(url);
    const userWithPlan = await getUserWithPlan(userId, orgId);
    const plan = getEffectivePlan(userWithPlan);
    const previousForReport = previousScanRow
      ? {
          securityScore: previousScanRow.security_score ?? null,
          issues: (previousScanRow.issues as string[] | null) ?? null,
          snapshot: buildSnapshotFromDbRow(previousScanRow),
        }
      : null;

    void generateAndStoreReport({
      scanId,
      domain,
      userId,
      scanResult,
      websiteId,
      plan,
      previousScan: previousForReport,
    }).catch((err) =>
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

    console.log(`[POST-PROCESS] Side effects complete — scanId=${scanId}`);
  })().catch((err) =>
    console.error('[POST-PROCESS] Side effects failed (non-fatal):', err),
  );
}

async function postProcessScanCore(params: {
  scanId: string;
  websiteId: string;
  userId: string;
  scanResult: ScanResult;
  websiteRow: {
    org_id: string | null;
    scan_frequency?: string | null;
    is_active?: boolean | null;
  } | null;
  orgId: string | null;
  currentSnapshot: ReturnType<typeof buildSnapshotFromScanResult>;
}): Promise<void> {
  const { scanId, websiteId, userId, scanResult, websiteRow, orgId, currentSnapshot } = params;

  console.log(
    `[POST-PROCESS] ${new Date().toISOString()} — scanId=${scanId} websiteId=${websiteId} score=${scanResult.score} riskLevel=${scanResult.riskLevel}`,
  );

  const supabase = createAdminClient();
  const risk = assessRisk(scanResult);
  const riskBreakdown = buildRiskBreakdown(scanResult);
  const now = new Date().toISOString();
  const newRiskScore = 100 - scanResult.score;

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
    scan_snapshot: currentSnapshot,
  }).eq('id', scanId);

  if (scanUpdateErr) {
    console.error('[POST-PROCESS] Failed to update scan record:', scanUpdateErr);
    throw scanUpdateErr;
  }

  const websiteUpdate: {
    risk_score: number;
    last_scanned_at: string;
    next_scan_at?: string;
  } = {
    risk_score: newRiskScore,
    last_scanned_at: now,
  };

  if (!scanResult.error && websiteRow?.is_active) {
    const userWithPlan = await getUserWithPlan(userId, orgId);
    const plan = getEffectivePlan(userWithPlan);
    const mode = resolveScanModeForWebsite(plan, websiteRow.scan_frequency);
    if (mode) {
      websiteUpdate.next_scan_at = computeNextScanAt(plan, mode, new Date(now));
    }
  }

  await supabase.from('websites').update(websiteUpdate).eq('id', websiteId);

  console.log(`[POST-PROCESS] Scan record and website updated for scanId=${scanId}`);
}

export interface PostProcessScanResult {
  success: boolean;
  error?: string;
}

/** Persist scan results synchronously; side effects run async without blocking the worker. */
export async function postProcessScan(params: {
  scanId: string;
  websiteId: string;
  userId: string;
  url: string;
  scanResult: ScanResult;
  jobId?: string;
}): Promise<PostProcessScanResult> {
  const { scanId, websiteId, userId, url, scanResult, jobId } = params;

  console.log(
    `[POST-PROCESS] scan start scanId=${scanId} jobId=${jobId ?? 'none'} hasError=${!!scanResult.error}`,
  );

  const supabase = createAdminClient();
  const newRiskScore = 100 - scanResult.score;
  let queueStatus: 'completed' | 'failed' = scanResult.error ? 'failed' : 'completed';
  let queueResult: ScanQueueFinalizeResult = scanResult.error
    ? { scanId, error: scanResult.error }
    : { scanId, score: scanResult.score, riskLevel: scanResult.riskLevel };
  let outcome: PostProcessScanResult = { success: true };

  try {
    const { data: websiteRow } = await supabase
      .from('websites')
      .select('org_id, scan_frequency, is_active')
      .eq('id', websiteId)
      .single();
    const orgId = websiteRow?.org_id ?? (await getActiveOrgId(userId));

    const { data: prevScans } = await supabase
      .from('scans')
      .select('id, risk_score, security_score, ssl_valid, headers, issues, scan_snapshot')
      .eq('website_id', websiteId)
      .eq('status', 'completed')
      .neq('id', scanId)
      .order('completed_at', { ascending: false })
      .limit(1);

    const previousScanRow = prevScans?.[0] ?? null;
    const previousRiskScore: number | null = previousScanRow?.risk_score ?? null;
    const previousSecurityScore: number | null = previousScanRow?.security_score ?? null;
    const currentSnapshot = buildSnapshotFromScanResult({
      ssl: scanResult.ssl,
      rawHeaders: scanResult.rawHeaders,
      pageSnapshot: scanResult.pageSnapshot,
    });

    await postProcessScanCore({
      scanId,
      websiteId,
      userId,
      scanResult,
      websiteRow,
      orgId,
      currentSnapshot,
    });

    postProcessScanSideEffects({
      scanId,
      websiteId,
      userId,
      url,
      scanResult,
      orgId,
      previousScanRow,
      previousRiskScore,
      previousSecurityScore,
      currentSnapshot,
      newRiskScore,
    });

    console.log(`[POST-PROCESS] scan completion scanId=${scanId} status=${queueStatus}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    queueStatus = 'failed';
    queueResult = { scanId, error: errMsg };
    outcome = { success: false, error: errMsg };
    console.error(`[POST-PROCESS] scan failed scanId=${scanId}:`, err);

    const { error: scanFailErr } = await supabase
      .from('scans')
      .update({
        status: 'failed',
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      })
      .eq('id', scanId);

    if (scanFailErr) {
      console.error('[POST-PROCESS] Failed to mark scan record failed:', scanFailErr);
    }
  } finally {
    if (jobId) {
      const finalized = await finalizeScanQueueJob(
        jobId,
        queueStatus,
        queueResult,
        queueResult.error,
        { websiteId, scanId, durationMs: undefined },
      );
      if (!finalized) {
        outcome = { success: false, error: 'queue_finalize_failed' };
      }
    }
  }

  return outcome;
}
