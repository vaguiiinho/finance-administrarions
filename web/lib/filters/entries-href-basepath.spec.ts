import { describe, expect, it } from "vitest";
import { changeMonth, changeTab, entriesHref, parseEntriesSearchParams } from "./entries-search-params";

const state = parseEntriesSearchParams({ month: "2026-11", tab: "invoices" }, new Date("2026-10-24T13:00:00.000Z"));

describe("entriesHref com basePath (RF33, CA39, ADR 9.6)", () => {
  it("padrao e '' : /entries?... (comportamento atual preservado)", () => {
    expect(entriesHref(state)).toMatch(/^\/entries\?/);
    expect(entriesHref(state, "")).toBe(entriesHref(state));
  });
  it("na demo o mesmo estado vira /demo/entries?... com a MESMA query", () => {
    const protectedHref = entriesHref(changeMonth(changeTab(state, "income"), "2026-12"));
    const demoHref = entriesHref(changeMonth(changeTab(state, "income"), "2026-12"), "/demo");
    expect(demoHref).toBe(`/demo${protectedHref}`);
    expect(demoHref.startsWith("/demo/entries?")).toBe(true);
  });
});
