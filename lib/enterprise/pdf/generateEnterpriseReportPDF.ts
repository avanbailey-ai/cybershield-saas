import 'server-only';

import PDFDocument from '@/lib/enterprise/pdf/createPdfDocument';
import type { EnterpriseReportData } from '../reportBuilder';
import { sanitizeReportText } from '../reportBuilder';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  primary: '#1e3a5f',
  accent: '#2563eb',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function postureColor(state: string | null): string {
  switch (state) {
    case 'CRITICAL':
      return COLORS.critical;
    case 'DEGRADED':
      return COLORS.high;
    case 'STABLE':
      return COLORS.medium;
    case 'HEALTHY':
      return COLORS.low;
    default:
      return COLORS.muted;
  }
}

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return COLORS.critical;
    case 'high':
      return COLORS.high;
    case 'medium':
      return COLORS.medium;
    default:
      return COLORS.low;
  }
}

function drawPageHeader(doc: PDFKit.PDFDocument, title: string, pageNum: number): void {
  doc
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text('CyberShield Security Posture Report', MARGIN, 30, { width: CONTENT_WIDTH / 2 })
    .text(`Page ${pageNum}`, MARGIN, 30, { width: CONTENT_WIDTH, align: 'right' });

  doc
    .moveTo(MARGIN, 48)
    .lineTo(PAGE_WIDTH - MARGIN, 48)
    .strokeColor(COLORS.border)
    .stroke();

  doc
    .fontSize(16)
    .fillColor(COLORS.primary)
    .text(title, MARGIN, 62, { width: CONTENT_WIDTH });

  doc.y = 95;
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  doc
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      'Confidential — Prepared by CyberShield. Aligned with SOC2-style control visibility. Not a certification.',
      MARGIN,
      PAGE_HEIGHT - 40,
      { width: CONTENT_WIDTH, align: 'center' },
    );
}

