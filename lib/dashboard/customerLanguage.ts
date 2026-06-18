/**
 * Customer-facing language transforms for dashboard, alerts, and reports.
 * Internal identifiers and DB values are unchanged — display layer only.
 */

const ALERT_TITLE_REPLACEMENTS: Array<[RegExp, string | ((match: string, ...groups: string[]) => string)]> = [
  [/Security issues detected/gi, 'Website Health Review Recommended'],
  [/(\d+)\s*findings?\s*detected/gi, (_, n) => `${n} Improvements Available`],
  [/Security scan completed/gi, 'Monitoring check completed'],
  [/Scan could not complete/gi, 'Monitoring check incomplete'],
  [/New finding/gi, 'New improvement opportunity'],
  [/Critical finding/gi, 'Priority protection gap'],
];

const ALERT_MESSAGE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/security issues/gi, 'website health items'],
  [/findings detected/gi, 'improvements available'],
  [/scan detected/gi, 'monitoring detected'],
  [/failed scan/gi, 'incomplete monitoring check'],
];

export function softenCustomerAlertTitle(title: string): string {
  let result = title;
  for (const [pattern, replacement] of ALERT_TITLE_REPLACEMENTS) {
    if (typeof replacement === 'string') {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

export function softenCustomerAlertMessage(message: string): string {
  let result = message;
  for (const [pattern, replacement] of ALERT_MESSAGE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Grouped alert titles for inbox display. */
export function businessLanguageGroupedAlertTitle(
  categoryLabel: string,
  count: number,
): string {
  return `${categoryLabel} — ${count} change${count === 1 ? '' : 's'} tracked`;
}
