import { describe, expect, it } from "vitest";
import { decideProtectedLayout } from "./route-policy";

describe("decideProtectedLayout: sessao que existia e nao vale mais (PA1, CA06)", () => {
  it("havia cookie e o /auth/me nao reconheceu o usuario -> login com reason=expired", () => {
    expect(decideProtectedLayout(null, "/cards?x=1", { hadSession: true })).toEqual({ kind: "redirect", to: "/login?next=%2Fcards%3Fx%3D1&reason=expired" });
  });
  it("sem cookie nao diz que a sessao expirou", () => {
    expect(decideProtectedLayout(null, "/cards", { hadSession: false })).toEqual({ kind: "redirect", to: "/login?next=%2Fcards" });
  });
});
