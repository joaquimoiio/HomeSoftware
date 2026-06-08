/**
 * Sub-navegação do módulo agenda — abas Agenda (calendário) / Work Log.
 * Espelha o FinanceTabs: rótulos em mono caixa-alta, sotaque âmbar só na aba
 * ativa (com um traço fino embaixo), divisória contínua separando do conteúdo.
 */
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/agenda", label: "Agenda", end: true },
  { to: "/agenda/worklog", label: "Work Log", end: false },
];

export function AgendaTabs() {
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
