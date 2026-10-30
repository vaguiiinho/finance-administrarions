import "server-only";
import { cache } from "react";
import { UnauthenticatedApiError } from "@/lib/api/http";
import { fetchMe } from "@/lib/api/identity-client";
import type { CurrentUserDto } from "@/lib/api/types";
import { readSessionToken } from "./session-cookie";

async function load(): Promise<CurrentUserDto | null> {
  if (!(await readSessionToken())) return null;
  try {
    return await fetchMe();
  } catch (error) {
    if (error instanceof UnauthenticatedApiError) return null;
    throw error;
  }
}

/** `GET /auth/me`; sem cookie ou 401 -> `null` (ADR 9.2). Cache do React so dentro da requisicao, nunca entre requisicoes. */
export const getCurrentUser = cache(load);
