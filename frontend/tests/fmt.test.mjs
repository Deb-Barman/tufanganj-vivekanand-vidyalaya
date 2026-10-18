// Dependency-free unit tests for the new admin formatters (Node 24+ supports .ts imports).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { fmtBytes, fmtDateTime, fmtMoney } from "../src/portal/ui/fmt.ts";

describe("fmtBytes", () => {
  for (const [value, expected] of [
    [null, "—"], [undefined, "—"], [0, "0 B"], [1023, "1023 B"],
    [1024, "1.00 KB"], [1536, "1.50 KB"], [10 * 1024, "10.0 KB"],
    [100 * 1024, "100 KB"], [1024 ** 2, "1.00 MB"],
    [1024 ** 3, "1.00 GB"], [1024 ** 4, "1.00 TB"], [1024 ** 5, "1024 TB"],
  ]) {
    it(`formats ${String(value)} as ${expected}`, () => {
      assert.equal(fmtBytes(value), expected);
    });
  }
});

describe("fmtMoney", () => {
  for (const [value, expected] of [
    [null, "₹0"], [undefined, "₹0"], ["", "₹0"], [0, "₹0"],
    ["1500.00", "₹1,500"], ["1234567", "₹12,34,567"], [12.5, "₹12.50"],
    ["12.345", "₹12.35"], [0.01, "₹0.01"], [-1250.5, "₹-1,250.50"],
    ["invalid", "₹0"], [NaN, "₹0"], [Infinity, "₹0"], [-Infinity, "₹0"],
  ]) {
    it(`formats ${String(value)} as ${expected}`, () => {
      assert.equal(fmtMoney(value), expected);
    });
  }
});

describe("fmtDateTime", () => {
  let previousTZ;
  before(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "UTC";
  });
  after(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  it("formats an upload timestamp in the viewer's timezone", () => {
    // Permit ordinary and nonbreaking spaces used by different ICU releases.
    assert.match(fmtDateTime("2026-10-18T16:00:00+05:30"), /^18\s+Oct\s+2026,?\s+10:30\s+am$/i);
  });

  it("converts the day when the timestamp crosses midnight in the viewer's timezone", () => {
    assert.match(fmtDateTime("2026-10-18T00:15:00+05:30"), /^17\s+Oct\s+2026,?\s+6:45\s+pm$/i);
  });
});
