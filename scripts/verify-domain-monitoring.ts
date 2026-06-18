/**
 * Verify domain monitoring helpers.
 * Run: npx tsx scripts/verify-domain-monitoring.ts
 */

import { extractRegistrableDomain, stripWww } from '../lib/domain/extractDomain';
import {
  domainHealthFromDays,
  crossedDomainExpiryThresholds,
  severityForDomainExpiryThreshold,
  domainExpirySummary,
} from '../lib/domain/domainStatus';
import { dnsRecordsEqual, formatDnsSummary } from '../lib/domain/probeDns';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(extractRegistrableDomain('https://www.example.com') === 'example.com', 'www strip');
assert(extractRegistrableDomain('https://app.example.com') === 'example.com', 'subdomain');
assert(stripWww('WWW.Example.COM') === 'example.com', 'strip www case');

assert(domainHealthFromDays(90) === 'healthy', '90 days healthy');
assert(domainHealthFromDays(45) === 'warning', '45 days warning');
assert(domainHealthFromDays(10) === 'critical', '10 days critical');
assert(domainHealthFromDays(0) === 'critical', 'expired critical');
assert(domainHealthFromDays(null) === 'unknown', 'null unknown');

assert(crossedDomainExpiryThresholds(55).join(',') === '60', '55 crosses 60 only');
assert(crossedDomainExpiryThresholds(7).join(',') === '7', '7 crosses most urgent 7 only');
assert(crossedDomainExpiryThresholds(-1).includes(0), 'expired includes 0');

assert(severityForDomainExpiryThreshold(0) === 'critical', '0 critical');
assert(severityForDomainExpiryThreshold(14) === 'high', '14 high');
assert(severityForDomainExpiryThreshold(60) === 'medium', '60 medium');

assert(domainExpirySummary(30, 'warning') === '30 days until domain expiry', '30 days summary');
assert(domainExpirySummary(null, 'unknown') === 'Not checked yet', 'unknown summary');

assert(
  dnsRecordsEqual({ a: ['1.2.3.4'], aaaa: [], cname: [] }, { a: ['1.2.3.4'], aaaa: [], cname: [] }),
  'dns equal',
);
assert(
  !dnsRecordsEqual({ a: ['1.2.3.4'], aaaa: [], cname: [] }, { a: ['5.6.7.8'], aaaa: [], cname: [] }),
  'dns not equal',
);
assert(formatDnsSummary({ a: ['1.2.3.4'], aaaa: [], cname: [] }).includes('A:'), 'format dns');

console.log('All domain monitoring checks passed.');
