/**
 * Agenda — calendário visual estilo Google Calendar (sprint 08).
 * Três visões (mês / semana / dia) com navegação anterior/próximo/hoje, dia atual
 * no sotaque âmbar, criação clicando no dia/horário e edição clicando no evento.
 * Recorrência básica já vem expandida do backend (uma ocorrência por repetição).
 * Segue o design system: grade de divisórias finas, números em mono, sotaque com
 * parcimônia, eventos com cor/categoria discreta.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { motion } from "motion/react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import {
  ApiError,
  createEvento,
  deleteEvento,
  getEvento,
  listEventos,
  updateEvento,
  type CorEvento,
  type Evento,
  type EventoInput,
  type Ocorrencia,
  type Recorrencia,
} from "../lib/api";
import {
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  addDays,
  addMonths,
  endOfDay,
  isToday,
  minutesSinceMidnight,
  parseLocal,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toLocalDateStr,
  toLocalISO,
  toLocalTimeStr,
} from "../lib/datetime";
import { Shell } from "../components/Shell";
import { PageHeader } from "../components/PageHeader";
import { Field } from "../components/Field";
import { Button } from "../components/Button";

// --- paleta de cores das categorias (chave ↔ hex; espelha o backend) ---------
const CORES: Record<CorEvento, string> = {
  amber: "#ff8a3d",
  azul: "#5b8def",
  verde: "#6fcf97",
  roxo: "#a98eda",
  rosa: "#e57399",
  petroleo: "#3fb6ad",
  vermelho: "#e57373",
  cinza: "#8a93a6",
};
const COR_LABEL: Record<CorEvento, string> = {
  amber: "âmbar",
  azul: "azul",
  verde: "verde",
  roxo: "roxo",
  rosa: "rosa",
  petroleo: "petróleo",
  vermelho: "vermelho",
  cinza: "cinza",
};
const COR_KEYS = Object.keys(CORES) as CorEvento[];

const RECORRENCIAS: { v: Recorrencia; label: string }[] = [
  { v: "nenhuma", label: "não repete" },
  { v: "diaria", label: "diária" },
  { v: "semanal", label: "semanal" },
  { v: "mensal", label: "mensal" },
];

type View = "mes" | "semana" | "dia";
const HOUR_H = 48; // altura de uma hora no grid de tempo (px)

// --- helpers de ocorrência ---------------------------------------------------
const occInicio = (o: Ocorrencia) => parseLocal(o.inicio);
const occFim = (o: Ocorrencia) => parseLocal(o.fim);

/** A ocorrência aparece neste dia? (cobre eventos de vários dias.) */
function occursOnDay(o: Ocorrencia, day: Date): boolean {
  const t = startOfDay(day).getTime();
  return (
    t >= startOfDay(occInicio(o)).getTime() &&
    t <= startOfDay(occFim(o)).getTime()
  );
}

function horaLabel(o: Ocorrencia): string {
  return toLocalTimeStr(occInicio(o));
}

// =============================================================================
// Modal de evento — criar / editar / excluir
// =============================================================================
type Defaults = { inicio: Date; fim: Date; diaInteiro: boolean };

