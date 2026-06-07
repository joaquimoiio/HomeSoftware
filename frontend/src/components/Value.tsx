/**
 * Valor numérico em mono (JetBrains Mono) — usar em TODO número: dinheiro,
 * datas, horários, contadores. Tom semântico opcional (entrada/saída).
 */
import type { HTMLAttributes } from "react";

type Tone = "default" | "pos" | "neg" | "accent" | "dim";

const TONES: Record<Tone, string> = {
  default: "text-text",
  pos: "text-pos",
  neg: "text-neg",
  accent: "text-accent",
  dim: "text-text-faint",
};

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

export function Value({ tone = "default", className = "", ...rest }: Props) {
  return (
    <span
      className={"font-mono tabular-nums " + TONES[tone] + " " + className}
      {...rest}
    />
  );
}
