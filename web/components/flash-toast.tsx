"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { takeFlash } from "@/lib/flash";
import { useOptionalToast } from "./ui/toast";

/** Mostra o aviso pendente (`lib/flash`) quando a rota muda: o layout persiste na navegacao, entao o toast sobrevive (design 4.4). */
export function FlashToast() {
  const pathname = usePathname();
  const toast = useOptionalToast();
  useEffect(() => {
    const message = takeFlash();
    if (message) toast?.push({ kind: "success", message });
  }, [pathname, toast]);
  return null;
}
