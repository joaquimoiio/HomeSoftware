/**
 * Financeiro — aba Fluxo de caixa (sprint 05).
 * Registra entradas/saídas (CRUD), mostra saldo/totais do período e duas visões
 * sóbrias: por categoria e por mês. Segue o design system: valores em mono,
 * sinais em --pos/--neg, sotaque âmbar só em ação/foco; gráficos sem exagero.
 * Patrimônio e dívidas (mesmas rotas) chegam nas sprints 06 e 07.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  ApiError,
  createLancamento,
  deleteLancamento,
  getResumo,
  getResumoPorCategoria,
  getResumoPorMes,
  listLancamentos,
  updateLancamento,
  type Lancamento,
  type LancamentoInput,
  type PontoCategoria,
  type PontoMes,
  type Resumo,
  type TipoLancamento,
} from "../lib/api";
import { Shell } from "../components/Shell";
import { PageHeader } from "../components/PageHeader";
import { FinanceTabs } from "../components/FinanceTabs";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { Value } from "../components/Value";

// --- formatação --------------------------------------------------------------
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function money(n: number): string {
  return brl.format(n);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Primeiro e último dia do mês corrente (default do filtro de período). */
function mesCorrente(): { inicio: string; fim: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD local
  return { inicio: fmt(new Date(y, m, 1)), fim: fmt(new Date(y, m + 1, 0)) };
}

