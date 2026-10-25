"use client";

import { useRef, type KeyboardEvent } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
  className?: string;
}

/** `radiogroup` com tabindex movel: setas movem e selecionam, como um grupo de radios nativo. */
export function SegmentedControl<T extends string>({ options, value, onChange, disabled = false, className = "", ...aria }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (!o.disabled ? i : -1)).filter((i) => i >= 0);

  const move = (from: number, step: 1 | -1) => {
    if (enabled.length === 0) return;
    const pos = enabled.indexOf(from);
    const next = enabled[(pos + step + enabled.length) % enabled.length];
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(index, -1);
    }
  };

  return (
    <div role="radiogroup" className={`segmented ${className}`.trim()} {...aria}>
      {options.map((option, index) => {
        const checked = option.value === value;
        const unavailable = disabled || option.disabled;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={unavailable || undefined}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              if (!unavailable) onChange(option.value);
            }}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
