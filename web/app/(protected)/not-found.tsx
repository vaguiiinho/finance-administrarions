import Link from "next/link";

/** Nao encontrado dentro do shell protegido (ex.: `/admin/users` para USER, CA15): menu lateral e navbar continuam. */
export default function ProtectedNotFound() {
  return (
    <div className="card mx-auto flex max-w-xl flex-col items-start gap-3 p-6">
      <h1 className="font-display text-2xl font-bold text-text">Página não encontrada</h1>
      <p className="text-muted">Erro 404. O endereço não existe ou você não tem acesso a ele.</p>
      <Link href="/entries" className="btn btn-primary">
        Ir para lançamentos
      </Link>
    </div>
  );
}
