/**
 * Financeiro — aba Patrimônio (sprint 06).
 * Itens de reserva/investimento com valor atualizado manualmente. Mostra os
 * totais de guardado/investido/total e deixa explícita a diferença para o saldo
 * do fluxo de caixa. Segue o design system: valores em mono, sotaque âmbar só em
 * ação/foco, distinção reserva × investimento por ícone + tag (sem abusar de cor).
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
  Info,
  LineChart,
  Pencil,
  PiggyBank,
  Plus,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";
import {
  ApiError,
  createItemPatrimonio,
  deleteItemPatrimonio,
  getHistoricoPatrimonio,
  getResumoPatrimonio,
  listPatrimonio,
  updateItemPatrimonio,
  type ItemPatrimonio,
  type ItemPatrimonioInput,
  type PontoHistorico,
  type ResumoPatrimonio,
  type TipoItem,
} from "../lib/api";
import { Shell } from "../components/Shell";
import { PageHeader } from "../components/PageHeader";
import { FinanceTabs } from "../components/FinanceTabs";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { Value } from "../components/Value";
import { Sparkline } from "../components/Sparkline";

// --- formatação --------------------------------------------------------------
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function money(n: number): string {
  return brl.format(n);
}

/** ISO datetime (UTC) → "dd/mm/aa" local. */
function rotuloDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const TIPO_LABEL: Record<TipoItem, string> = {
  reserva: "reserva",
  investimento: "investimento",
};

// --- formulário de item ------------------------------------------------------
function ItemForm({
  editing,
  onSubmit,
  onCancel,
  busy,
}: {
  editing: ItemPatrimonio | null;
  onSubmit: (data: ItemPatrimonioInput) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<TipoItem>("reserva");

  useEffect(() => {
    if (editing) {
      setNome(editing.nome);
      setValor(String(editing.valor).replace(".", ","));
      setTipo(editing.tipo);
    } else {
      setNome("");
      setValor("");
      setTipo("reserva");
    }
  }, [editing]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum < 0) return;
    onSubmit({ nome, valor: valorNum, tipo });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* seletor de tipo — sotaque só no ativo */}
      <div className="grid grid-cols-2 gap-2">
        {(["reserva", "investimento"] as const).map((t) => {
          const active = tipo === t;
          const Icon = t === "reserva" ? PiggyBank : TrendingUp;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={
                "inline-flex items-center justify-center gap-2 border py-2.5 " +
                "text-sm capitalize transition-colors " +
                (active
                  ? "border-accent text-accent"
                  : "border-line text-text-dim hover:border-line-strong")
              }
            >
              <Icon size={15} strokeWidth={2} />
              {t}
            </button>
          );
        })}
      </div>

      <Field
        id="item-nome"
        label="nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="ex.: Reserva de emergência, Tesouro Direto…"
        maxLength={80}
        required
      />

      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
          valor atual (R$)
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

