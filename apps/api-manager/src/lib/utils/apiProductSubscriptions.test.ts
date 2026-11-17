import { describe, it, expect } from "vitest";
import { allowedStatusActions, toObpDate, productIsSelfSubscribe } from "./apiProductSubscriptions";

function targets(status: string): string[] {
  return allowedStatusActions(status).map((statusAction) => `${statusAction.label}:${statusAction.targetStatus}`);
}

describe("allowedStatusActions", () => {
  it("lets a requested subscription be approved or cancelled", () => {
    expect(targets("requested")).toEqual(["Approve:active", "Cancel:cancelled"]);
  });

  it("lets an active or overdue subscription be suspended or cancelled", () => {
    expect(targets("active")).toEqual(["Suspend:suspended", "Cancel:cancelled"]);
    expect(targets("past_due")).toEqual(["Suspend:suspended", "Cancel:cancelled"]);
  });

  it("lets a suspended subscription be reinstated or cancelled", () => {
    expect(targets("suspended")).toEqual(["Reinstate:active", "Cancel:cancelled"]);
  });

  it("offers nothing for a cancelled subscription or an unknown status", () => {
    expect(targets("cancelled")).toEqual([]);
    expect(targets("something_else")).toEqual([]);
  });

  it("asks before suspending or cancelling, not before approving or reinstating", () => {
    const confirmed = ["requested", "active", "suspended"].flatMap((status) =>
      allowedStatusActions(status).filter((statusAction) => statusAction.confirm).map((statusAction) => statusAction.label),
    );
    expect(new Set(confirmed)).toEqual(new Set(["Suspend", "Cancel"]));
  });
});

describe("toObpDate", () => {
  it("turns a date input value into midnight UTC without milliseconds", () => {
    expect(toObpDate("2026-09-02")).toBe("2026-09-02T00:00:00Z");
  });

  it("returns undefined for an empty or invalid value", () => {
    expect(toObpDate("")).toBeUndefined();
    expect(toObpDate("not a date")).toBeUndefined();
  });
});

describe("productIsSelfSubscribe", () => {
  it("is true when the attribute is absent", () => {
    expect(productIsSelfSubscribe([])).toBe(true);
    expect(productIsSelfSubscribe(undefined)).toBe(true);
  });

  it("is false only when SELF_SUBSCRIBE is false", () => {
    expect(productIsSelfSubscribe([{ name: "SELF_SUBSCRIBE", value: "false" }])).toBe(false);
    expect(productIsSelfSubscribe([{ name: "SELF_SUBSCRIBE", value: "TRUE" }])).toBe(true);
  });

  it("ignores an inactive attribute", () => {
    expect(productIsSelfSubscribe([{ name: "SELF_SUBSCRIBE", value: "false", is_active: false }])).toBe(true);
  });
});
