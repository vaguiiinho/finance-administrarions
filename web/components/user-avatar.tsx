import { userInitial } from "@/lib/auth/initial";

/**
 * Circulo com a inicial (design 2.3): `--primary-strong` + borda `--primary-border` + `--on-primary`; cor fixa por tema
 * (P05). Sempre `aria-hidden`: o nome acessivel e do botao que o contem. 44px (`md`) ou 48px (`lg`).
 */
export function UserAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const dimension = size === "lg" ? "size-12 text-[22px]" : "size-11 text-lg";
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full border border-primary-border bg-primary-strong font-display font-semibold leading-none text-on-primary ${dimension}`}>
      {userInitial(name)}
    </span>
  );
}
