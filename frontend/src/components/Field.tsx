/**
 * Campo de formulário no estilo do design system (linha fina, foco em âmbar).
 * Rótulo em mono caixa-alta; sem cartões "flutuando", só divisória embaixo.
 */
import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, id, className = "", ...rest },
  ref
) {
  return (
    <label htmlFor={id} className="block">
      <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
        {label}
      </span>
      <input
        id={id}
        ref={ref}
        className={
          "mt-2 w-full bg-transparent border-b border-line py-2 text-text " +
          "outline-none transition-colors placeholder:text-text-faint " +
          "focus:border-accent " +
          className
        }
        {...rest}
      />
    </label>
  );
});
