"use client";

import { useEffect, useId, useRef, useState } from "react";
import { monthLabelPtBR, monthLongPtBR, shiftMonth } from "@/lib/dates/format";
import { Button, IconButton } from "./ui/button";

interface MonthPickerProps {
  /** Mes selecionado, "YYYY-MM" */
  month: string;
  /** Mes corrente em America/Sao_Paulo (calculado no servidor) */
  currentMonth: string;
  onSelect: (month: string) => void;
  /** `compact`: setas + "out/26" (faixa de abas); sem grade nem "Mes atual". */
  variant?: "full" | "compact";
}

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
  </svg>
);

/** Seletor de mes unico (sem intervalo, B6): setas anterior/proximo, grade de 12 meses com navegacao de ano e "Mes atual". */
export function MonthPicker({ month, currentMonth, onSelect, variant = "full" }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(month.slice(0, 4)));
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const gridId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const arrows = (
    <>
      <IconButton aria-label="Mês anterior" onClick={() => onSelect(shiftMonth(month, -1))}>
        <Chevron dir="left" />
      </IconButton>
      {variant === "compact" ? (
        <span className="min-w-[4.5rem] text-center font-medium text-text" aria-live="polite">
          {monthLabelPtBR(month)}
        </span>
      ) : (
        <Button
          ref={toggleRef}
          className="min-w-[11rem] font-display text-lg font-semibold"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={open ? gridId : undefined}
          onClick={() => {
            setYear(Number(month.slice(0, 4)));
            setOpen((v) => !v);
          }}
        >
          {monthLongPtBR(month)}
        </Button>
      )}
      <IconButton aria-label="Próximo mês" onClick={() => onSelect(shiftMonth(month, 1))}>
        <Chevron dir="right" />
      </IconButton>
    </>
  );

  return (
    <div
      ref={rootRef}
      className="relative flex flex-wrap items-center gap-1"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      {arrows}
      {variant === "full" && month !== currentMonth ? (
        <Button variant="tertiary" onClick={() => onSelect(currentMonth)}>
          Mês atual
        </Button>
      ) : null}
      {open ? (
        <div id={gridId} role="group" aria-label="Escolher mês" className="absolute left-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border-strong bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <IconButton aria-label="Ano anterior" onClick={() => setYear((y) => y - 1)}>
              <Chevron dir="left" />
            </IconButton>
            <span className="font-display font-semibold text-text">{year}</span>
            <IconButton aria-label="Próximo ano" onClick={() => setYear((y) => y + 1)}>
              <Chevron dir="right" />
            </IconButton>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_SHORT.map((label, index) => {
              const value = `${year}-${String(index + 1).padStart(2, "0")}`;
              const selected = value === month;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={monthLongPtBR(value)}
                  className={`relative min-h-11 rounded-lg border text-base font-medium ${selected ? "border-primary-border bg-primary-strong text-on-primary" : "border-transparent text-text hover:bg-surface-2 active:bg-surface-active"}`}
                  onClick={() => {
                    setOpen(false);
                    toggleRef.current?.focus();
                    if (value !== month) onSelect(value);
                  }}
                >
                  {label}
                  {value === currentMonth && !selected ? <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
