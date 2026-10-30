import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ readSessionToken: vi.fn() }));
vi.mock("./session-cookie", () => session);
const identity = vi.hoisted(() => ({ fetchMe: vi.fn() }));
vi.mock("@/lib/api/identity-client", () => identity);

import { ApiError, UnauthenticatedApiError } from "@/lib/api/http";
import { getCurrentUser } from "./current-user";

const ANA = { id: "u1", name: "Ana Souza", email: "ana@exemplo.com", role: "USER", mustChangePassword: false };

beforeEach(() => {
  session.readSessionToken.mockReset().mockResolvedValue("tok");
  identity.fetchMe.mockReset();
});

describe("getCurrentUser (ADR 9.2)", () => {
  it("devolve o CurrentUserDto com nivel e troca obrigatoria", async () => {
    identity.fetchMe.mockResolvedValue(ANA);
    expect(await getCurrentUser()).toEqual(ANA);
  });
  it("401 -> null", async () => {
    identity.fetchMe.mockRejectedValue(new UnauthenticatedApiError());
    expect(await getCurrentUser()).toBeNull();
  });
  it("sem cookie -> null, sem chamar a API", async () => {
    session.readSessionToken.mockResolvedValue(undefined);
    expect(await getCurrentUser()).toBeNull();
    expect(identity.fetchMe).not.toHaveBeenCalled();
  });
  it("outros erros (rede, 500) propagam: nao fingem 'deslogado'", async () => {
    identity.fetchMe.mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "x", null));
    await expect(getCurrentUser()).rejects.toMatchObject({ status: 500 });
  });
});
