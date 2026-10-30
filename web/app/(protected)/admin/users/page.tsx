import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersErrorBoundary } from "@/features/admin-users/users-error-boundary";
import { UsersLoading } from "@/features/admin-users/users-loading";
import { UsersList } from "@/features/admin-users/users-list";
import { listUsers } from "@/lib/api/identity-client";
import { redirectOnAuthError } from "@/lib/api/redirect-on-auth-error";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Usuários" };

async function Users() {
  const [{ items }, me] = await Promise.all([redirectOnAuthError(() => listUsers()), getCurrentUser()]);
  if (!me) return null; // o layout ja redirecionou
  return <UsersList users={items} currentUserId={me.id} />;
}

/** Gestao de usuarios (design 6): so ADMIN (o layout de `admin/` devolve not-found aos demais). */
export default function UsersPage() {
  return (
    <UsersErrorBoundary>
      <Suspense fallback={<UsersLoading />}>
        <Users />
      </Suspense>
    </UsersErrorBoundary>
  );
}
