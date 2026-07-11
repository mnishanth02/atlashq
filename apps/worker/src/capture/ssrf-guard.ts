import { promises as dns } from "node:dns";
import { isIP } from "node:net";

/**
 * Strict SSRF guard for the one-page reference capture feature (module-02 §6.8, §9). Used both to
 * validate the initially requested URL and to revalidate every redirect hop the capture adapter
 * observes, since an attacker-controlled server can return a same-origin-looking response that
 * then 30x-redirects (or DNS-rebinds) to an internal address after the first check passes.
 */

export class CaptureUrlBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureUrlBlockedError";
  }
}

export type PublicUrlValidationResult = {
  url: string;
  hostname: string;
  resolvedAddresses: string[];
  selectedAddress: string;
  selectedAddressFamily: 4 | 6;
};

export type HostnameResolutionRecord = {
  address: string;
  family: 4 | 6;
};

export type HostnameResolver = (hostname: string) => Promise<HostnameResolutionRecord[]>;

/**
 * Parses, DNS-resolves, and validates that `rawUrl` is a public HTTP/S address: rejects
 * non-http(s) protocols, embedded credentials, and every resolved address that falls in a
 * loopback/private/link-local/multicast/reserved/cloud-metadata range (IPv4 and IPv6). Throws
 * {@link CaptureUrlBlockedError} with a specific, non-leaky reason on any violation.
 */
export async function assertPublicHttpUrl(
  rawUrl: string,
  options: { resolver?: HostnameResolver } = {},
): Promise<PublicUrlValidationResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CaptureUrlBlockedError("Capture URL is not a valid absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CaptureUrlBlockedError("Capture URL must use http or https.");
  }

  if (url.username || url.password) {
    throw new CaptureUrlBlockedError("Capture URL must not embed credentials.");
  }

  if (!url.hostname) {
    throw new CaptureUrlBlockedError("Capture URL must include a hostname.");
  }

  const resolvedRecords = await resolveHostname(url.hostname, options.resolver);
  const resolvedAddresses = resolvedRecords.map((record) => record.address);

  if (resolvedAddresses.length === 0) {
    throw new CaptureUrlBlockedError(`Capture URL hostname "${url.hostname}" did not resolve.`);
  }

  for (const address of resolvedAddresses) {
    if (isBlockedAddress(address)) {
      throw new CaptureUrlBlockedError(
        `Capture URL resolves to a disallowed network address (${address}).`,
      );
    }
  }

  const selectedRecord = resolvedRecords[0];
  if (!selectedRecord) {
    throw new CaptureUrlBlockedError(`Capture URL hostname "${url.hostname}" did not resolve.`);
  }

  return {
    url: url.toString(),
    hostname: url.hostname,
    resolvedAddresses,
    selectedAddress: selectedRecord.address,
    selectedAddressFamily: selectedRecord.family,
  };
}

async function resolveHostname(
  hostname: string,
  resolver: HostnameResolver = defaultHostnameResolver,
): Promise<HostnameResolutionRecord[]> {
  if (isIP(hostname) !== 0) {
    return [{ address: hostname, family: isIP(hostname) as 4 | 6 }];
  }

  try {
    const records = await resolver(hostname);
    return deduplicateResolutionRecords(records);
  } catch {
    return [];
  }
}

async function defaultHostnameResolver(hostname: string): Promise<HostnameResolutionRecord[]> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.flatMap((record) => {
    const family =
      record.family === 4 || record.family === 6 ? record.family : isIP(record.address);
    if (family !== 4 && family !== 6) {
      return [];
    }
    return [{ address: record.address, family }];
  });
}

function deduplicateResolutionRecords(
  records: HostnameResolutionRecord[],
): HostnameResolutionRecord[] {
  const seenAddresses = new Set<string>();
  const deduplicated: HostnameResolutionRecord[] = [];

  for (const record of records) {
    const family =
      record.family === 4 || record.family === 6 ? record.family : isIP(record.address);
    if ((family !== 4 && family !== 6) || seenAddresses.has(record.address)) {
      continue;
    }
    seenAddresses.add(record.address);
    deduplicated.push({ address: record.address, family });
  }

  return deduplicated;
}

/** IPv4 CIDR ranges that must never be navigated to (RFC 1918/3927/5735/6598, cloud metadata, etc.). */
const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // RFC 1918 private
  ["100.64.0.0", 10], // carrier-grade NAT (RFC 6598)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (includes 169.254.169.254 cloud metadata)
  ["172.16.0.0", 12], // RFC 1918 private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // RFC 1918 private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
  ["255.255.255.255", 32], // broadcast
];

function isBlockedAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return isBlockedIpv4(address);
  }

  if (isIP(address) === 6) {
    return isBlockedIpv6(address);
  }

  // Unknown/unparseable address shape: fail closed.
  return true;
}

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToUint32(address);
  return BLOCKED_IPV4_RANGES.some(([network, prefix]) =>
    isInIpv4Range(value, ipv4ToUint32(network), prefix),
  );
}

function ipv4ToUint32(address: string): number {
  const octets = address.split(".").map(Number);
  return (
    ((octets[0] ?? 0) << 24) | ((octets[1] ?? 0) << 16) | ((octets[2] ?? 0) << 8) | (octets[3] ?? 0)
  );
}

function isInIpv4Range(value: number, network: number, prefix: number): boolean {
  if (prefix === 0) {
    return true;
  }
  const mask = prefix === 32 ? 0xffffffff : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) >>> 0 === (network & mask) >>> 0;
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) inherits the IPv4 blocklist.
  const mappedMatch = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(normalized);
  if (mappedMatch?.[1]) {
    return isBlockedIpv4(mappedMatch[1]);
  }

  if (normalized === "::1" || normalized === "::") {
    return true; // loopback / unspecified
  }

  const firstHextet = parseFirstHextet(normalized);

  if ((firstHextet & 0xffc0) === 0xfe80) {
    return true; // link-local (fe80::/10)
  }

  if ((firstHextet & 0xff00) === 0xff00) {
    return true; // multicast (ff00::/8)
  }

  if ((firstHextet & 0xfe00) === 0xfc00) {
    return true; // unique local address (fc00::/7, includes fd00:ec2::254 cloud metadata)
  }

  if (normalized.startsWith("64:ff9b::")) {
    return true; // NAT64 well-known prefix (can tunnel to IPv4-private space)
  }

  if (normalized.startsWith("2001:db8:")) {
    return true; // documentation range
  }

  return false;
}

/** Parses the first 16-bit group of a (possibly `::`-compressed) IPv6 address as a number. */
function parseFirstHextet(address: string): number {
  const firstGroup = address.split(":").find((group) => group.length > 0);
  const parsed = firstGroup ? Number.parseInt(firstGroup, 16) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
