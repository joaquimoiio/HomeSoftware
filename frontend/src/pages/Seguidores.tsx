/**
 * Comparador de seguidores (sprint 09) — SEM banco.
 * Sobe a lista atual (e, opcionalmente, a anterior) em JSON e mostra quem entrou,
 * quem saiu, contagens e saldo. Pode salvar a lista atual como snapshot de
 * referência (em disco, por usuário) para comparar só contra ela na próxima vez.
 * Segue o design system: duas colunas ganhos/perdidos, contadores em mono, tom
 * semântico discreto e estado vazio bem cuidado.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Database,
  FileJson,
  Info,
  Save,
  Trash2,
  UploadCloud,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  ApiError,
  compararSeguidores,
  deleteSnapshot,
  getSnapshot,
  salvarSnapshot,
  type Comparacao,
  type SnapshotInfo,
} from "../lib/api";
import { Shell } from "../components/Shell";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Value } from "../components/Value";

// ISO naive ("2026-06-07T14:30:00") → "07/06/26 14:30".
function rotuloSnapshot(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }) +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

// --- seletor de arquivo (linha fina, mostra o nome escolhido) ----------------
function FileSlot({
  label,
  hint,
  file,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  file: File | null;
  onPick: (f: File | null) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
        {label}
      </span>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="mt-2 flex items-center justify-between gap-3 border border-line-strong bg-bg-800/60 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5 text-sm text-text">
            <FileJson size={16} strokeWidth={1.75} className="shrink-0 text-accent" />
            <span className="truncate">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (ref.current) ref.current.value = "";
              onClear();
            }}
            title="remover"
            aria-label="remover arquivo"
            className="shrink-0 text-text-faint transition-colors hover:text-neg"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="mt-2 flex w-full items-center gap-3 border border-dashed border-line
                     bg-transparent px-3 py-2.5 text-left text-sm text-text-dim
                     transition-colors hover:border-accent hover:text-accent"
        >
          <UploadCloud size={16} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{hint}</span>
        </button>
      )}
    </div>
  );
}

// --- contador de resultado ---------------------------------------------------
function Stat({
  label,
  valor,
  tone = "default",
  sinal = false,
}: {
  label: string;
  valor: number;
  tone?: "default" | "pos" | "neg" | "accent";
  sinal?: boolean;
}) {
  const txt = sinal && valor > 0 ? `+${valor}` : String(valor);
  return (
    <div className="border border-line bg-bg-800/50 p-4">
      <p className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
        {label}
      </p>
      <Value tone={tone} className="mt-2 block text-2xl md:text-3xl">
        {txt}
      </Value>
    </div>
  );
}

// --- coluna de nomes (entrou / saiu) -----------------------------------------
function Coluna({
  titulo,
  nomes,
  icon: Icon,
  tone,
}: {
  titulo: string;
  nomes: string[];
  icon: typeof UserPlus;
  tone: "pos" | "neg";
}) {
  const cor = tone === "pos" ? "text-pos" : "text-neg";
  return (
    <div className="border border-line bg-bg-800/40">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-text">
          <Icon size={16} strokeWidth={1.75} className={cor} />
          {titulo}
        </span>
        <Value tone={tone} className="text-lg">
          {nomes.length}
        </Value>
      </div>
      {nomes.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-faint">
          Ninguém aqui.
        </p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
          {nomes.map((n, i) => (
            <motion.li
              key={n}
              initial={{ opacity: 0, x: tone === "pos" ? 6 : -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.015, 0.3) }}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <Value tone="dim" className="w-8 shrink-0 text-xs">
                {String(i + 1).padStart(2, "0")}
              </Value>
              <span className="truncate text-sm text-text-dim">{n}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- página ------------------------------------------------------------------
export default function Seguidores() {
  const [atual, setAtual] = useState<File | null>(null);
  const [anterior, setAnterior] = useState<File | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [resultado, setResultado] = useState<Comparacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [comparando, setComparando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregarSnapshot = useCallback(async () => {
    try {
      setSnapshot(await getSnapshot());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return; // api.ts redireciona
      // snapshot é informativo; não trava a tela se falhar.
    }
  }, []);

  useEffect(() => {
    carregarSnapshot();
  }, [carregarSnapshot]);

  // Sem "anterior", a comparação cai no snapshot salvo — exige que ele exista.
  const usaSnapshot = !anterior;
  const podeComparar =
    !!atual && !comparando && (!usaSnapshot || !!snapshot?.existe);

  async function onComparar() {
    if (!atual) return;
    setComparando(true);
    setErro(null);
    setAviso(null);
    try {
      setResultado(await compararSeguidores(atual, anterior));
    } catch (e) {
      setResultado(null);
      setErro(e instanceof ApiError ? e.message : "Falha ao comparar as listas.");
    } finally {
      setComparando(false);
    }
  }

  async function onSalvarSnapshot() {
    if (!atual) return;
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const info = await salvarSnapshot(atual);
      setSnapshot(info);
      setAviso(
        `Snapshot salvo: ${info.total} seguidores (campo "${info.campo}").`
      );
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar o snapshot.");
    } finally {
      setSalvando(false);
    }
  }

  async function onApagarSnapshot() {
    if (!window.confirm("Apagar o snapshot de referência salvo?")) return;
    setErro(null);
    setAviso(null);
    try {
      await deleteSnapshot();
      await carregarSnapshot();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível apagar o snapshot.");
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-10">
        <PageHeader
          eyebrow="comparador"
          title="Seguidores"
          meta={
            <span className="inline-flex items-center gap-2">
              <Users size={15} strokeWidth={1.75} className="text-accent" />
              sem banco · em memória
            </span>
          }
        />

        {/* nota: nada vai para o banco */}
        <div className="mt-6 flex items-start gap-3 border-l-2 border-accent bg-accent-soft px-4 py-3">
          <Info size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-sm text-text-dim">
            Suba a <span className="text-text">lista atual</span> e a{" "}
            <span className="text-text">anterior</span> em JSON para ver quem entrou
            e quem saiu. Os arquivos são processados em memória —{" "}
            <span className="text-text">nada é salvo no banco</span>. Sem a lista
            anterior, comparo contra o seu snapshot de referência.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          {/* painel de upload */}
          <div className="lg:col-span-2">
            <div className="border border-line bg-bg-800/40 p-5 md:p-6">
              <div className="mb-5 flex items-center gap-2 text-text-dim">
                <UploadCloud size={15} strokeWidth={2} className="text-accent" />
                <span className="font-mono text-[11px] uppercase tracking-widest">
                  listas
                </span>
              </div>

              <div className="space-y-5">
                <FileSlot
                  label="lista atual (obrigatória)"
                  hint="escolher arquivo .json"
                  file={atual}
                  onPick={setAtual}
                  onClear={() => setAtual(null)}
                />
                <FileSlot
                  label="lista anterior (opcional)"
                  hint="escolher .json ou usar o snapshot"
                  file={anterior}
                  onPick={setAnterior}
                  onClear={() => setAnterior(null)}
                />
              </div>

              {/* status do snapshot */}
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-faint">
                    <Database size={13} strokeWidth={2} />
                    snapshot
                  </span>
                  {snapshot?.existe && (
                    <button
                      type="button"
                      onClick={onApagarSnapshot}
                      title="apagar snapshot"
                      aria-label="apagar snapshot"
                      className="text-text-faint transition-colors hover:text-neg"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {snapshot?.existe ? (
                  <p className="mt-2 text-xs text-text-dim">
                    <Value tone="accent">{snapshot.total}</Value> seguidores ·
                    salvo em{" "}
                    <Value tone="dim">
                      {snapshot.salvo_em ? rotuloSnapshot(snapshot.salvo_em) : "—"}
                    </Value>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-text-faint">
                    Nenhum snapshot salvo ainda.
                  </p>
                )}
              </div>

              {usaSnapshot && !snapshot?.existe && atual && (
                <p className="mt-4 text-xs text-text-faint">
                  Sem lista anterior e sem snapshot — envie a lista anterior ou
                  salve um snapshot primeiro.
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button onClick={onComparar} disabled={!podeComparar}>
                  <ArrowRight size={17} strokeWidth={2} />
                  {comparando ? "Comparando…" : "Comparar"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={onSalvarSnapshot}
                  disabled={!atual || salvando}
                >
                  <Save size={16} strokeWidth={2} />
                  {salvando ? "Salvando…" : "Salvar snapshot"}
                </Button>
              </div>

              {erro && (
                <p className="mt-4 text-sm text-neg" role="alert">
                  {erro}
                </p>
              )}
              {aviso && (
                <p className="mt-4 text-sm text-pos" role="status">
                  {aviso}
                </p>
              )}
            </div>
          </div>

          {/* resultado */}
          <div className="lg:col-span-3">
            {resultado ? (
              <div className="space-y-6">
                {/* contadores */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat label="total atual" valor={resultado.total_atual} />
                  <Stat label="total anterior" valor={resultado.total_anterior} />
                  <Stat
                    label="saldo"
                    valor={resultado.saldo}
                    tone={
                      resultado.saldo > 0
                        ? "pos"
                        : resultado.saldo < 0
                        ? "neg"
                        : "default"
                    }
                    sinal
                  />
                  <Stat label="ganhos" valor={resultado.ganhos} tone="pos" />
                  <Stat label="perdidos" valor={resultado.perdidos} tone="neg" />
                  <div className="border border-line bg-bg-800/50 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
                      comparado com
                    </p>
                    <p className="mt-2 text-sm capitalize text-text">
                      {resultado.fonte_anterior === "snapshot"
                        ? "snapshot salvo"
                        : "arquivo enviado"}
                    </p>
                  </div>
                </div>

                {/* campo identificador detectado */}
                <p className="text-xs text-text-faint">
                  Identificador detectado: atual por{" "}
                  <Value tone="dim">{resultado.campo_atual}</Value>, anterior por{" "}
                  <Value tone="dim">{resultado.campo_anterior}</Value>.
                </p>

                {/* duas colunas */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Coluna
                    titulo="começaram a seguir"
                    nomes={resultado.entrou}
                    icon={UserPlus}
                    tone="pos"
                  />
                  <Coluna
                    titulo="pararam de seguir"
                    nomes={resultado.saiu}
                    icon={UserMinus}
                    tone="neg"
                  />
                </div>
              </div>
            ) : (
              <div className="grid h-full min-h-[20rem] place-items-center border border-dashed border-line bg-bg-800/20 px-6 py-16 text-center">
                <div>
                  <Users
                    size={30}
                    strokeWidth={1.5}
                    className="mx-auto mb-4 text-text-faint opacity-60"
                  />
                  <p className="font-display text-2xl text-text-dim">
                    Sem comparação ainda
                  </p>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-text-faint">
                    Escolha a lista atual e a anterior (ou um snapshot) e toque em
                    Comparar para ver quem entrou e quem saiu.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
