/**
 * Hub — a "tela de ligar o painel". Entrada orquestrada: saudação com o nome do
 * usuário, data/relógio em mono e uma grade ASSIMÉTRICA dos três módulos
 * (Financeiro em destaque, Agenda e Seguidores ao lado). Admin e logout vivem no
 * Shell (topo), gated por is_admin — coesão em vez de duplicar ações aqui.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  LineChart,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Shell } from "../components/Shell";
import { Reveal, Stagger } from "../components/Reveal";
import { useAuth } from "../lib/auth";

type Module = {
  code: string;
  to: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
};

// Os três módulos do hub. As telas chegam nas próximas sprints; os links já
// apontam para as rotas definitivas.
const MODULES: Module[] = [
  {
    code: "01",
    to: "/financeiro",
    name: "Financeiro",
    blurb: "Fluxo de caixa, patrimônio e dívidas — o caixa do mês e o todo.",
    icon: Wallet,
  },
  {
    code: "02",
    to: "/agenda",
    name: "Agenda",
    blurb: "Calendário e compromissos, no estilo do seu dia.",
    icon: CalendarDays,
  },
  {
    code: "03",
    to: "/seguidores",
    name: "Seguidores",
    blurb: "Comparador de listas: quem entrou e quem saiu.",
    icon: LineChart,
  },
];

function greetingFor(hour: number): string {
  if (hour < 6) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

// Cartão de módulo. O destaque (Financeiro) ocupa mais espaço e mostra a blurb;
// os demais ficam mais compactos. Hover acende a borda e o sotaque âmbar.
function ModuleCard({ mod, featured }: { mod: Module; featured?: boolean }) {
  const Icon = mod.icon;
  return (
    <Link
      to={mod.to}
      className={
        "group relative flex flex-col justify-between overflow-hidden border border-line bg-bg-800/50 " +
        "transition-colors duration-200 hover:border-line-strong hover:bg-bg-800 " +
        "focus-visible:border-accent " +
        (featured ? "p-7 md:p-9" : "p-6")
      }
    >
      {/* brilho âmbar discreto no hover, vazando do canto */}
      <span className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-accent-soft opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-4">
        <span className="grid h-10 w-10 place-items-center border border-line bg-bg-900 text-text-dim transition-colors duration-200 group-hover:border-accent group-hover:text-accent">
          <Icon size={featured ? 22 : 20} strokeWidth={1.75} />
        </span>
        <span className="font-mono text-xs tracking-[0.3em] text-text-faint">
          {mod.code}
        </span>
      </div>

      <div className={featured ? "mt-10" : "mt-8"}>
        <div className="flex items-end justify-between gap-3">
          <h2
            className={
              "font-display leading-none " +
              (featured ? "text-4xl md:text-5xl" : "text-3xl")
            }
          >
            {mod.name}
          </h2>
          <ArrowUpRight
            size={featured ? 26 : 22}
            strokeWidth={1.75}
            className="shrink-0 -translate-y-0.5 text-text-faint transition-all duration-200 group-hover:-translate-y-1 group-hover:translate-x-0.5 group-hover:text-accent"
          />
        </div>
        <p
          className={
            "mt-3 text-text-dim " + (featured ? "max-w-sm text-base" : "text-sm")
          }
        >
          {mod.blurb}
        </p>
      </div>
    </Link>
  );
}

export default function Hub() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const greeting = greetingFor(now.getHours());
  const dateLabel = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const timeLabel = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const [featured, ...rest] = MODULES;

  return (
    <Shell>
      <Stagger className="px-5 py-12 md:px-10 md:py-16">
        {/* Cabeçalho assimétrico: saudação à esquerda, data/relógio em mono à
            direita, alinhados pela base. */}
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-b border-line pb-10">
          <div className="max-w-2xl">
            <Reveal>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
                painel de comando
              </p>
            </Reveal>
            <Reveal>
              <h1 className="mt-4 font-display text-5xl leading-[0.95] md:text-6xl">
                {greeting},
                <br className="hidden sm:block" />{" "}
                <span className="text-text">{user?.username}</span>
                <span className="text-accent">.</span>
              </h1>
            </Reveal>
          </div>

          <Reveal className="shrink-0">
            <div className="text-right">
              <p className="font-mono text-sm capitalize tracking-wide text-text-dim">
                {dateLabel}
              </p>
              <p className="mt-1 font-mono text-4xl tabular-nums leading-none text-text md:text-5xl">
                {timeLabel}
              </p>
            </div>
          </Reveal>
        </header>

        {/* Grade assimétrica: destaque alto à esquerda, dois compactos
            empilhados à direita. No mobile, vira uma coluna repensada. */}
        <section className="mt-10 grid grid-cols-1 gap-4 md:mt-12 md:grid-cols-5 md:grid-rows-2 md:gap-5">
          <Reveal className="md:col-span-3 md:row-span-2">
            <div className="h-full">
              <ModuleCard mod={featured} featured />
            </div>
          </Reveal>
          {rest.map((mod) => (
            <Reveal key={mod.to} className="md:col-span-2">
              <div className="h-full">
                <ModuleCard mod={mod} />
              </div>
            </Reveal>
          ))}
        </section>
      </Stagger>
    </Shell>
  );
}
