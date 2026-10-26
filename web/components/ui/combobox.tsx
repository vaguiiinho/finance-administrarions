"use client";

import { useEffect, useId, useMemo, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { FieldShell } from "./fields";

interface CategoryComboboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "role"> {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Sugestoes (categorias existentes, GET /api/categories) */
  options: readonly string[];
}

interface Option {
  key: string;
  label: string;
  value: string;
  /** "Usar "<texto>"" para categoria nova */
  create?: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Combobox ARIA 1.2 (input `role=combobox` + `listbox`): busca nas categorias existentes (sem diferenciar maiusculas, B1)
 * e a opcao `Usar "<texto>"` para categoria nova. Setas/Home/End navegam, Enter escolhe, Esc fecha so a lista.
 * A lista abre ao digitar, com as setas ou ao clicar (inclusive depois de Esc); focar sem interagir nao abre (F1).
 * O valor continua sendo texto livre: sem selecionar nada, o que foi digitado vale.
 */
export function CategoryCombobox({ label, required, error, help, value, onValueChange, options, onBlur, onFocus, onClick, onKeyDown: onKeyDownProp, ...input }: CategoryComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inert = Boolean(input.readOnly || input.disabled);

  const items = useMemo<Option[]>(() => {
    const query = norm(value);
    // opcoes que diferem so na caixa viram uma (a primeira vence): evita itens e chaves duplicados
    const seen = new Set<string>();
    const unique = options.filter((o) => !seen.has(norm(o)) && seen.add(norm(o)));
    const matches = unique.filter((o) => norm(o).includes(query)).map((o) => ({ key: `o-${norm(o)}`, label: o, value: o }));
    const exact = options.some((o) => norm(o) === query);
    const trimmed = value.trim();
    return trimmed && !exact ? [...matches, { key: "create", label: `Usar "${trimmed}"`, value: trimmed, create: true }] : matches;
  }, [options, value]);

  const choose = (option: Option) => {
    if (inert) return;
    onValueChange(option.value);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDownProp?.(event);
    if (inert || event.defaultPrevented) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        setActive((i) => (items.length === 0 ? -1 : (i + 1) % items.length));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) setOpen(true);
        setActive((i) => (items.length === 0 ? -1 : i <= 0 ? items.length - 1 : i - 1));
        break;
      case "Home":
      case "End":
        if (open && items.length > 0) {
          event.preventDefault();
          setActive(event.key === "Home" ? 0 : items.length - 1);
        }
        break;
      case "Enter":
        // lista aberta: escolhe a opcao ativa; sem opcao ativa nao faz nada (nao envia o formulario por engano)
        if (open && items.length > 0) {
          event.preventDefault();
          if (active >= 0 && items[active]) choose(items[active]);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setActive(-1);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const expanded = open && !inert && items.length > 0;

  // a opcao ativa sempre fica visivel na rolagem da lista
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, expanded, listId]);

  return (
    <FieldShell label={label} required={required} error={error} help={help}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            {...input}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            autoComplete="off"
            className="field"
            value={value}
            onChange={(e) => {
              if (inert) return;
              onValueChange(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            // F1: foco (Tab ou programatico, ex.: envio invalido) NAO abre a lista; so digitar, setas ou clique.
            onFocus={onFocus}
            onClick={(e) => {
              onClick?.(e);
              if (!inert) setOpen(true);
            }}
            onBlur={(e) => {
              setOpen(false);
              onBlur?.(e);
            }}
            onKeyDown={onKeyDown}
          />
          <ul
            id={listId}
            role="listbox"
            aria-label="Sugestões"
            hidden={!expanded}
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border-strong bg-surface py-1 shadow-lg"
          >
            {expanded
              ? items.map((option, index) => (
                  <li
                    key={option.key}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    // mousedown (nao click) para o input nao perder o foco antes da escolha
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(option);
                    }}
                    onMouseMove={() => setActive(index)}
                    className={`flex min-h-11 cursor-pointer items-center px-3 text-text ${index === active ? "bg-surface-active" : "hover:bg-surface-2"} ${option.create ? "border-t border-border font-medium" : ""}`}
                  >
                    {option.label}
                  </li>
                ))
              : null}
          </ul>
        </div>
      )}
    </FieldShell>
  );
}
