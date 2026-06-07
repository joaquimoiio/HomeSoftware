/**
 * Cartão editorial — divisória fina em vez de "flutuar" com sombra.
 * Superfície levemente elevada; hover discreto que acende a borda.
 */
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & { interactive?: boolean };

export function Card({ interactive = false, className = "", ...rest }: Props) {
  return (
    <div
      className={
        "border border-line bg-bg-800/50 " +
        (interactive
          ? "transition-colors hover:border-line-strong hover:bg-bg-800 "
          : "") +
        className
      }
      {...rest}
    />
  );
}
