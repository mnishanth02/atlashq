import { describe, expect, it, vi } from "vitest";

const lookupMock = vi.fn();

vi.mock("node:dns", () => ({
  promises: {
    lookup: (...args: unknown[]) => lookupMock(...args),
  },
}));

const { assertPublicHttpUrl, CaptureUrlBlockedError } = await import("./ssrf-guard.js");

function mockResolves(addresses: string[]): void {
  lookupMock.mockResolvedValueOnce(
    addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
  );
}

describe("assertPublicHttpUrl", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(assertPublicHttpUrl("ftp://example.com/file")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects a malformed URL", async () => {
    await expect(assertPublicHttpUrl("not a url")).rejects.toBeInstanceOf(CaptureUrlBlockedError);
  });

  it("rejects embedded credentials", async () => {
    await expect(assertPublicHttpUrl("https://user:pass@example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("accepts a public IPv4 address", async () => {
    mockResolves(["93.184.216.34"]);
    const result = await assertPublicHttpUrl("https://example.com/");
    expect(result.resolvedAddresses).toEqual(["93.184.216.34"]);
    expect(result.selectedAddress).toBe("93.184.216.34");
    expect(result.selectedAddressFamily).toBe(4);
  });

  it("rejects loopback IPv4 (127.0.0.1)", async () => {
    mockResolves(["127.0.0.1"]);
    await expect(assertPublicHttpUrl("http://internal.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects RFC1918 private IPv4 (10.x, 172.16.x, 192.168.x)", async () => {
    mockResolves(["10.0.0.5"]);
    await expect(assertPublicHttpUrl("http://a.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );

    mockResolves(["172.16.5.5"]);
    await expect(assertPublicHttpUrl("http://b.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );

    mockResolves(["192.168.1.1"]);
    await expect(assertPublicHttpUrl("http://c.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects link-local IPv4 including cloud metadata (169.254.169.254)", async () => {
    mockResolves(["169.254.169.254"]);
    await expect(assertPublicHttpUrl("http://metadata.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects carrier-grade NAT IPv4 ranges", async () => {
    mockResolves(["100.64.10.5"]);
    await expect(assertPublicHttpUrl("http://cgnat.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects multicast/reserved IPv4 ranges", async () => {
    mockResolves(["224.0.0.1"]);
    await expect(assertPublicHttpUrl("http://mc.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects IPv6 loopback (::1)", async () => {
    mockResolves(["::1"]);
    await expect(assertPublicHttpUrl("http://v6.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects IPv6 link-local across the full fe80::/10 range (fe80..febf)", async () => {
    for (const prefix of ["fe80", "fe90", "fea0", "feb0", "febf"]) {
      mockResolves([`${prefix}::1`]);
      await expect(assertPublicHttpUrl("http://v6ll.example.com/")).rejects.toBeInstanceOf(
        CaptureUrlBlockedError,
      );
    }
  });

  it("rejects IPv6 unique-local (fc00::/7, includes fd00::)", async () => {
    mockResolves(["fd00::1"]);
    await expect(assertPublicHttpUrl("http://v6ula.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects NAT64 and documentation IPv6 ranges", async () => {
    mockResolves(["64:ff9b::c000:201"]);
    await expect(assertPublicHttpUrl("http://nat64.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );

    mockResolves(["2001:db8::1"]);
    await expect(assertPublicHttpUrl("http://docv6.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects IPv4-mapped IPv6 addresses that map to a private IPv4 range", async () => {
    mockResolves(["::ffff:10.0.0.5"]);
    await expect(assertPublicHttpUrl("http://v6mapped.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("rejects a hostname that fails to resolve", async () => {
    mockResolves([]);
    await expect(assertPublicHttpUrl("http://doesnotresolve.example.com/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("accepts a literal public IPv4 URL without a DNS lookup", async () => {
    const result = await assertPublicHttpUrl("https://93.184.216.34/");
    expect(result.resolvedAddresses).toEqual(["93.184.216.34"]);
    expect(result.selectedAddress).toBe("93.184.216.34");
  });

  it("rejects a literal loopback IPv4 URL without a DNS lookup", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1/")).rejects.toBeInstanceOf(
      CaptureUrlBlockedError,
    );
  });

  it("deduplicates resolver results while preserving the first validated pinned address", async () => {
    lookupMock.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);

    const result = await assertPublicHttpUrl("https://example.com/");

    expect(result.resolvedAddresses).toEqual([
      "93.184.216.34",
      "2606:2800:220:1:248:1893:25c8:1946",
    ]);
    expect(result.selectedAddress).toBe("93.184.216.34");
    expect(result.selectedAddressFamily).toBe(4);
  });
});
