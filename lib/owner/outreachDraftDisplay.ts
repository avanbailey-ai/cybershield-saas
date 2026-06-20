/** Parse Subject: line from stored draft content. */
export function parseOutreachDraftContent(content: string): {
  subject: string | null;
  body: string;
} {
  const match = content.match(/^Subject:\s*(.+?)(?:\r?\n|$)/i);
  if (!match) {
    return { subject: null, body: content.trim() };
  }
  return {
    subject: match[1].trim(),
    body: content.slice(match[0].length).trim(),
  };
}

/** Email preview body — never duplicate the subject line. */
export function outreachBodyForPreview(content: string): string {
  return parseOutreachDraftContent(content).body;
}
