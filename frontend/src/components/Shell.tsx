/**
 * Shell da aplicação — moldura comum que o hub e os três módulos reutilizam.
 * Barra superior com marca, navegação coesa (NavLink com sotaque no ativo),
 * relógio em mono e ações de conta. Divisórias finas, nada "flutuando".
 * Mobile repensado: a navegação vira um painel que abre pelo menu, não some
 * nem fica espremida.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  CalendarDays,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Shield,
  Wallet,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";

// Navegação dos módulos. As rotas chegam nas próximas sprints; até lá caem no
// fallback do router (volta ao hub). Centralizado aqui para crescer sem dor.
const NAV = [
  { to: "/", label: "Hub", icon: LayoutDashboard, end: true },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, end: false },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, end: false },
  { to: "/seguidores", label: "Seguidores", icon: LineChart, end: false },
];

function navClass({ isActive }: { isActive: boolean }): string {
  return (
    "group inline-flex items-center gap-2 px-3 py-2 text-sm transition-colors " +
    (isActive
      ? "text-accent"
      : "text-text-dim hover:text-text")
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const clock = (
    <span className="font-mono text-sm tabular-nums text-text-faint">
      {now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg-900/85 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-5 md:px-10">
          {/* marca */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center bg-accent font-display text-base font-semibold text-bg-900">
              P
            </span>
            <span className="hidden font-display text-lg sm:block">
              Painel<span className="text-accent">.</span>
            </span>
          </Link>

          {/* navegação — desktop */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* conta — desktop */}
          <div className="hidden items-center gap-4 md:flex">
            {clock}
            <span className="h-4 w-px bg-line" />
            <span className="font-mono text-sm text-text-dim">
              {user?.username}
            </span>
            {user?.is_admin && (
              <Link
                to="/admin"
                title="Administração"
                aria-label="Administração"
                className="text-text-dim transition-colors hover:text-accent"
              >
                <Shield size={17} strokeWidth={1.75} />
              </Link>
            )}
            <button
              onClick={() => logout()}
              title="Sair"
              aria-label="Sair"
              className="text-text-dim transition-colors hover:text-accent"
            >
              <LogOut size={17} strokeWidth={1.75} />
            </button>
          </div>

          {/* menu — mobile */}
          <div className="flex items-center gap-3 md:hidden">
            {clock}
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              aria-expanded={open}
              className="text-text-dim transition-colors hover:text-accent"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* painel de navegação — mobile */}
        {open && (
          <nav className="border-t border-line px-3 py-3 md:hidden">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  "flex items-center gap-3 px-3 py-3 text-sm transition-colors " +
                  (isActive ? "text-accent" : "text-text-dim hover:text-text")
                }
              >
                <Icon size={18} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}

            <div className="mt-2 flex items-center justify-between border-t border-line px-3 pt-3">
              <span className="font-mono text-sm text-text-dim">
                {user?.username}
              </span>
              <div className="flex items-center gap-4">
                {user?.is_admin && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-accent"
                  >
                    <Shield size={16} strokeWidth={1.75} />
                    admin
                  </Link>
                )}
                <button
                  onClick={() => logout()}
                  className="inline-flex items-center gap-2 text-sm text-text-dim transition-colors hover:text-accent"
                >
                  <LogOut size={16} strokeWidth={1.75} />
                  sair
                </button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
