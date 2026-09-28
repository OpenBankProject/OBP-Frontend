import { describe, expect, it } from "vitest";
import { clientErrorShare, formatEstimate, penaliseHref } from "./trafficSources";

describe("formatEstimate", () => {
  it("shows an exact count plainly and an estimate with its bound", () => {
    expect(formatEstimate(12400, 0)).toBe((12400).toLocaleString());
    expect(formatEstimate(12400, 300)).toBe(`${(12400).toLocaleString()} ±300`);
  });
});

describe("clientErrorShare", () => {
  it("is the share of tracked responses that were 4xx, or null when none were tracked", () => {
    expect(clientErrorShare({ status_2xx: 1, status_4xx: 3, status_5xx: 0 })).toBe(0.75);
    expect(clientErrorShare({ status_2xx: 0, status_4xx: 0, status_5xx: 0 })).toBeNull();
  });
});

describe("penaliseHref", () => {
  it("opens the IP penalty form with the address filled in, IPv6 included", () => {
    const href = penaliseHref("2001:db8::1");
    expect(href.startsWith("/system/rate-limiting?")).toBe(true);
    expect(href.endsWith("#ip-penalties")).toBe(true);
    expect(new URL(`http://localhost${href}`).searchParams.get("penalise")).toBe("2001:db8::1");
  });
});