function rotuloData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function rotuloMes(ym: string): string {
  const [y, m] = ym.split("-");
  const meses = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${meses[Number(m) - 1]}/${y.slice(2)}`;
}

// --- formulário de lançamento ------------------------------------------------
function LancamentoForm({
  editing,
  onSubmit,
  onCancel,
  busy,
}: {
  editing: Lancamento | null;
  onSubmit: (data: LancamentoInput) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>("saida");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [data, setData] = useState(isoToday());

  // Sincroniza o form quando entra/sai do modo edição.
  useEffect(() => {
    if (editing) {
      setTipo(editing.tipo);
      setValor(String(editing.valor).replace(".", ","));
      setDescricao(editing.descricao);
      setCategoria(editing.categoria);
      setData(editing.data);
    } else {
      setTipo("saida");
      setValor("");
      setDescricao("");
      setCategoria("");
      setData(isoToday());
    }
  }, [editing]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum <= 0) return;
    onSubmit({ tipo, valor: valorNum, descricao, categoria, data });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* seletor de tipo — sotaque só no ativo */}
      <div className="grid grid-cols-2 gap-2">
        {(["entrada", "saida"] as const).map((t) => {
          const active = tipo === t;
          const Icon = t === "entrada" ? ArrowUpRight : ArrowDownLeft;
          const tone =
            t === "entrada"
              ? active
                ? "border-pos text-pos"
                : "border-line text-text-dim hover:border-line-strong"
              : active
                ? "border-neg text-neg"
                : "border-line text-text-dim hover:border-line-strong";
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={
                "inline-flex items-center justify-center gap-2 border py-2.5 " +
                "text-sm capitalize transition-colors " +
                tone
              }
            >
              <Icon size={15} strokeWidth={2} />
              {t}
            </button>
          );
        })}
      </div>

      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
          valor (R$)
        </span>
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          required
          className="mt-2 w-full bg-transparent border-b border-line py-2
                     font-mono text-lg tabular-nums text-text outline-none
                     transition-colors placeholder:text-text-faint focus:border-accent"
        />
      </label>

      <Field
        id="lanc-descricao"
        label="descrição"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="ex.: salário, mercado…"
        maxLength={120}
        required
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="lanc-categoria"
          label="categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          placeholder="ex.: alimentação"
          maxLength={60}
          required
        />
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
            data
          </span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="mt-2 w-full bg-transparent border-b border-line py-2
                       font-mono tabular-nums text-text outline-none
                       transition-colors focus:border-accent [color-scheme:dark]"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={busy}>
          {editing ? <Check size={17} strokeWidth={2} /> : <Plus size={17} strokeWidth={2} />}
          {busy ? "Salvando…" : editing ? "Salvar" : "Adicionar"}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            <X size={16} strokeWidth={2} />
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

// --- gráficos (sóbrios, sem lib) ---------------------------------------------
function GraficoPorCategoria({ dados }: { dados: PontoCategoria[] }) {
  const max = Math.max(1, ...dados.map((d) => d.total));
  if (dados.length === 0)
    return <p className="text-sm text-text-faint">Sem saídas no período.</p>;
  return (
    <ul className="space-y-3">
      {dados.map((d) => (
        <li key={d.categoria}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-text-dim">{d.categoria}</span>
            <Value className="shrink-0 text-sm">{money(d.total)}</Value>
          </div>
          <div className="mt-1.5 h-1.5 w-full bg-bg-700">
            <div
              className="h-full bg-accent/70"
              style={{ width: `${(d.total / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function GraficoPorMes({ dados }: { dados: PontoMes[] }) {
  const max = Math.max(
    1,
    ...dados.map((d) => Math.max(d.entradas, d.saidas))
  );
  if (dados.length === 0)
    return <p className="text-sm text-text-faint">Sem dados no período.</p>;
  return (
    <div>
      <div className="flex h-40 items-end gap-4 overflow-x-auto pb-1">
        {dados.map((d) => (
          <div
            key={d.mes}
            className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-2"
          >
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                title={`entradas ${money(d.entradas)}`}
                className="w-2.5 bg-pos/80"
                style={{ height: `${(d.entradas / max) * 100}%` }}
              />
              <div
                title={`saídas ${money(d.saidas)}`}
                className="w-2.5 bg-neg/80"
                style={{ height: `${(d.saidas / max) * 100}%` }}
              />
            </div>
            <span className="font-mono text-[10px] tabular-nums text-text-faint">
              {rotuloMes(d.mes)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-line pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-dim">
          <span className="h-2 w-2 bg-pos/80" /> entradas
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-dim">
          <span className="h-2 w-2 bg-neg/80" /> saídas
        </span>
      </div>
    </div>
  );
}

// --- stat de resumo ----------------------------------------------------------
function Stat({
  label,
  valor,
  tone = "default",
  big,
}: {
  label: string;
  valor: number;
  tone?: "default" | "pos" | "neg" | "accent";
  big?: boolean;
}) {
  return (
    <div className="border border-line bg-bg-800/50 p-5">
      <p className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
        {label}
      </p>
      <Value
        tone={tone}
        className={"mt-2 block " + (big ? "text-3xl md:text-4xl" : "text-2xl")}
      >
        {money(valor)}
      </Value>
    </div>
  );
}

// --- página ------------------------------------------------------------------
export default function Financeiro() {
  const [periodo, setPeriodo] = useState(mesCorrente);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [resumo, setResumo] = useState<Resumo>({
    entradas: 0,
    saidas: 0,
    saldo: 0,
  });
  const [porMes, setPorMes] = useState<PontoMes[]>([]);
  const [porCategoria, setPorCategoria] = useState<PontoCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lancamento | null>(null);
  const [busy, setBusy] = useState(false);

  const filtro = useMemo(
    () => ({ inicio: periodo.inicio || undefined, fim: periodo.fim || undefined }),
    [periodo]
  );

  const refresh = useCallback(async () => {
    try {
      const [ls, r, pm, pc] = await Promise.all([
        listLancamentos(filtro),
        getResumo(filtro),
        getResumoPorMes(filtro),
        getResumoPorCategoria({ ...filtro, tipo: "saida" }),
      ]);
      setLancamentos(ls);
      setResumo(r);
      setPorMes(pm);
      setPorCategoria(pc);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return; // api.ts redireciona
      setError(e instanceof ApiError ? e.message : "Falha ao carregar o financeiro");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onSubmit(data: LancamentoInput) {
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateLancamento(editing.id, data);
      else await createLancamento(data);
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(l: Lancamento) {
    if (!window.confirm(`Excluir "${l.descricao}"? Não dá para desfazer.`)) return;
    setError(null);
    try {
      await deleteLancamento(l.id);
      if (editing?.id === l.id) setEditing(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível excluir");
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <PageHeader
          eyebrow="financeiro"
          title="Fluxo de caixa"
          meta={
            <span className="inline-flex items-center gap-2">
              <Wallet size={15} strokeWidth={1.75} className="text-accent" />
              {lancamentos.length.toString().padStart(2, "0")} lançamentos
            </span>
          }
        />

        <div className="mt-6">
          <FinanceTabs />
        </div>

        {/* filtro de período */}
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              de
            </span>
            <input
              type="date"
              value={periodo.inicio}
              onChange={(e) =>
                setPeriodo((p) => ({ ...p, inicio: e.target.value }))
              }
              className="mt-2 block bg-transparent border-b border-line py-1.5
                         font-mono tabular-nums text-sm text-text outline-none
                         transition-colors focus:border-accent [color-scheme:dark]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              até
            </span>
            <input
              type="date"
              value={periodo.fim}
              onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
              className="mt-2 block bg-transparent border-b border-line py-1.5
                         font-mono tabular-nums text-sm text-text outline-none
                         transition-colors focus:border-accent [color-scheme:dark]"
            />
          </label>
          <div className="flex gap-2 pb-0.5">
            <button
              type="button"
              onClick={() => setPeriodo(mesCorrente())}
              className="border border-line px-3 py-1.5 text-xs text-text-dim
                         transition-colors hover:border-accent hover:text-accent"
            >
              este mês
            </button>
            <button
              type="button"
              onClick={() => setPeriodo({ inicio: "", fim: "" })}
              className="border border-line px-3 py-1.5 text-xs text-text-dim
                         transition-colors hover:border-accent hover:text-accent"
            >
              tudo
            </button>
          </div>
        </div>

        {/* resumo do período — saldo em destaque */}
        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="entradas" valor={resumo.entradas} tone="pos" />
          <Stat label="saídas" valor={resumo.saidas} tone="neg" />
          <Stat
            label="saldo"
            valor={resumo.saldo}
            tone={resumo.saldo >= 0 ? "default" : "neg"}
            big
          />
        </section>

        {error && (
          <p className="mt-6 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        {/* corpo: formulário+lista à esquerda, gráficos à direita */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          {/* esquerda — registro + lista */}
          <div className="lg:col-span-3">
            <div className="border border-line bg-bg-800/40 p-5 md:p-6">
              <div className="mb-5 flex items-center gap-2 text-text-dim">
                <Plus size={15} strokeWidth={2} className="text-accent" />
                <span className="font-mono text-[11px] uppercase tracking-widest">
                  {editing ? "editar lançamento" : "novo lançamento"}
                </span>
              </div>
              <LancamentoForm
                editing={editing}
                onSubmit={onSubmit}
                onCancel={() => setEditing(null)}
                busy={busy}
              />
            </div>

            <ul className="mt-6 divide-y divide-line border-t border-line">
              {loading ? (
                <li className="py-10 font-mono text-xs uppercase tracking-widest text-text-faint">
                  carregando…
                </li>
              ) : lancamentos.length === 0 ? (
                <li className="py-12 text-center text-text-faint">
                  <Wallet size={26} className="mx-auto mb-3 opacity-50" />
                  Nenhum lançamento neste período.
                </li>
              ) : (
                lancamentos.map((l, i) => {
                  const entrada = l.tipo === "entrada";
                  return (
                    <motion.li
                      key={l.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.025, 0.25) }}
                      className="flex items-center justify-between gap-4 py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={
                            "grid h-8 w-8 shrink-0 place-items-center border " +
                            (entrada
                              ? "border-pos/40 text-pos"
                              : "border-neg/40 text-neg")
                          }
                        >
                          {entrada ? (
                            <ArrowUpRight size={15} strokeWidth={2} />
                          ) : (
                            <ArrowDownLeft size={15} strokeWidth={2} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-text">{l.descricao}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-xs text-text-faint">
                            <span className="truncate">{l.categoria}</span>
                            <span className="text-line-strong">·</span>
                            <Value tone="dim" className="text-xs">
                              {rotuloData(l.data)}
                            </Value>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Value
                          tone={entrada ? "pos" : "neg"}
                          className="text-sm md:text-base"
                        >
                          {entrada ? "+" : "−"}
                          {money(l.valor)}
                        </Value>
                        <button
                          title="editar"
                          aria-label="editar"
                          onClick={() => {
                            setEditing(l);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="ml-1 grid h-8 w-8 place-items-center border border-line
                                     text-text-dim transition-colors hover:border-accent hover:text-accent"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="excluir"
                          aria-label="excluir"
                          onClick={() => onDelete(l)}
                          className="grid h-8 w-8 place-items-center border border-line
                                     text-text-dim transition-colors hover:border-neg hover:text-neg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.li>
                  );
                })
              )}
            </ul>
          </div>

          {/* direita — visões */}
          <aside className="space-y-8 lg:col-span-2">
            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-text-dim">
                saídas por categoria
              </h2>
              <GraficoPorCategoria dados={porCategoria} />
            </section>
            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-text-dim">
                por mês
              </h2>
              <GraficoPorMes dados={porMes} />
            </section>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
