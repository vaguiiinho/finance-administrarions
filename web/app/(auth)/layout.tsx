import { AppShell } from "@/components/app-shell";

/** Shell de autenticacao (design 2.6): marca e tema, sem menu lateral, botao de menu nem conta; footer sem link. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell shell="auth" centered>
      {children}
    </AppShell>
  );
}
