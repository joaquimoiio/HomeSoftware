/**
 * Mini-gráfico de evolução — linha sóbria em SVG, sem eixos nem lib.
 * Usado no patrimônio para mostrar como o valor de um item mudou no tempo.
 * Um único ponto vira um traço plano; nada de cores aleatórias (só o sotaque).
 */
type Props = {
  valores: number[];
  width?: number;
  height?: number;
  className?: string;
};

export function Sparkline({
  valores,
  width = 220,
  height = 44,
  className = "",
}: Props) {
  if (valores.length === 0) return null;

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;
  const pad = 3;
  const innerH = height - pad * 2;
  const step = valores.length > 1 ? width / (valores.length - 1) : 0;

  const pts = valores.map((v, i) => {
    const x = valores.length > 1 ? i * step : width / 2;
    const y = pad + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={"w-full " + className}
      role="img"
      aria-label="evolução do valor"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r={2.5} fill="var(--accent)" />
    </svg>
  );
}
