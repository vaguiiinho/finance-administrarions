import type { InputHTMLAttributes, Ref } from "react";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  indeterminate?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Caixa de 44x44 (a area de toque e o proprio input). Marcado/indeterminado usam --primary-strong + --primary-border. */
export function Checkbox({ indeterminate = false, className = "", ref, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={`checkbox ${className}`.trim()}
      ref={(node) => {
        if (node) node.indeterminate = indeterminate;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      {...props}
    />
  );
}
