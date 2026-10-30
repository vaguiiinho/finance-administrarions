import { describe, expect, it } from "vitest";
import { signInHref } from "./sign-in-href";

describe("signInHref (RF37, CA43)", () => {
  it.each([
    ["/demo/entries", "/login?next=/entries"],
    ["/demo/dashboard", "/login?next=/dashboard"],
    ["/demo/cards/abc", "/login?next=/cards"],
    ["/demo", "/login"],
    ["/demo/outra", "/login"],
    ["/demo/entriesx", "/login"],
    ["/login", "/login"],
    [null, "/login"],
  ])("%s -> %s", (pathname, href) => {
    expect(signInHref(pathname)).toBe(href);
  });
});