function drawWrappedText(
  doc: PDFKit.PDFDocument,
  text: string,
  options?: { fontSize?: number; color?: string; indent?: number },
): void {
  const fontSize = options?.fontSize ?? 10;
  const indent = options?.indent ?? 0;
  doc
    .fontSize(fontSize)
    .fillColor(options?.color ?? COLORS.text)
    .text(sanitizeReportText(text), MARGIN + indent, doc.y, {
      width: CONTENT_WIDTH - indent,
      lineGap: 4,
    });
  doc.moveDown(0.5);
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor(COLORS.primary).text(title, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
}

function drawRiskChart(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  const points = data.metrics.riskScoreTimeline;
  if (points.length === 0) {
    drawWrappedText(doc, 'Insufficient scan data for timeline chart in selected range.', {
      color: COLORS.muted,
    });
    return;
  }

  const chartTop = doc.y + 10;
  const chartHeight = 100;
  const chartLeft = MARGIN + 30;
  const chartWidth = CONTENT_WIDTH - 40;

  doc.rect(chartLeft, chartTop, chartWidth, chartHeight).strokeColor(COLORS.border).stroke();

  doc.fontSize(8).fillColor(COLORS.muted);
  doc.text('100', MARGIN, chartTop);
  doc.text('0', MARGIN, chartTop + chartHeight - 8);

  const maxPoints = Math.min(points.length, 14);
  const slice = points.slice(-maxPoints);
  const step = chartWidth / Math.max(slice.length - 1, 1);

  doc.strokeColor(COLORS.accent).lineWidth(1.5);
  slice.forEach((point, i) => {
    const x = chartLeft + i * step;
    const y = chartTop + chartHeight - (point.score / 100) * chartHeight;
    if (i === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  });
  doc.stroke();

  doc
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text(
      `Daily avg scores (${slice[0]?.date ?? ''} – ${slice[slice.length - 1]?.date ?? ''})`,
      chartLeft,
      chartTop + chartHeight + 8,
      { width: chartWidth },
    );

  doc.y = chartTop + chartHeight + 28;
}

function renderCoverPage(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  doc.rect(0, 0, PAGE_WIDTH, 180).fill(COLORS.primary);

  doc
    .fontSize(28)
    .fillColor('#ffffff')
    .text('Security Posture Report', MARGIN, 60, { width: CONTENT_WIDTH });

  doc
    .fontSize(14)
    .fillColor('#cbd5e1')
    .text(sanitizeReportText(data.cover.orgName), MARGIN, 110, { width: CONTENT_WIDTH });

  doc.fillColor(COLORS.text);
  doc.y = 220;

  doc.fontSize(11).fillColor(COLORS.muted).text('Primary Domain', MARGIN, doc.y);
  doc.fontSize(14).fillColor(COLORS.text).text(data.cover.primaryDomain, MARGIN, doc.y + 16);

  doc.y += 50;
  doc.fontSize(11).fillColor(COLORS.muted).text('Reporting Period', MARGIN, doc.y);
  doc
    .fontSize(13)
    .fillColor(COLORS.text)
    .text(
      `${formatDate(data.cover.dateRange.start)} — ${formatDate(data.cover.dateRange.end)}`,
      MARGIN,
      doc.y + 16,
    );

  doc.y += 50;
  doc.fontSize(11).fillColor(COLORS.muted).text('Generated', MARGIN, doc.y);
  doc
    .fontSize(13)
    .fillColor(COLORS.text)
    .text(formatDateTime(data.cover.generatedAt), MARGIN, doc.y + 16);

  doc.y += 60;
  const badgeColor = postureColor(data.cover.postureState);
  doc
    .roundedRect(MARGIN, doc.y, 180, 36, 4)
    .fill(badgeColor);
  doc
    .fontSize(13)
    .fillColor('#ffffff')
    .text(`Posture: ${data.cover.postureLabel.toUpperCase()}`, MARGIN + 12, doc.y + 11, {
      width: 160,
    });

  if (data.executive.rollingRiskScore !== null) {
    doc.y += 60;
    doc
      .fontSize(36)
      .fillColor(badgeColor)
      .text(`${data.executive.rollingRiskScore}`, MARGIN, doc.y, { continued: true })
      .fontSize(16)
      .fillColor(COLORS.muted)
      .text('/100 Rolling Risk Score');
  }

  drawFooter(doc);
}

function renderExecutivePage(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  drawPageHeader(doc, 'Executive Summary', 2);

  const narrative = data.executive.orgNarrative;
  drawSectionTitle(doc, 'Organization Risk Overview');
  drawWrappedText(doc, narrative.org_risk_overview);

  drawSectionTitle(doc, 'Trend Analysis');
  drawWrappedText(doc, narrative.trend_summary);
  doc
    .fontSize(10)
    .fillColor(COLORS.accent)
    .text(`Trend direction: ${narrative.trend_direction}`, MARGIN, doc.y);
  doc.moveDown(0.8);

  drawSectionTitle(doc, 'Posture Explanation');
  drawWrappedText(doc, narrative.posture_explanation);

  drawSectionTitle(doc, 'Active Threats');
  drawWrappedText(doc, narrative.active_threats_summary);

  drawSectionTitle(doc, 'Scope');
  drawWrappedText(
    doc,
    `${data.executive.totalScansAnalyzed} scans analyzed across ${data.executive.sitesMonitored} monitored sites. Rolling risk score: ${data.executive.rollingRiskScore ?? 'N/A'}/100.`,
  );

  if (data.latestScanNarrative) {
    drawSectionTitle(doc, 'Latest Scan Executive Summary');
    drawWrappedText(doc, data.latestScanNarrative.executive_summary);
  }

  drawFooter(doc);
}

function renderMetricsPage(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  drawPageHeader(doc, 'Risk Metrics Overview', 3);

  drawSectionTitle(doc, 'Rolling Risk Score Timeline');
  drawRiskChart(doc, data);

  drawSectionTitle(doc, 'Risk Distribution (Latest Scan per Site)');
  const dist = data.metrics.riskDistribution;
  const rows = [
    ['Critical (<50)', dist.critical, COLORS.critical],
    ['High (50–69)', dist.high, COLORS.high],
    ['Medium (70–89)', dist.medium, COLORS.medium],
    ['Low (90+)', dist.low, COLORS.low],
    ['Not scanned', dist.unknown, COLORS.muted],
  ] as const;

  let tableY = doc.y;
  for (const [label, count, color] of rows) {
    doc.fontSize(10).fillColor(COLORS.text).text(label, MARGIN, tableY, { width: 200 });
    doc
      .roundedRect(MARGIN + 220, tableY - 2, Math.max(count * 12, 4), 14, 2)
      .fill(color);
    doc.text(String(count), MARGIN + 420, tableY, { width: 60, align: 'right' });
    tableY += 22;
  }
  doc.y = tableY + 10;

  drawSectionTitle(doc, 'Vulnerability Summary');
  drawWrappedText(
    doc,
    `Total findings in period: ${data.metrics.totalVulnerabilities}. Active findings: ${data.metrics.activeFindings}. Resolved (removed vs prior scan): ${data.metrics.resolvedFindings}.`,
  );

  drawFooter(doc);
}

function renderTimelinePage(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  drawPageHeader(doc, 'Key Security Events', 4);

  const events = data.timeline.slice(0, 25);
  if (events.length === 0) {
    drawWrappedText(doc, 'No significant security events recorded in the selected period.', {
      color: COLORS.muted,
    });
  } else {
    for (const event of events) {
      if (doc.y > PAGE_HEIGHT - 100) break;

      doc
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(formatDateTime(event.date), MARGIN, doc.y, { width: 120 });
      doc
        .fontSize(9)
        .fillColor(severityColor(event.severity))
        .text(event.severity.toUpperCase(), MARGIN + 125, doc.y, { width: 60 });
      doc
        .fontSize(9)
        .fillColor(COLORS.accent)
        .text(event.eventType.replace(/_/g, ' '), MARGIN + 190, doc.y, { width: 120 });

      doc.y += 14;
      drawWrappedText(doc, event.description, { fontSize: 9, indent: 10 });
      doc.moveDown(0.2);
    }
  }

  drawFooter(doc);
}

function renderFindingsPage(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  drawPageHeader(doc, 'Detailed Findings', 5);

  const scans = data.scanDetails.slice(0, 8);
  if (scans.length === 0) {
    drawWrappedText(doc, 'No completed scans in the selected date range.', { color: COLORS.muted });
  }

  for (const scan of scans) {
    if (doc.y > PAGE_HEIGHT - 120) {
      doc.addPage();
      drawPageHeader(doc, 'Detailed Findings (continued)', 5);
    }

    const siteLabel = scan.label ?? scan.url;
    doc
      .fontSize(11)
      .fillColor(COLORS.primary)
      .text(sanitizeReportText(siteLabel), MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        `${scan.url} · Score: ${scan.securityScore ?? 'N/A'}/100 · ${scan.completedAt ? formatDateTime(scan.completedAt) : '—'}`,
        MARGIN,
        doc.y + 2,
      );
    doc.y += 28;

    const topFindings = scan.findings.slice(0, 5);
    if (topFindings.length === 0) {
      drawWrappedText(doc, 'No open findings.', { fontSize: 9, color: COLORS.muted });
    } else {
      for (const finding of topFindings) {
        doc
          .fontSize(9)
          .fillColor(severityColor(finding.severity))
          .text(`[${finding.severity.toUpperCase()}]`, MARGIN, doc.y, { continued: true })
          .fillColor(COLORS.text)
          .text(` ${finding.category}: ${finding.description}`, { width: CONTENT_WIDTH - 60 });
        doc.y += 14;
      }
    }

    const diffParts: string[] = [];
    if (scan.diff.added.length) diffParts.push(`${scan.diff.added.length} added`);
    if (scan.diff.removed.length) diffParts.push(`${scan.diff.removed.length} removed`);
    if (scan.diff.escalated.length) diffParts.push(`${scan.diff.escalated.length} escalated`);
    if (diffParts.length) {
      doc
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(`Diff: ${diffParts.join(', ')}`, MARGIN, doc.y);
      doc.y += 16;
    }

    doc.moveDown(0.5);
  }

  drawFooter(doc);
}

function renderAnomaliesPage(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  drawPageHeader(doc, 'Anomaly Report', 6);

  if (data.anomalies.length === 0) {
    drawWrappedText(doc, 'No intelligence anomalies recorded in the selected period.', {
      color: COLORS.muted,
    });
  } else {
    for (const anomaly of data.anomalies.slice(0, 20)) {
      if (doc.y > PAGE_HEIGHT - 90) break;

      doc
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(formatDateTime(anomaly.createdAt), MARGIN, doc.y, { width: 130 });
      doc
        .fontSize(9)
        .fillColor(severityColor(anomaly.severity))
        .text(anomaly.severity.toUpperCase(), MARGIN + 135, doc.y, { width: 60 });
      doc
        .fontSize(9)
        .fillColor(anomaly.resolved ? COLORS.low : COLORS.high)
        .text(anomaly.resolved ? 'Resolved' : 'Open', MARGIN + 200, doc.y, { width: 60 });

      doc.y += 14;
      doc
        .fontSize(9)
        .fillColor(COLORS.accent)
        .text(anomaly.type.replace(/_/g, ' '), MARGIN + 10, doc.y);
      doc.y += 12;
      drawWrappedText(doc, anomaly.message, { fontSize: 9, indent: 10 });
      doc.moveDown(0.3);
    }
  }

  drawFooter(doc);
}

function renderActionPlanPage(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  drawPageHeader(doc, 'Recommended Action Plan', 7);

  const groups: Array<{ label: string; priority: 'critical' | 'high' | 'hardening' }> = [
    { label: '1. Critical Fixes', priority: 'critical' },
    { label: '2. High-Risk Fixes', priority: 'high' },
    { label: '3. Hardening Improvements', priority: 'hardening' },
  ];

  for (const group of groups) {
    const items = data.actionPlan.filter((a) => a.priority === group.priority);
    drawSectionTitle(doc, group.label);

    if (items.length === 0) {
      drawWrappedText(doc, 'None identified in this period.', { color: COLORS.muted, fontSize: 9 });
    } else {
      items.forEach((item, i) => {
        drawWrappedText(doc, `${i + 1}. ${item.action}`, { fontSize: 10 });
      });
    }
  }

  drawFooter(doc);
}

function renderCompliancePage(doc: PDFKit.PDFDocument, data: EnterpriseReportData): void {
  drawPageHeader(doc, 'Compliance Summary', 8);

  drawSectionTitle(doc, 'Change Management Signals');
  for (const signal of data.compliance.changeManagementSignals) {
    drawWrappedText(doc, `• ${signal}`, { fontSize: 10 });
  }

  drawSectionTitle(doc, 'Monitoring Coverage');
  for (const item of data.compliance.monitoringCoverage) {
    drawWrappedText(doc, `• ${item}`, { fontSize: 10 });
  }

  drawSectionTitle(doc, 'Access & Security Posture Indicators');
  for (const item of data.compliance.accessPostureIndicators) {
    drawWrappedText(doc, `• ${item}`, { fontSize: 10 });
  }

  drawSectionTitle(doc, 'Audit Readiness Statement');
  drawWrappedText(doc, data.compliance.auditReadinessStatement, { fontSize: 10 });

  doc.moveDown(1);
  doc
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      'This document is aligned with SOC2-style control visibility for security monitoring and change detection. It does not represent SOC2 compliance, certification, or attestation.',
      MARGIN,
      doc.y,
      { width: CONTENT_WIDTH, lineGap: 3 },
    );

  drawFooter(doc);
}

export async function generateEnterpriseReportPDF(
  reportData: EnterpriseReportData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: MARGIN,
      autoFirstPage: false,
      info: {
        Title: `Security Posture Report — ${reportData.cover.orgName}`,
        Author: 'CyberShield',
        Subject: 'Enterprise Security Posture Report',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.addPage();
    renderCoverPage(doc, reportData);

    doc.addPage();
    renderExecutivePage(doc, reportData);

    doc.addPage();
    renderMetricsPage(doc, reportData);

    doc.addPage();
    renderTimelinePage(doc, reportData);

    doc.addPage();
    renderFindingsPage(doc, reportData);

    doc.addPage();
    renderAnomaliesPage(doc, reportData);

    doc.addPage();
    renderActionPlanPage(doc, reportData);

    doc.addPage();
    renderCompliancePage(doc, reportData);

    doc.end();
  });
}

export async function generateEnterpriseReportPDFForOrg(
  orgId: string,
  dateRange?: { start?: string; end?: string } | null,
): Promise<{ buffer: Buffer; filename: string }> {
  const {
    getCanonicalOrgSecurityState,
    validateCanonicalState,
  } = await import('../canonicalOrgSecurityState');
  const { buildEnterpriseReport } = await import('../reportBuilder');

  const canonical = await getCanonicalOrgSecurityState(orgId, { forceRefresh: true });
  await validateCanonicalState(orgId, canonical);

  const reportData = await buildEnterpriseReport(orgId, dateRange);
  const buffer = await generateEnterpriseReportPDF(reportData);
  const safeName = reportData.cover.orgName.replace(/[^a-z0-9.-]/gi, '_').slice(0, 60);
  const filename = `CyberShield-Security-Posture-${safeName}-${reportData.cover.dateRange.end.slice(0, 10)}.pdf`;
  return { buffer, filename };
}
