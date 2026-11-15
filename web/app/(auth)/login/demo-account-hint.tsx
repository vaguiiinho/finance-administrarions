import type { DemoHint } from "@/lib/auth/demo-hint";

const CREDENTIAL = "rounded border border-border-strong bg-surface px-1 font-mono font-semibold whitespace-nowrap";

function Credential({ value }: { value: string }) {
  return (
    <strong>
      <code translate="no" className={CREDENTIAL}>
        {value}
      </code>
    </strong>
  );
}

/** Dica da conta demo (design 2.4): nota neutra e estatica, depois do formulario, sem nada focavel nem regiao viva. */
export function DemoAccountHint({ hint }: { hint: DemoHint }) {
  return (
    <div role="note" aria-label="Conta de demonstração" className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm">
      <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-muted text-xs font-semibold text-muted">
        i
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-text">
          Para testar, use o usuário <Credential value={hint.username} /> e a senha <Credential value={hint.password} />.
        </p>
        <p className="text-muted">Conta compartilhada: não registre dados pessoais. Ela é redefinida todos os dias às 03:00 (horário de Brasília).</p>
      </div>
    </div>
  );
}
