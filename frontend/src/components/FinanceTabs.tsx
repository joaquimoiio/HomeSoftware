/**
 * Sub-navegação do módulo financeiro — abas Fluxo de caixa / Patrimônio.
 * Estética command center: rótulos em mono caixa-alta, sotaque âmbar só na aba
 * ativa (com um traço fino embaixo), divisória contínua separando do conteúdo.
 */
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/financeiro", label: "Fluxo de caixa", end: true },
  { to: "/financeiro/patrimonio", label: "Patrimônio", end: false },
  { to: "/financeiro/dividas", label: "Dívidas", end: false },
];

export function FinanceTabs() {
  return (
    <nav className="flex items-stretch gap-6 border-b border-line">
      {TABS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            "-mb-px border-b-2 pb-3 pt-1 font-mono text-[11px] uppercase tracking-widest " +
            "transition-colors " +
            (isActive
              ? "border-accent text-accent"
              : "border-transparent text-text-faint hover:text-text-dim")
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
