/**
 * Financeiro — aba Dívidas (sprint 07).
 * Cada dívida tem parcelas (iguais ou diferentes). Mostra o progresso por dívida
 * (parcelas pagas vs. totais) com barra sóbria, marca parcela como paga uma a uma
 * e soma o total devido / a pagar no geral. Segue o design system: valores em
 * mono, sotaque âmbar só em ação/foco/progresso, divisórias finas em vez de
 * cartões flutuando.
 */
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { motion } from "motion/react";
import {
  Check,
  ChevronDown,
  CircleDollarSign,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  ApiError,
  createDivida,
  deleteDivida,
  getDivida,
  getResumoDividas,
  listDividas,
  updateDivida,
  updateParcela,
  type Divida,
  type DividaCreate,
  type DividaDetail,
  type Parcela,
  type ParcelaInput,
  type ResumoGeralDividas,
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

/** "YYYY-MM-DD" → "dd/mm/aa" (sem fuso — é uma data pura). */
function rotuloData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** Texto digitado em reais (pt-BR) → número; NaN se inválido. */
function parseValor(v: string): number {
  return Number(v.replace(/\./g, "").replace(",", "."));
}

// --- estilo de input compartilhado (mono, linha fina, foco âmbar) ------------
const inputMono =
  "w-full bg-transparent border-b border-line py-2 font-mono tabular-nums " +
  "text-text outline-none transition-colors placeholder:text-text-faint " +
  "focus:border-accent [color-scheme:dark]";

// --- formulário de nova dívida -----------------------------------------------
type LinhaParcela = { valor: string; vencimento: string };

function DividaForm({
  onSubmit,
  busy,
}: {
  onSubmit: (data: DividaCreate) => Promise<void>;
  busy: boolean;
}) {
  const [nome, setNome] = useState("");
  const [modo, setModo] = useState<"iguais" | "diferentes">("iguais");
  // modo iguais
  const [numParcelas, setNumParcelas] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [primeiroVenc, setPrimeiroVenc] = useState("");
  // modo diferentes
  const [linhas, setLinhas] = useState<LinhaParcela[]>([
    { valor: "", vencimento: "" },
  ]);
  const [erro, setErro] = useState<string | null>(null);

  function reset() {
    setNome("");
    setNumParcelas("");
    setValorParcela("");
    setPrimeiroVenc("");
    setLinhas([{ valor: "", vencimento: "" }]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const nomeT = nome.trim();
    if (!nomeT) return setErro("Informe um nome para a dívida.");

    if (modo === "iguais") {
      const n = Number(numParcelas);
      const v = parseValor(valorParcela);
      if (!Number.isInteger(n) || n < 1)
        return setErro("Quantidade de parcelas inválida.");
      if (!Number.isFinite(v) || v <= 0)
        return setErro("Valor da parcela inválido.");
      void enviar({
        nome: nomeT,
        modo: "iguais",
        num_parcelas: n,
        valor_parcela: v,
        primeiro_vencimento: primeiroVenc || null,
      });
    } else {
      const parcelas: ParcelaInput[] = [];
      for (const l of linhas) {
        const v = parseValor(l.valor);
        if (!Number.isFinite(v) || v <= 0)
          return setErro("Há parcela com valor inválido.");
        parcelas.push({ valor: v, vencimento: l.vencimento || null });
      }
      if (parcelas.length === 0)
        return setErro("Adicione ao menos uma parcela.");
      void enviar({ nome: nomeT, modo: "diferentes", parcelas });
    }
  }

  async function enviar(data: DividaCreate) {
    await onSubmit(data);
    reset();
  }

  const totalDiferentes = linhas.reduce((acc, l) => {
    const v = parseValor(l.valor);
    return acc + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field
        id="divida-nome"
        label="nome da dívida"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="ex.: Notebook, Cartão, Empréstimo…"
        maxLength={80}
        required
      />

      {/* modo de criação — sotaque só no ativo */}
      <div className="grid grid-cols-2 gap-2">
        {(["iguais", "diferentes"] as const).map((m) => {
          const active = modo === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={
                "border py-2.5 text-sm transition-colors " +
                (active
                  ? "border-accent text-accent"
                  : "border-line text-text-dim hover:border-line-strong")
              }
            >
              {m === "iguais" ? "parcelas iguais" : "valores diferentes"}
            </button>
          );
        })}
      </div>

      {modo === "iguais" ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                nº de parcelas
              </span>
              <input
                inputMode="numeric"
                value={numParcelas}
                onChange={(e) =>
                  setNumParcelas(e.target.value.replace(/\D/g, ""))
                }
                placeholder="12"
                required
                className={"mt-2 text-lg " + inputMono}
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                valor da parcela
              </span>
              <input
                inputMode="decimal"
                value={valorParcela}
                onChange={(e) => setValorParcela(e.target.value)}
                placeholder="0,00"
                required
                className={"mt-2 text-lg " + inputMono}
              />
            </label>
          </div>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              1º vencimento (opcional)
            </span>
            <input
              type="date"
              value={primeiroVenc}
              onChange={(e) => setPrimeiroVenc(e.target.value)}
              className={"mt-2 text-sm " + inputMono}
            />
            <span className="mt-1 block text-xs text-text-faint">
              Se informado, gera vencimentos mensais a partir desta data.
            </span>
          </label>
          {numParcelas && valorParcela && (
            <p className="text-sm text-text-dim">
              total:{" "}
              <Value tone="accent">
                {money(Number(numParcelas) * (parseValor(valorParcela) || 0))}
              </Value>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            {linhas.map((l, i) => (
              <li key={i} className="flex items-end gap-2">
                <span className="pb-2 font-mono text-[11px] tabular-nums text-text-faint">
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <label className="block flex-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
                    valor
                  </span>
                  <input
                    inputMode="decimal"
                    value={l.valor}
                    onChange={(e) =>
                      setLinhas((ls) =>
                        ls.map((x, j) =>
                          j === i ? { ...x, valor: e.target.value } : x
                        )
                      )
                    }
                    placeholder="0,00"
                    className={"mt-1 " + inputMono}
                  />
                </label>
                <label className="block flex-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
                    vencimento
                  </span>
                  <input
                    type="date"
                    value={l.vencimento}
                    onChange={(e) =>
                      setLinhas((ls) =>
                        ls.map((x, j) =>
                          j === i ? { ...x, vencimento: e.target.value } : x
                        )
                      )
                    }
                    className={"mt-1 text-sm " + inputMono}
                  />
                </label>
                <button
                  type="button"
                  title="remover parcela"
                  aria-label="remover parcela"
                  onClick={() =>
                    setLinhas((ls) =>
                      ls.length > 1 ? ls.filter((_, j) => j !== i) : ls
                    )
                  }
                  className="mb-1 grid h-8 w-8 shrink-0 place-items-center border
                             border-line text-text-dim transition-colors
                             hover:border-neg hover:text-neg disabled:opacity-30"
                  disabled={linhas.length <= 1}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setLinhas((ls) => [...ls, { valor: "", vencimento: "" }])
              }
              className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5
                         text-xs text-text-dim transition-colors hover:border-accent
                         hover:text-accent"
            >
              <Plus size={13} /> parcela
            </button>
            <p className="text-sm text-text-dim">
              total: <Value tone="accent">{money(totalDiferentes)}</Value>
            </p>
          </div>
        </div>
      )}

      {erro && (
        <p className="text-sm text-neg" role="alert">
          {erro}
        </p>
      )}

      <Button type="submit" disabled={busy}>
        <Plus size={17} strokeWidth={2} />
        {busy ? "Criando…" : "Criar dívida"}
      </Button>
    </form>
  );
}

// --- barra de progresso (parcelas pagas vs. totais) --------------------------
function Progresso({ pagas, total }: { pagas: number; total: number }) {
  const pct = total > 0 ? Math.round((pagas / total) * 100) : 0;
  const quitada = total > 0 && pagas === total;
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-text-faint">
        <span>
          {pagas}/{total} parcelas
        </span>
        <Value tone={quitada ? "pos" : "accent"}>{pct}%</Value>
      </div>
      <div className="mt-1.5 h-1.5 w-full bg-bg-700">
        <div
          className={"h-full transition-all " + (quitada ? "bg-pos" : "bg-accent/80")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- linha de parcela (dentro da dívida expandida) ---------------------------
function ParcelaRow({
  parcela,
  busy,
  onToggle,
}: {
  parcela: Parcela;
  busy: boolean;
  onToggle: (p: Parcela) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <button
        type="button"
        onClick={() => onToggle(parcela)}
        disabled={busy}
        title={parcela.paga ? "desmarcar como paga" : "marcar como paga"}
        aria-pressed={parcela.paga}
        className={
          "flex min-w-0 items-center gap-3 text-left transition-colors " +
          "disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        <span
          className={
            "grid h-6 w-6 shrink-0 place-items-center border transition-colors " +
            (parcela.paga
              ? "border-pos bg-pos/10 text-pos"
              : "border-line text-transparent hover:border-accent")
          }
        >
          <Check size={13} strokeWidth={2.5} />
        </span>
        <span className="min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
            parcela {parcela.numero.toString().padStart(2, "0")}
          </span>
          {parcela.vencimento && (
            <Value tone="dim" className="ml-2 text-xs">
              vence {rotuloData(parcela.vencimento)}
            </Value>
          )}
        </span>
      </button>
      <Value
        tone={parcela.paga ? "pos" : "default"}
        className={"shrink-0 text-sm " + (parcela.paga ? "line-through opacity-70" : "")}
      >
        {money(parcela.valor)}
      </Value>
    </li>
  );
}

// --- cartão de dívida --------------------------------------------------------
function DividaCard({
  divida,
  index,
  onChanged,
  onDelete,
}: {
  divida: Divida;
  index: number;
  onChanged: () => void;
  onDelete: (d: Divida) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<DividaDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingNome, setEditingNome] = useState(false);
  const [nome, setNome] = useState(divida.nome);

  const r = divida.resumo;

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && detail === null) {
      try {
        setDetail(await getDivida(divida.id));
      } catch {
        /* silencioso — mantém fechado/sem parcelas */
      }
    }
  }

  async function toggleParcela(p: Parcela) {
    setBusy(true);
    try {
      const atualizada = await updateParcela(divida.id, p.id, { paga: !p.paga });
      setDetail(atualizada);
      onChanged(); // atualiza resumo do cartão (header) e o geral
    } catch {
      /* erro tratado pelo refresh do pai na próxima ação */
    } finally {
      setBusy(false);
    }
  }

  async function salvarNome() {
    const novo = nome.trim();
    if (!novo || novo === divida.nome) {
      setEditingNome(false);
      setNome(divida.nome);
      return;
    }
    setBusy(true);
    try {
      const atualizada = await updateDivida(divida.id, novo);
      setDetail(atualizada);
      setEditingNome(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="border border-line bg-bg-800/40 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingNome ? (
            <div className="flex items-center gap-2">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarNome();
                  if (e.key === "Escape") {
                    setEditingNome(false);
                    setNome(divida.nome);
                  }
                }}
                className="min-w-0 flex-1 bg-transparent border-b border-line py-1
                           text-text outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={salvarNome}
                aria-label="salvar nome"
                className="grid h-7 w-7 place-items-center border border-line
                           text-text-dim hover:border-accent hover:text-accent"
              >
                <Check size={13} />
              </button>
            </div>
          ) : (
            <h3 className="truncate text-lg text-text">{divida.nome}</h3>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            title="renomear"
            aria-label="renomear"
            onClick={() => setEditingNome(true)}
            className="grid h-8 w-8 place-items-center border border-line
                       text-text-dim transition-colors hover:border-accent hover:text-accent"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            title="excluir dívida"
            aria-label="excluir dívida"
            onClick={() => onDelete(divida)}
            className="grid h-8 w-8 place-items-center border border-line
                       text-text-dim transition-colors hover:border-neg hover:text-neg"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <Progresso pagas={r.parcelas_pagas} total={r.parcelas_totais} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
            total
          </dt>
          <Value className="mt-1 block text-sm">{money(r.total)}</Value>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
            pago
          </dt>
          <Value tone="pos" className="mt-1 block text-sm">
            {money(r.pago)}
          </Value>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
            falta
          </dt>
          <Value tone={r.falta > 0 ? "accent" : "pos"} className="mt-1 block text-sm">
            {money(r.falta)}
          </Value>
        </div>
      </dl>

      <button
        type="button"
        onClick={toggleOpen}
        className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px]
                   uppercase tracking-widest text-text-dim transition-colors
                   hover:text-accent"
      >
        <ChevronDown
          size={14}
          className={"transition-transform " + (open ? "rotate-180" : "")}
        />
        {open ? "ocultar parcelas" : "ver parcelas"}
      </button>

      {open && (
        <div className="mt-2 border-t border-line">
          {detail === null ? (
            <p className="py-4 font-mono text-[11px] uppercase tracking-widest text-text-faint">
              carregando…
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {detail.parcelas.map((p) => (
                <ParcelaRow
                  key={p.id}
                  parcela={p}
                  busy={busy}
                  onToggle={toggleParcela}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.li>
  );
}

// --- stat de total geral -----------------------------------------------------
function Stat({
  label,
  valor,
  tone = "default",
  big,
}: {
  label: string;
  valor: number;
  tone?: "default" | "pos" | "accent";
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
export default function Dividas() {
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [geral, setGeral] = useState<ResumoGeralDividas>({
    total_devido: 0,
    total_pago: 0,
    total_a_pagar: 0,
    dividas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [ds, g] = await Promise.all([listDividas(), getResumoDividas()]);
      setDividas(ds);
      setGeral(g);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return; // api.ts redireciona
      setError(e instanceof ApiError ? e.message : "Falha ao carregar as dívidas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCreate(data: DividaCreate) {
    setBusy(true);
    setError(null);
    try {
      await createDivida(data);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível criar a dívida");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(d: Divida) {
    if (!window.confirm(`Excluir "${d.nome}" e todas as parcelas? Não dá para desfazer.`))
      return;
    setError(null);
    try {
      await deleteDivida(d.id);
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
          title="Dívidas"
          meta={
            <span className="inline-flex items-center gap-2">
              <CircleDollarSign size={15} strokeWidth={1.75} className="text-accent" />
              {geral.dividas.toString().padStart(2, "0")} dívidas
            </span>
          }
        />

        <div className="mt-6">
          <FinanceTabs />
        </div>

        {/* totais gerais — falta a pagar em destaque */}
        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="total devido" valor={geral.total_devido} />
          <Stat label="já pago" valor={geral.total_pago} tone="pos" />
          <Stat label="falta pagar" valor={geral.total_a_pagar} tone="accent" big />
        </section>

        {error && (
          <p className="mt-6 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        {/* corpo: formulário à esquerda, dívidas à direita */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-2">
            <div className="border border-line bg-bg-800/40 p-5 md:p-6">
              <div className="mb-5 flex items-center gap-2 text-text-dim">
                <Plus size={15} strokeWidth={2} className="text-accent" />
                <span className="font-mono text-[11px] uppercase tracking-widest">
                  nova dívida
                </span>
              </div>
              <DividaForm onSubmit={onCreate} busy={busy} />
            </div>
          </div>

          <div className="lg:col-span-3">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-text-dim">
              minhas dívidas
            </h2>
            {loading ? (
              <p className="py-10 font-mono text-xs uppercase tracking-widest text-text-faint">
                carregando…
              </p>
            ) : dividas.length === 0 ? (
              <div className="border border-line bg-bg-800/30 py-12 text-center text-text-faint">
                <CircleDollarSign size={26} className="mx-auto mb-3 opacity-50" />
                Nenhuma dívida cadastrada.
              </div>
            ) : (
              <ul className="space-y-4">
                {dividas.map((d, i) => (
                  <DividaCard
                    key={d.id}
                    divida={d}
                    index={i}
                    onChanged={refresh}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
