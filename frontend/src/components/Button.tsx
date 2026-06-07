/**
 * Botão-base do design system. Três variantes:
 * - primary: bloco âmbar (ação principal; sotaque usado com parcimônia).
 * - ghost: contorno fino, vira âmbar no hover (ações secundárias).
 * - danger: contorno fino, vira vermelho no hover (ações destrutivas).
 * Sem cantos super arredondados nem sombra azulada padrão.
 */
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-bg-900 font-medium hover:opacity-90 disabled:opacity-50",
  ghost:
    "border border-line text-text-dim hover:text-accent hover:border-accent disabled:opacity-40",
  danger:
    "border border-line text-text-dim hover:text-neg hover:border-neg disabled:opacity-40",
};

const SIZES: Record<Size, string> = {
  md: "px-5 py-2.5",
  lg: "px-6 py-3",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={
        "inline-flex items-center justify-center gap-2 tracking-wide " +
        "transition-colors transition-opacity disabled:cursor-not-allowed " +
        SIZES[size] +
        " " +
        VARIANTS[variant] +
        " " +
        className
      }
      {...rest}
    />
  );
}
