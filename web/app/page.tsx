import { redirect } from "next/navigation";
import { readSessionToken } from "@/lib/auth/session-cookie";

/** Fallback: a decisao de `/` acontece no `proxy.ts` (RF06); aqui so se o proxy nao rodou. */
export default async function Home() {
  redirect((await readSessionToken()) ? "/entries" : "/login");
}