// --- stat de total -----------------------------------------------------------
function Stat({
  label,
  valor,
  tone = "default",
  big,
}: {
  label: string;
  valor: number;
  tone?: "default" | "accent";
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

// --- linha de item (com evolução sob demanda) --------------------------------
function ItemRow({
  item,
  index,
  onEdit,
  onDelete,
}: {
  item: ItemPatrimonio;
  index: number;
  onEdit: (i: ItemPatrimonio) => void;
  onDelete: (i: ItemPatrimonio) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hist, setHist] = useState<PontoHistorico[] | null>(null);
  const reserva = item.tipo === "reserva";
  const Icon = reserva ? PiggyBank : TrendingUp;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && hist === null) {
      try {
        setHist(await getHistoricoPatrimonio(item.id));
      } catch {
        setHist([]);
      }
    }
  }

  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.25) }}
      className="py-3.5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center border border-line text-text-dim">
            <Icon size={15} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-text">{item.nome}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-text-faint">
              <span className="font-mono uppercase tracking-widest">
                {TIPO_LABEL[item.tipo]}
              </span>
              <span className="text-line-strong">·</span>
              <Value tone="dim" className="text-xs">
                atualizado {rotuloDataHora(item.atualizado_em)}
              </Value>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Value className="text-sm md:text-base">{money(item.valor)}</Value>
          <button
            title="ver evolução"
            aria-label="ver evolução"
            onClick={toggle}
            className={
              "ml-1 grid h-8 w-8 place-items-center border transition-colors " +
              (open
                ? "border-accent text-accent"
                : "border-line text-text-dim hover:border-accent hover:text-accent")
            }
          >
            <LineChart size={14} />
          </button>
          <button
            title="editar"
            aria-label="editar"
            onClick={() => {
              onEdit(item);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="grid h-8 w-8 place-items-center border border-line
                       text-text-dim transition-colors hover:border-accent hover:text-accent"
          >
            <Pencil size={14} />
          </button>
          <button
            title="excluir"
            aria-label="excluir"
            onClick={() => onDelete(item)}
            className="grid h-8 w-8 place-items-center border border-line
                       text-text-dim transition-colors hover:border-neg hover:text-neg"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border border-line bg-bg-800/40 p-4">
          {hist === null ? (
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              carregando…
            </p>
          ) : hist.length <= 1 ? (
            <p className="text-xs text-text-faint">
              Sem evolução ainda — atualize o valor para começar a registrar.
            </p>
          ) : (
            <>
              <Sparkline valores={hist.map((h) => h.valor)} />
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-text-faint">
                <span>{rotuloDataHora(hist[0].registrado_em)}</span>
                <span>{hist.length} pontos</span>
                <span>{rotuloDataHora(hist[hist.length - 1].registrado_em)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </motion.li>
  );
}

// --- página ------------------------------------------------------------------
export default function Patrimonio() {
  const [itens, setItens] = useState<ItemPatrimonio[]>([]);
  const [resumo, setResumo] = useState<ResumoPatrimonio>({
    guardado: 0,
    investido: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ItemPatrimonio | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [is, r] = await Promise.all([
        listPatrimonio(),
        getResumoPatrimonio(),
      ]);
      setItens(is);
      setResumo(r);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return; // api.ts redireciona
      setError(e instanceof ApiError ? e.message : "Falha ao carregar o patrimônio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onSubmit(data: ItemPatrimonioInput) {
    setBusy(true);
    setError(null);
    try {
      if (editing) await updateItemPatrimonio(editing.id, data);
      else await createItemPatrimonio(data);
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível salvar");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(item: ItemPatrimonio) {
    if (!window.confirm(`Excluir "${item.nome}"? Não dá para desfazer.`)) return;
    setError(null);
    try {
      await deleteItemPatrimonio(item.id);
      if (editing?.id === item.id) setEditing(null);
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
          title="Patrimônio"
          meta={
            <span className="inline-flex items-center gap-2">
              <PiggyBank size={15} strokeWidth={1.75} className="text-accent" />
              {itens.length.toString().padStart(2, "0")} itens
            </span>
          }
        />

        <div className="mt-6">
          <FinanceTabs />
        </div>

        {/* totais — patrimônio total em destaque */}
        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="guardado (reservas)" valor={resumo.guardado} />
          <Stat label="investido" valor={resumo.investido} />
          <Stat label="patrimônio total" valor={resumo.total} tone="accent" big />
        </section>

        {/* nota: patrimônio ≠ saldo do fluxo de caixa */}
        <div className="mt-4 flex items-start gap-3 border-l-2 border-accent bg-accent-soft px-4 py-3">
          <Info size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-sm text-text-dim">
            <span className="text-text">Patrimônio</span> é o que você já tem
            acumulado (reservas + investimentos), atualizado à mão. É diferente do{" "}
            <span className="text-text">saldo do fluxo de caixa</span>, que mede
            entradas − saídas de um período.
          </p>
        </div>

        {error && (
          <p className="mt-6 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        {/* corpo: formulário+lista à esquerda */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-3">
            <div className="border border-line bg-bg-800/40 p-5 md:p-6">
              <div className="mb-5 flex items-center gap-2 text-text-dim">
                <Plus size={15} strokeWidth={2} className="text-accent" />
                <span className="font-mono text-[11px] uppercase tracking-widest">
                  {editing ? "editar item" : "novo item"}
                </span>
              </div>
              <ItemForm
                editing={editing}
                onSubmit={onSubmit}
                onCancel={() => setEditing(null)}
                busy={busy}
              />
            </div>
          </div>

          {/* lista de itens */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-text-dim">
              meus itens
            </h2>
            <ul className="divide-y divide-line border-t border-line">
              {loading ? (
                <li className="py-10 font-mono text-xs uppercase tracking-widest text-text-faint">
                  carregando…
                </li>
              ) : itens.length === 0 ? (
                <li className="py-12 text-center text-text-faint">
                  <PiggyBank size={26} className="mx-auto mb-3 opacity-50" />
                  Nenhum item de patrimônio ainda.
                </li>
              ) : (
                itens.map((item, i) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    onEdit={setEditing}
                    onDelete={onDelete}
                  />
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </Shell>
  );
}