function EventoModal({
  evento,
  defaults,
  onClose,
  onSaved,
}: {
  evento: Evento | null;
  defaults: Defaults;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editando = evento !== null;
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [local, setLocal] = useState(evento?.local ?? "");
  const [cor, setCor] = useState<CorEvento>(evento?.cor ?? "amber");
  const [recorrencia, setRecorrencia] = useState<Recorrencia>(
    evento?.recorrencia ?? "nenhuma"
  );
  const [diaInteiro, setDiaInteiro] = useState(
    evento?.dia_inteiro ?? defaults.diaInteiro
  );
  const [inicio, setInicio] = useState<Date>(
    evento ? parseLocal(evento.inicio) : defaults.inicio
  );
  const [fim, setFim] = useState<Date>(
    evento ? parseLocal(evento.fim) : defaults.fim
  );
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fecha no Esc — atalho esperado num modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dtInput = (d: Date) => `${toLocalDateStr(d)}T${toLocalTimeStr(d)}`;

  // Atualiza só a data de um Date preservando a hora (usado nos inputs date).
  function comData(orig: Date, value: string): Date {
    const nd = parseLocal(value);
    nd.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
    return nd;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const t = titulo.trim();
    if (!t) return setErro("Informe um título para o evento.");

    const inicioISO = diaInteiro
      ? `${toLocalDateStr(inicio)}T00:00:00`
      : toLocalISO(inicio);
    const fimISO = diaInteiro
      ? `${toLocalDateStr(fim)}T23:59:59`
      : toLocalISO(fim);
    if (parseLocal(fimISO) < parseLocal(inicioISO))
      return setErro("O fim não pode ser antes do início.");

    const payload: EventoInput = {
      titulo: t,
      descricao: descricao.trim() || null,
      inicio: inicioISO,
      fim: fimISO,
      dia_inteiro: diaInteiro,
      local: local.trim() || null,
      cor,
      recorrencia,
    };
    setBusy(true);
    try {
      if (editando) await updateEvento(evento.id, payload);
      else await createEvento(payload);
      onSaved();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  async function excluir() {
    if (!evento) return;
    if (
      !window.confirm(
        evento.recorrencia !== "nenhuma"
          ? `Excluir "${evento.titulo}" e todas as repetições? Não dá para desfazer.`
          : `Excluir "${evento.titulo}"? Não dá para desfazer.`
      )
    )
      return;
    setBusy(true);
    try {
      await deleteEvento(evento.id);
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
            {editando ? "Editar evento" : "Novo evento"}
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
            id="evento-titulo"
            label="título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="ex.: Reunião, Dentista, Aniversário…"
            maxLength={120}
            autoFocus
            required
          />

          {/* dia inteiro — switch sóbrio */}
          <button
            type="button"
            onClick={() => setDiaInteiro((v) => !v)}
            aria-pressed={diaInteiro}
            className="flex items-center gap-3"
          >
            <span
              className={
                "relative h-5 w-9 shrink-0 border transition-colors " +
                (diaInteiro ? "border-accent bg-accent-soft" : "border-line")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-3.5 w-3.5 transition-all " +
                  (diaInteiro
                    ? "left-[1.1rem] bg-accent"
                    : "left-0.5 bg-text-faint")
                }
              />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-dim">
              dia inteiro
            </span>
          </button>

          {/* início / fim */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                início
              </span>
              {diaInteiro ? (
                <input
                  type="date"
                  value={toLocalDateStr(inicio)}
                  onChange={(e) => setInicio(comData(inicio, e.target.value))}
                  required
                  className={inputMono}
                />
              ) : (
                <input
                  type="datetime-local"
                  value={dtInput(inicio)}
                  onChange={(e) => setInicio(parseLocal(e.target.value))}
                  required
                  className={inputMono}
                />
              )}
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                fim
              </span>
              {diaInteiro ? (
                <input
                  type="date"
                  value={toLocalDateStr(fim)}
                  onChange={(e) => setFim(comData(fim, e.target.value))}
                  required
                  className={inputMono}
                />
              ) : (
                <input
                  type="datetime-local"
                  value={dtInput(fim)}
                  onChange={(e) => setFim(parseLocal(e.target.value))}
                  required
                  className={inputMono}
                />
              )}
            </label>
          </div>

          <Field
            id="evento-local"
            label="local (opcional)"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="ex.: Escritório, Av. Paulista…"
            maxLength={120}
          />

          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              descrição (opcional)
            </span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-2 w-full resize-none bg-transparent border-b border-line py-2
                         text-text outline-none transition-colors
                         placeholder:text-text-faint focus:border-accent"
              placeholder="anotações…"
            />
          </label>

          {/* cor / categoria */}
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              cor
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {COR_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  title={COR_LABEL[k]}
                  aria-label={COR_LABEL[k]}
                  aria-pressed={cor === k}
                  onClick={() => setCor(k)}
                  className={
                    "h-7 w-7 border transition-transform " +
                    (cor === k
                      ? "scale-110 border-text"
                      : "border-transparent hover:scale-105")
                  }
                  style={{ backgroundColor: CORES[k] }}
                />
              ))}
            </div>
          </div>

          {/* recorrência */}
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
              repetição
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RECORRENCIAS.map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRecorrencia(v)}
                  className={
                    "border py-2 text-xs transition-colors " +
                    (recorrencia === v
                      ? "border-accent text-accent"
                      : "border-line text-text-dim hover:border-line-strong")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

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

// =============================================================================
// Chip de evento (reusado nas visões)
// =============================================================================
function Chip({
  o,
  onClick,
  showTime = true,
}: {
  o: Ocorrencia;
  onClick: () => void;
  showTime?: boolean;
}) {
  const hex = CORES[o.cor];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={o.titulo}
      style={{ backgroundColor: hex + "22", borderLeftColor: hex }}
      className="flex w-full items-center gap-1.5 overflow-hidden border-l-2 px-1.5 py-0.5
                 text-left text-xs text-text transition-colors hover:bg-bg-700"
    >
      {showTime && !o.dia_inteiro && (
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-dim">
          {horaLabel(o)}
        </span>
      )}
      {o.recorrente && <Repeat size={9} className="shrink-0 text-text-faint" />}
      <span className="truncate">{o.titulo}</span>
    </button>
  );
}

// =============================================================================
// Visão de mês
// =============================================================================
function MonthView({
  cursor,
  ocorrencias,
  onPickDay,
  onShowDay,
  onPickOcc,
}: {
  cursor: Date;
  ocorrencias: Ocorrencia[];
  onPickDay: (day: Date) => void;
  onShowDay: (day: Date) => void;
  onPickOcc: (o: Ocorrencia) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(cursor));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const mesAtual = cursor.getMonth();

  return (
    <div className="border-l border-t border-line">
      {/* cabeçalho de dias da semana */}
      <div className="grid grid-cols-7">
        {WEEKDAYS_SHORT.map((d) => (
          <div
            key={d}
            className="border-b border-r border-line py-2 text-center font-mono
                       text-[11px] uppercase tracking-widest text-text-faint"
          >
            {d}
          </div>
        ))}
      </div>
      {/* grade de dias */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const doMes = day.getMonth() === mesAtual;
          const hoje = isToday(day);
          const doDia = ocorrencias
            .filter((o) => occursOnDay(o, day))
            .sort(
              (a, b) =>
                Number(b.dia_inteiro) - Number(a.dia_inteiro) ||
                occInicio(a).getTime() - occInicio(b).getTime()
            );
          const visiveis = doDia.slice(0, 3);
          const resto = doDia.length - visiveis.length;
          return (
            <div
              key={day.getTime()}
              onClick={() => onPickDay(day)}
              className={
                "min-h-[6.5rem] cursor-pointer border-b border-r border-line p-1.5 " +
                "transition-colors hover:bg-bg-800/40 " +
                (doMes ? "" : "bg-bg-900/40")
              }
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDay(day);
                  }}
                  className={
                    "grid h-6 min-w-6 place-items-center px-1 font-mono text-xs tabular-nums " +
                    "transition-colors " +
                    (hoje
                      ? "bg-accent font-semibold text-bg-900"
                      : doMes
                        ? "text-text-dim hover:text-accent"
                        : "text-text-faint hover:text-text-dim")
                  }
                >
                  {day.getDate()}
                </button>
              </div>
              <div className="mt-1 space-y-1">
                {visiveis.map((o, i) => (
                  <Chip key={`${o.id}-${i}`} o={o} onClick={() => onPickOcc(o)} />
                ))}
                {resto > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowDay(day);
                    }}
                    className="px-1.5 font-mono text-[10px] uppercase tracking-wide
                               text-text-faint transition-colors hover:text-accent"
                  >
                    +{resto} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Visão de tempo (semana = 7 dias, dia = 1 dia) — faixas de horário
// =============================================================================
type Bloco = { o: Ocorrencia; top: number; height: number; lane: number; cols: number };

/** Posiciona os eventos com hora de um dia, repartindo em faixas os que se
 *  sobrepõem (lane packing simples por cluster de sobreposição). */
function layoutDia(occs: Ocorrencia[], day: Date): Bloco[] {
  const dayStart = startOfDay(day).getTime();
  const segs = occs
    .map((o) => {
      const ini = Math.max(occInicio(o).getTime(), dayStart);
      const fimT = Math.min(occFim(o).getTime(), endOfDay(day).getTime());
      const start = (ini - dayStart) / 60000;
      const end = Math.max(start + 20, (fimT - dayStart) / 60000); // mín. 20min
      return { o, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: Bloco[] = [];
  let cluster: typeof segs = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    const laneOf = new Map<(typeof segs)[number], number>();
    for (const s of cluster) {
      let placed = laneEnds.findIndex((e) => e <= s.start);
      if (placed < 0) {
        placed = laneEnds.length;
        laneEnds.push(s.end);
      } else {
        laneEnds[placed] = s.end;
      }
      laneOf.set(s, placed);
    }
    const cols = laneEnds.length;
    for (const s of cluster) {
      out.push({
        o: s.o,
        top: (s.start / 60) * HOUR_H,
        height: ((s.end - s.start) / 60) * HOUR_H,
        lane: laneOf.get(s)!,
        cols,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };
  for (const s of segs) {
    if (cluster.length && s.start >= clusterEnd) flush();
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  flush();
  return out;
}

function TimeGrid({
  days,
  ocorrencias,
  onPickSlot,
  onPickAllDay,
  onPickOcc,
}: {
  days: Date[];
  ocorrencias: Ocorrencia[];
  onPickSlot: (when: Date) => void;
  onPickAllDay: (day: Date) => void;
  onPickOcc: (o: Ocorrencia) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Abre rolado para o começo da manhã (07h) — onde a vida costuma acontecer.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H;
  }, [days.length]);

  const horas = Array.from({ length: 24 }, (_, h) => h);

  function clickSlot(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = Math.max(0, Math.min(23 * 60 + 30, Math.floor(y / HOUR_H * 2) * 30));
    const when = new Date(day);
    when.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    onPickSlot(when);
  }

  const gutter = "w-14 shrink-0";

  return (
    <div className="border border-line">
      {/* cabeçalho dos dias */}
      <div className="flex border-b border-line">
        <div className={gutter} />
        {days.map((d) => {
          const hoje = isToday(d);
          return (
            <div
              key={d.getTime()}
              className="flex-1 border-l border-line py-2 text-center"
            >
              <div className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                {WEEKDAYS_SHORT[d.getDay()]}
              </div>
              <div
                className={
                  "mx-auto mt-1 grid h-7 w-7 place-items-center font-mono text-sm tabular-nums " +
                  (hoje ? "bg-accent font-semibold text-bg-900" : "text-text")
                }
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* faixa de dia inteiro */}
      <div className="flex border-b border-line">
        <div
          className={
            gutter +
            " flex items-center justify-end pr-2 font-mono text-[10px] uppercase tracking-widest text-text-faint"
          }
        >
          dia todo
        </div>
        {days.map((d) => {
          const allday = ocorrencias.filter(
            (o) => o.dia_inteiro && occursOnDay(o, d)
          );
          return (
            <div
              key={d.getTime()}
              onClick={() => onPickAllDay(d)}
              className="min-h-[2rem] flex-1 cursor-pointer space-y-1 border-l border-line p-1
                         transition-colors hover:bg-bg-800/40"
            >
              {allday.map((o, i) => (
                <Chip
                  key={`${o.id}-${i}`}
                  o={o}
                  showTime={false}
                  onClick={() => onPickOcc(o)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* grade de horas */}
      <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto">
        <div className="flex" style={{ height: 24 * HOUR_H }}>
          {/* régua de horas */}
          <div className={gutter + " relative"}>
            {horas.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_H }}
                className="relative border-t border-line/60"
              >
                {h > 0 && (
                  <span className="absolute -top-2 right-2 font-mono text-[10px] tabular-nums text-text-faint">
                    {String(h).padStart(2, "0")}h
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* colunas de dias */}
          {days.map((d) => {
            const timed = ocorrencias.filter(
              (o) => !o.dia_inteiro && occursOnDay(o, d)
            );
            const blocos = layoutDia(timed, d);
            const agora = isToday(d) ? minutesSinceMidnight(new Date()) : null;
            return (
              <div
                key={d.getTime()}
                onClick={(e) => clickSlot(d, e)}
                className="relative flex-1 cursor-pointer border-l border-line"
              >
                {horas.map((h) => (
                  <div
                    key={h}
                    style={{ height: HOUR_H }}
                    className="border-t border-line/60"
                  />
                ))}
                {/* linha do "agora" */}
                {agora !== null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 border-t border-accent"
                    style={{ top: (agora / 60) * HOUR_H }}
                  >
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-accent" />
                  </div>
                )}
                {/* eventos com hora */}
                {blocos.map((b, i) => {
                  const hex = CORES[b.o.cor];
                  return (
                    <button
                      key={`${b.o.id}-${i}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickOcc(b.o);
                      }}
                      title={b.o.titulo}
                      style={{
                        top: b.top + 1,
                        height: Math.max(16, b.height - 2),
                        left: `calc(${(b.lane / b.cols) * 100}% + 2px)`,
                        width: `calc(${100 / b.cols}% - 4px)`,
                        backgroundColor: hex + "26",
                        borderLeftColor: hex,
                      }}
                      className="absolute z-20 overflow-hidden border-l-2 px-1.5 py-0.5
                                 text-left transition-colors hover:bg-bg-700"
                    >
                      <span className="flex items-center gap-1">
                        {b.o.recorrente && (
                          <Repeat size={9} className="shrink-0 text-text-faint" />
                        )}
                        <span className="truncate text-xs text-text">
                          {b.o.titulo}
                        </span>
                      </span>
                      <span className="block font-mono text-[10px] tabular-nums text-text-dim">
                        {horaLabel(b.o)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Página
// =============================================================================
type ModalState =
  | { mode: "create"; defaults: Defaults }
  | { mode: "edit"; evento: Evento }
  | null;

export default function Agenda() {
  const [view, setView] = useState<View>("mes");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  // Janela visível conforme a visão — base da consulta ao backend.
  const range = useMemo(() => {
    if (view === "mes") {
      const start = startOfWeek(startOfMonth(cursor));
      return { start, end: endOfDay(addDays(start, 41)), days: [] as Date[] };
    }
    if (view === "semana") {
      const start = startOfWeek(cursor);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return { start, end: endOfDay(addDays(start, 6)), days };
    }
    const start = startOfDay(cursor);
    return { start, end: endOfDay(cursor), days: [start] };
  }, [view, cursor]);

  const refresh = useCallback(async () => {
    try {
      const occ = await listEventos(
        toLocalISO(range.start),
        toLocalISO(range.end)
      );
      setOcorrencias(occ);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return; // api.ts redireciona
      setError(e instanceof ApiError ? e.message : "Falha ao carregar a agenda");
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Navegação anterior/próximo conforme a visão.
  function step(dir: -1 | 1) {
    setCursor((c) =>
      view === "mes"
        ? addMonths(c, dir)
        : addDays(c, dir * (view === "semana" ? 7 : 1))
    );
  }

  function novoEvento() {
    // Próxima hora cheia se for hoje; senão, 09h no dia em foco.
    const hora = isToday(cursor) ? Math.min(new Date().getHours() + 1, 23) : 9;
    const inicio = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate(),
      hora,
      0,
      0
    );
    const fim = new Date(inicio);
    fim.setHours(inicio.getHours() + 1);
    setModal({ mode: "create", defaults: { inicio, fim, diaInteiro: false } });
  }

  async function abrirEvento(o: Ocorrencia) {
    // A ocorrência traz o id do evento-base; abrir busca a regra original
    // (início/fim base + recorrência) para edição da série inteira.
    try {
      const ev = await getEvento(o.id);
      setModal({ mode: "edit", evento: ev });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível abrir o evento");
    }
  }

  function criarNoDia(day: Date) {
    const inicio = startOfDay(day);
    setModal({
      mode: "create",
      defaults: { inicio, fim: startOfDay(day), diaInteiro: true },
    });
  }

  function criarNoHorario(when: Date) {
    const fim = new Date(when);
    fim.setHours(when.getHours() + 1);
    setModal({ mode: "create", defaults: { inicio: when, fim, diaInteiro: false } });
  }

  function mostrarDia(day: Date) {
    setCursor(day);
    setView("dia");
  }

  // Rótulo do período conforme a visão.
  const titulo = useMemo(() => {
    if (view === "mes") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "dia") {
      return `${cursor.getDate()} de ${MONTHS[cursor.getMonth()]}, ${cursor.getFullYear()}`;
    }
    const ws = startOfWeek(cursor);
    const we = addDays(ws, 6);
    const mesmoMes = ws.getMonth() === we.getMonth();
    return mesmoMes
      ? `${ws.getDate()}–${we.getDate()} de ${MONTHS_SHORT[ws.getMonth()]} ${we.getFullYear()}`
      : `${ws.getDate()} ${MONTHS_SHORT[ws.getMonth()]} – ${we.getDate()} ${MONTHS_SHORT[we.getMonth()]} ${we.getFullYear()}`;
  }, [view, cursor]);

  const VIEWS: { v: View; label: string }[] = [
    { v: "mes", label: "Mês" },
    { v: "semana", label: "Semana" },
    { v: "dia", label: "Dia" },
  ];

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <PageHeader
          eyebrow="agenda"
          title="Calendário"
          meta={
            <span className="inline-flex items-center gap-2">
              <CalendarDays size={15} strokeWidth={1.75} className="text-accent" />
              {ocorrencias.length.toString().padStart(2, "0")} no período
            </span>
          }
        />

        {/* barra de controle: navegação + título + visão + novo */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-line">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="anterior"
                className="grid h-9 w-9 place-items-center text-text-dim transition-colors hover:text-accent"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="h-9 w-px bg-line" />
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="próximo"
                className="grid h-9 w-9 place-items-center text-text-dim transition-colors hover:text-accent"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="border border-line px-3 py-1.5 font-mono text-[11px] uppercase
                         tracking-widest text-text-dim transition-colors
                         hover:border-accent hover:text-accent"
            >
              hoje
            </button>
            <h2 className="font-display text-xl capitalize md:text-2xl">{titulo}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* alternância de visão */}
            <div className="flex items-stretch border border-line">
              {VIEWS.map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={
                    "px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors " +
                    (view === v
                      ? "bg-accent-soft text-accent"
                      : "text-text-dim hover:text-text")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <Button onClick={novoEvento}>
              <Plus size={16} strokeWidth={2} />
              Novo
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-6 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        {/* corpo do calendário */}
        <div className="mt-6">
          {loading ? (
            <p className="py-16 text-center font-mono text-xs uppercase tracking-widest text-text-faint">
              carregando…
            </p>
          ) : view === "mes" ? (
            <MonthView
              cursor={cursor}
              ocorrencias={ocorrencias}
              onPickDay={criarNoDia}
              onShowDay={mostrarDia}
              onPickOcc={abrirEvento}
            />
          ) : (
            <TimeGrid
              days={range.days}
              ocorrencias={ocorrencias}
              onPickSlot={criarNoHorario}
              onPickAllDay={criarNoDia}
              onPickOcc={abrirEvento}
            />
          )}
        </div>

        {/* legenda discreta */}
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-faint">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={12} /> clique num horário para criar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={12} /> clique num evento para editar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Repeat size={12} /> evento recorrente
          </span>
        </p>
      </div>

      {modal && (
        <EventoModal
          evento={modal.mode === "edit" ? modal.evento : null}
          defaults={
            modal.mode === "create"
              ? modal.defaults
              : { inicio: new Date(), fim: new Date(), diaInteiro: false }
          }
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
