/**
 * Cabeçalho de página — composição assimétrica do command center:
 * sobrelinha em mono/âmbar, título display marcante e meta à direita.
 * Divisória fina embaixo. Reutilizado por hub e módulos para coesão.
 */
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-4xl leading-none md:text-5xl">
          {title}
        </h1>
      </div>
      {meta && (
        <div className="font-mono text-sm tabular-nums text-text-faint">
          {meta}
        </div>
      )}
    </header>
  );
}
