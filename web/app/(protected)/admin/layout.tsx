import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { decideAdminLayout } from "@/lib/auth/route-policy";

/** Gestao de usuarios so para administrador (RF10, CA15): `USER` ve o nao encontrado. A API devolve 403 de qualquer forma. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (decideAdminLayout(await getCurrentUser()).kind !== "allow") notFound();
  return children;
}
