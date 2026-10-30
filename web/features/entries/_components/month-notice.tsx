"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";

/** Mes invalido na URL: usa o mes atual e avisa uma vez (design 3.3). */
export function MonthNotice() {
  const toast = useToast();
  useEffect(() => {
    toast.push({ kind: "info", message: "Mês inválido na URL. Mostrando o mês atual." });
  }, [toast]);
  return null;
}
