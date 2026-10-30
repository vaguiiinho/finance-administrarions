"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signInHref } from "@/lib/auth/sign-in-href";

/** "Entrar" da navbar (design 2.2, RF37, CA43): link com aparencia de botao secundario e `next` equivalente. */
export function SignInButton() {
  return (
    <Link href={signInHref(usePathname())} className="btn min-h-11 px-4">
      Entrar
    </Link>
  );
}
