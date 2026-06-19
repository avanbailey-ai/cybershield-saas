const MAIL_DOMAIN = 'mail.cybershieldcloud.com';
const ROOT_DOMAIN = 'cybershieldcloud.com';

export type ResendDnsRecord = {
  type: string;
  name: string;
  value: string;
  priority?: number;
  status?: string;
};

export type ResendMailDomainSetup = {
  domainId: string;
  domainName: string;
  status: string;
  records: ResendDnsRecord[];
  vercelDnsNames: Array<{ name: string; type: string; value: string; priority?: number }>;
  verifyResult: unknown;
};

function getResendKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || !key.startsWith('re_')) {
    throw new Error('RESEND_API_KEY missing or invalid in server environment');
  }
  return key;
}

async function resendApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getResendKey()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    throw new Error(`Resend ${path} ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function toVercelDnsName(recordName: string): string {
  if (recordName === ROOT_DOMAIN || recordName === '@') return '@';
  return recordName.replace(`.${ROOT_DOMAIN}`, '');
}

export async function setupResendMailDomain(): Promise<ResendMailDomainSetup> {
  const { data: domains } = await resendApi<{ data: Array<{ id: string; name: string; status: string }> }>(
    '/domains',
  );

  let domain = domains?.find((d) => d.name === MAIL_DOMAIN);
  if (!domain) {
    domain = await resendApi<{ id: string; name: string; status: string }>('/domains', {
      method: 'POST',
      body: JSON.stringify({ name: MAIL_DOMAIN }),
    });
  }

  const detail = await resendApi<{
    id: string;
    name: string;
    status: string;
    records?: ResendDnsRecord[];
  }>(`/domains/${domain.id}`);

  const records = detail.records ?? [];
  const vercelDnsNames = records.map((record) => ({
    name: toVercelDnsName(record.name),
    type: record.type,
    value: record.value,
    priority: record.priority,
  }));

  const verifyResult = await resendApi(`/domains/${domain.id}/verify`, { method: 'POST' });

  const refreshed = await resendApi<{ status: string; records?: ResendDnsRecord[] }>(
    `/domains/${domain.id}`,
  );

  return {
    domainId: domain.id,
    domainName: MAIL_DOMAIN,
    status: refreshed.status ?? detail.status,
    records: refreshed.records ?? records,
    vercelDnsNames,
    verifyResult,
  };
}
