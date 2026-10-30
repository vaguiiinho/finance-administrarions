import type { Metadata } from "next";
import { ProfileForm } from "@/features/account/profile-form";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Meu perfil" };

/** Meu perfil (design 5, RF09, RF43). */
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null; // o layout ja redirecionou
  return (
    <div className="flex max-w-[560px] flex-col gap-4 md:gap-6">
      <h1 className="font-display text-2xl font-bold text-text md:text-[32px]">Meu perfil</h1>
      <ProfileForm user={user} />
    </div>
  );
}
