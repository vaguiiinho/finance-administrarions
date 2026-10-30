import Link from "next/link";
import { AppShell } from "@/components/app-shell";

/** Nao encontrado global (`/register`, CA07): shell de autenticacao (marca, tema e footer, sem menu nem conta). */
export default function NotFound() {
  return (
    <AppShell shell="auth" centered>
      <div className="card mx-auto flex w-full max-w-[420px] flex-col items-start gap-3 p-5 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-text">Página não encontrada</h1>
        <p className="text-muted">Erro 404. O endereço não existe.</p>
        <Link href="/" className="btn btn-primary">
          Ir para o início
        </Link>
      </div>
    </AppShell>
  );
}
