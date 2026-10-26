"use client";

import { useRef, type KeyboardEvent } from "react";
import { NavLink } from "../navigation";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  href: string;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  activeId: T;
  label: string;
  /** Prefixo dos ids: `${prefix}-tab-${id}` e `${prefix}-panel-${id}` */
  idPrefix: string;
}

/**
 * Abas-link com ativacao MANUAL (D18): setas/Home/End movem o foco, Enter/Espaco ativam (navegacao com busca de dados).
 * Cada aba e um link real (URL); tabindex movel (so a ativa entra no Tab).
 */
export function Tabs<T extends string>({ items, activeId, label, idPrefix }: TabsProps<T>) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const last = items.length - 1;
    const target =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1) : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1) : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (target !== null) {
      event.preventDefault();
      refs.current[target]?.focus();
    } else if (event.key === " ") {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  return (
    <div role="tablist" aria-label={label} className="tablist">
      {items.map((item, index) => {
        const selected = item.id === activeId;
        return (
          <NavLink
            key={item.id}
            href={item.href}
            scope="panel"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            className="tab"
            ref={(node: HTMLAnchorElement | null) => {
              refs.current[index] = node;
            }}
            onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => onKeyDown(event, index)}
          >
            {item.label}
          </NavLink>
        );
      })}
    </div>
  );
}
