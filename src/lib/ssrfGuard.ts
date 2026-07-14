import dns from 'dns';
import net from 'net';

/**
 * SSRF-bescherming voor uitgaande requests naar door de klant opgegeven URLs
 * (outbound webhooks + webhook-test). We staan alleen publieke https-hosts toe
 * en blokkeren privé/gereserveerde adresruimtes én de cloud-metadata-endpoints.
 *
 * Beperking: dit dekt geen volledige DNS-rebinding (de resolve vlak vóór de
 * fetch kan in theorie afwijken van de resolve tijdens de fetch). We zetten
 * daarom óók redirects uit en cappen de response, zodat de belangrijkste
 * vectoren (interne URL, redirect-naar-intern, exfiltratie) dicht zijn.
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
]);

export type SsrfCheckResult = { ok: true } | { ok: false; reason: string };

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // onbekend formaat → blokkeren
}

/**
 * Valideert dat een URL een publieke https-host is die niet naar een
 * privé/gereserveerd adres wijst. Resolvet DNS en controleert álle adressen.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<SsrfCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Ongeldige URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Alleen https:// is toegestaan' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return { ok: false, reason: 'Ongeldige host' };
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.internal') || host.endsWith('.local')) {
    return { ok: false, reason: 'Interne host is niet toegestaan' };
  }

  if (net.isIP(host)) {
    if (isBlockedIp(host)) return { ok: false, reason: 'Privé/gereserveerd IP is niet toegestaan' };
    return { ok: true };
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(host, { all: true });
  } catch {
    return { ok: false, reason: 'Host kon niet worden opgezocht' };
  }
  if (addresses.length === 0) return { ok: false, reason: 'Host heeft geen adres' };
  for (const addr of addresses) {
    if (isBlockedIp(addr.address)) {
      return { ok: false, reason: 'URL verwijst naar een privé/gereserveerd adres' };
    }
  }
  return { ok: true };
}
