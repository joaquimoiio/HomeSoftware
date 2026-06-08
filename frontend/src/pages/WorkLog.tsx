/**
 * Work Log — registro de horas trabalhadas (sprint 13).
 * Aba do módulo Agenda: cada registro tem o número da atividade (texto livre),
 * o que foi feito, a hora de início e a duração (não pede o fim). Mostra a lista
 * do período e um resumo com o total de horas e o total por atividade.
 * Segue o design system: durações/horas em mono tabular-nums, sotaque âmbar só
 * em ação/foco, divisórias finas em vez de cartões flutuando.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { motion } from "motion/react";
import { Clock, Hash, Pencil, Plus, Timer, Trash2, X } from "lucide-react";
import {
  ApiError,
  createWorkLog,
  deleteWorkLog,
  getResumoWorkLog,
  listWorkLogs,
  updateWorkLog,
  type ResumoWorkLog,
  type WorkLog,
  type WorkLogInput,
} from "../lib/api";
import { parseLocal, toLocalISO } from "../lib/datetime";
import { Shell } from "../components/Shell";
import { PageHeader } from "../components/PageHeader";
import { AgendaTabs } from "../components/AgendaTabs";
import { Field } from "../components/Field";
import { Button } from "../components/Button";

// --- formatação --------------------------------------------------------------
/** Minutos → "2h30" / "1h" / "45min" — legível e compacto. */
function fmtDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Minutos → "12,5h" — total acumulado em horas decimais para o resumo. */
function fmtHoras(min: number): string {
  const horas = min / 60;
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`;
}

/** Primeiro e último dia do mês corrente (default do filtro de período). */
function mesCorrente(): { inicio: string; fim: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toLocaleDateString("en-CA");
  return { inicio: fmt(new Date(y, m, 1)), fim: fmt(new Date(y, m + 1, 0)) };
}

function rotuloInicio(iso: string): { data: string; hora: string } {
  const d = parseLocal(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { data: `${dd}/${mm}`, hora: `${hh}:${mi}` };
}

// =============================================================================
// Modal de registro — criar / editar / excluir
// =============================================================================
function WorkLogModal({
  registro,
  onClose,
  onSaved,
}: {
  registro: WorkLog | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = registro !== null;
  const [atividade, setAtividade] = useState(registro?.atividade ?? "");
  const [descricao, setDescricao] = useState(registro?.descricao ?? "");
  const [inicio, setInicio] = useState<Date>(
    registro ? parseLocal(registro.inicio) : nextHour()
  );
  const [horas, setHoras] = useState(
    registro ? String(Math.floor(registro.duracao_min / 60)) : "1"
  );
  const [minutos, setMinutos] = useState(
    registro ? String(registro.duracao_min % 60) : "0"
  );
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fecha no Esc — atalho esperado num modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dtInput = (d: Date) =>
    `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` +
    `T${p2(d.getHours())}:${p2(d.getMinutes())}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const a = atividade.trim();
    if (!a) return setErro("Informe o número da atividade.");

    const duracao = (parseInt(horas) || 0) * 60 + (parseInt(minutos) || 0);
    if (duracao <= 0) return setErro("A duração precisa ser maior que zero.");

    const payload: WorkLogInput = {
      atividade: a,
      descricao: descricao.trim() || null,
      inicio: toLocalISO(inicio),
      duracao_min: duracao,
    };
    setBusy(true);
    try {
      if (editando) await updateWorkLog(registro.id, payload);
      else await createWorkLog(payload);
      onSaved();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  async function excluir() {
    if (!registro) return;
    if (!window.confirm(`Excluir o registro de "${registro.atividade}"? Não dá para desfazer.`))
      return;
    setBusy(true);
    try {
      await deleteWorkLog(registro.id);
      onSaved();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível excluir.");
      setBusy(false);
    }
  }

  const inputMono =
    "mt-2 w-full bg-transparent border-b border-line py-2 font-mono tabular-nums " +
    "text-text outline-none transition-colors focus:border-accent [color-scheme:dark]";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-bg-900/80 p-4 backdrop-blur-sm md:place-items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto mt-8 w-full max-w-lg border border-line bg-bg-800 md:mt-0"
      >
        {/* cabeçalho */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-2xl">
            {editando ? "Editar registro" : "Novo registro"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-text-dim transition-colors hover:text-accent"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 px-6 py-5">
          <Field
            id="worklog-atividade"
            label="atividade (nº / identificador)"
            value={atividade}
            onChange={(e) => setAtividade(e.target.value)}
            placeholder="ex.: OS-1234, #4567…"
            maxLength={60}
            autoFocus
            required
          />

          {/* início */}
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              início
            </span>
            <input
              type="datetime-local"
              value={dtInput(inicio)}
              onChange={(e) => setInicio(parseLocal(e.target.value))}
              required
              className={inputMono}
            />
          </label>

          {/* duração — horas + minutos */}
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              duração
            </span>
            <div className="mt-2 flex items-end gap-3">
              <label className="flex items-baseline gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={168}
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
                  className="w-16 bg-transparent border-b border-line py-2 text-center font-mono
                             tabular-nums text-text outline-none transition-colors focus:border-accent"
                />
                <span className="font-mono text-xs text-text-faint">h</span>
              </label>
              <label className="flex items-baseline gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  className="w-16 bg-transparent border-b border-line py-2 text-center font-mono
                             tabular-nums text-text outline-none transition-colors focus:border-accent"
                />
                <span className="font-mono text-xs text-text-faint">min</span>
              </label>
            </div>
          </div>

          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              o que foi feito (opcional)
            </span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-2 w-full resize-none bg-transparent border-b border-line py-2
                         text-text outline-none transition-colors
                         placeholder:text-text-faint focus:border-accent"
              placeholder="anotações sobre a atividade…"
            />
          </label>

          {erro && (
            <p className="text-sm text-neg" role="alert">
              {erro}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-line pt-5">
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : editando ? "Salvar" : "Criar"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
            </div>
            {editando && (
              <Button type="button" variant="danger" onClick={excluir} disabled={busy}>
                <Trash2 size={15} />
                Excluir
              </Button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// --- helpers locais ----------------------------------------------------------
const p2 = (n: number) => String(n).padStart(2, "0");

/** Próxima hora cheia (default do início ao criar). */
function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d;
}

// =============================================================================
// Página
// =============================================================================
type ModalState = { mode: "create" } | { mode: "edit"; registro: WorkLog } | null;

export default function WorkLogPage() {
  const inicial = useMemo(mesCorrente, []);
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [registros, setRegistros] = useState<WorkLog[]>([]);
  const [resumo, setResumo] = useState<ResumoWorkLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const refresh = useCallback(async () => {
    const periodo = { inicio: inicio || undefined, fim: fim || undefined };
    try {
      const [regs, res] = await Promise.all([
        listWorkLogs(periodo),
        getResumoWorkLog(periodo),
      ]);
      setRegistros(regs);
      setResumo(res);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return; // api.ts redireciona
      setError(e instanceof ApiError ? e.message : "Falha ao carregar o work log");
    } finally {
      setLoading(false);
    }
  }, [inicio, fim]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <PageHeader
          eyebrow="agenda"
          title="Work Log"
          meta={
            <span className="inline-flex items-center gap-2">
              <Timer size={15} strokeWidth={1.75} className="text-accent" />
              {resumo ? fmtHoras(resumo.total_min) : "0h"} no período
            </span>
          }
        />

        <div className="mt-6">
          <AgendaTabs />
        </div>

        {/* filtro de período + novo */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                de
              </span>
              <input
                type="date"
                value={inicio}
                max={fim || undefined}
                onChange={(e) => setInicio(e.target.value)}
                className="mt-2 block bg-transparent border-b border-line py-2 font-mono
                           tabular-nums text-text outline-none transition-colors
                           focus:border-accent [color-scheme:dark]"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                até
              </span>
              <input
                type="date"
                value={fim}
                min={inicio || undefined}
                onChange={(e) => setFim(e.target.value)}
                className="mt-2 block bg-transparent border-b border-line py-2 font-mono
                           tabular-nums text-text outline-none transition-colors
                           focus:border-accent [color-scheme:dark]"
              />
            </label>
          </div>
          <Button onClick={() => setModal({ mode: "create" })}>
            <Plus size={16} strokeWidth={2} />
            Novo
          </Button>
        </div>

        {error && (
          <p className="mt-6 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center font-mono text-xs uppercase tracking-widest text-text-faint">
            carregando…
          </p>
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_18rem]">
            {/* lista de registros */}
            <div>
              {registros.length === 0 ? (
                <p className="border border-dashed border-line py-16 text-center font-mono
                              text-xs uppercase tracking-widest text-text-faint">
                  nenhum registro no período
                </p>
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {registros.map((r, i) => {
                    const { data, hora } = rotuloInicio(r.inicio);
                    return (
                      <motion.li
                        key={r.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                        className="group flex items-center gap-4 py-3"
                      >
                        {/* início */}
                        <div className="w-14 shrink-0 text-right">
                          <div className="font-mono text-sm tabular-nums text-text">
                            {hora}
                          </div>
                          <div className="font-mono text-[10px] tabular-nums text-text-faint">
                            {data}
                          </div>
                        </div>
                        <span className="h-8 w-px shrink-0 bg-line" />
                        {/* atividade + descrição */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Hash size={12} className="shrink-0 text-accent" />
                            <span className="truncate font-mono text-sm text-text">
                              {r.atividade}
                            </span>
                          </div>
                          {r.descricao && (
                            <p className="mt-0.5 truncate text-sm text-text-dim">
                              {r.descricao}
                            </p>
                          )}
                        </div>
                        {/* duração */}
                        <div className="shrink-0 font-mono text-sm tabular-nums text-text">
                          {fmtDuracao(r.duracao_min)}
                        </div>
                        {/* editar */}
                        <button
                          type="button"
                          onClick={() => setModal({ mode: "edit", registro: r })}
                          aria-label="Editar registro"
                          className="shrink-0 text-text-faint opacity-0 transition-opacity
                                     hover:text-accent group-hover:opacity-100"
                        >
                          <Pencil size={15} />
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* resumo do período */}
            <aside className="space-y-6">
              <div className="border border-line p-5">
                <p className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                  total no período
                </p>
                <p className="mt-2 font-display text-4xl tabular-nums">
                  {resumo ? fmtHoras(resumo.total_min) : "0h"}
                </p>
                <p className="mt-1 font-mono text-xs tabular-nums text-text-faint">
                  {resumo?.registros ?? 0} registro
                  {(resumo?.registros ?? 0) === 1 ? "" : "s"}
                </p>
              </div>

              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                  por atividade
                </p>
                {resumo && resumo.por_atividade.length > 0 ? (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {resumo.por_atividade.map((t) => (
                      <li
                        key={t.atividade}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="min-w-0 truncate font-mono text-xs text-text-dim">
                          {t.atividade}
                        </span>
                        <span className="shrink-0 font-mono text-sm tabular-nums text-text">
                          {fmtDuracao(t.total_min)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 font-mono text-xs text-text-faint">—</p>
                )}
              </div>

              <p className="flex items-center gap-1.5 text-xs text-text-faint">
                <Clock size={12} /> duração = hora de início + tempo gasto
              </p>
            </aside>
          </div>
        )}
      </div>

      {modal && (
        <WorkLogModal
          registro={modal.mode === "edit" ? modal.registro : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
    </Shell>
  );
}
