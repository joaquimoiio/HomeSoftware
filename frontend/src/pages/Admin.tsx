/**
 * Painel de admin — gestão de usuários (/admin, só admin).
 * Lista usuários, cadastra (gerando senha forte mostrada UMA vez), reseta senha,
 * ativa/desativa, promove/rebaixa e remove. Segue o design system: divisórias
 * finas, mono nos identificadores, sotaque âmbar só em ação/foco.
 */
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import {
  Check,
  Copy,
  KeyRound,
  Power,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  ApiError,
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  updateUser,
  type AdminUser,
  type UserWithPassword,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import { Shell } from "../components/Shell";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Faixa que mostra a senha gerada uma única vez, com botão copiar. */
function CredentialReveal({
  data,
  onDismiss,
}: {
  data: UserWithPassword;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.generated_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponível — usuário copia manualmente */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 border border-accent bg-accent-soft p-5"
    >
      <p className="font-mono text-[11px] uppercase tracking-widest text-accent">
        senha gerada para {data.user.username}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="font-mono text-lg text-text select-all break-all">
          {data.generated_password}
        </code>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5
                     text-sm text-text-dim hover:text-accent hover:border-accent
                     transition-colors"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "copiado" : "copiar"}
        </button>
      </div>
      <p className="mt-3 text-sm text-text-dim">
        Anote agora — esta senha aparece{" "}
        <span className="text-text">uma única vez</span>. O usuário será obrigado
        a trocá-la no primeiro acesso.
      </p>
      <button
        onClick={onDismiss}
        className="mt-3 text-xs text-text-faint hover:text-text transition-colors"
      >
        já anotei, esconder
      </button>
    </motion.div>
  );
}

export default function Admin() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState<UserWithPassword | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Falha ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const result = await createUser(newUsername.trim(), newIsAdmin);
      setReveal(result);
      setNewUsername("");
      setNewIsAdmin(false);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível cadastrar");
    } finally {
      setCreating(false);
    }
  }

  async function act(id: number, fn: () => Promise<unknown>) {
    setError(null);
    setBusyId(id);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ação falhou");
    } finally {
      setBusyId(null);
    }
  }

  function onReset(u: AdminUser) {
    if (!window.confirm(`Gerar nova senha para "${u.username}"?`)) return;
    act(u.id, async () => setReveal(await resetUserPassword(u.id)));
  }

  function onDelete(u: AdminUser) {
    if (!window.confirm(`Excluir o usuário "${u.username}"? Não dá para desfazer.`))
      return;
    act(u.id, () => deleteUser(u.id));
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl px-5 py-10 md:px-10">
        <PageHeader
          eyebrow="administração"
          title="Usuários"
          meta={`${users.length.toString().padStart(2, "0")} contas`}
        />

        {/* cadastro */}
        <section className="mt-8">
          <div className="flex items-center gap-2 text-text-dim">
            <UserPlus size={16} strokeWidth={1.75} className="text-accent" />
            <span className="font-mono text-[11px] uppercase tracking-widest">
              cadastrar usuário
            </span>
          </div>
          <form
            onSubmit={onCreate}
            className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Field
                id="new-username"
                label="usuário"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="ex.: maria"
                minLength={3}
                required
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-text-dim select-none">
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
                className="accent-[color:var(--accent)] h-4 w-4"
              />
              admin
            </label>
            <Button type="submit" disabled={creating}>
              <UserPlus size={17} strokeWidth={2} />
              {creating ? "Gerando…" : "Cadastrar"}
            </Button>
          </form>

          {reveal && (
            <CredentialReveal data={reveal} onDismiss={() => setReveal(null)} />
          )}
        </section>

        {error && (
          <p className="mt-6 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        {/* lista */}
        <section className="mt-10">
          {loading ? (
            <p className="font-mono text-xs uppercase tracking-widest text-text-faint">
              carregando…
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {users.map((u, i) => {
                const isMe = me?.id === u.id;
                const busy = busyId === u.id;
                return (
                  <motion.li
                    key={u.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className={
                      "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between " +
                      (u.is_active ? "" : "opacity-55")
                    }
                  >
                    {/* identidade */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-text truncate">
                          {u.username}
                        </span>
                        {u.is_admin && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono
                                           uppercase tracking-wider text-accent">
                            <ShieldCheck size={12} /> admin
                          </span>
                        )}
                        {!u.is_active && (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-text-faint">
                            inativo
                          </span>
                        )}
                        {isMe && (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-text-faint">
                            você
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-text-faint tabular-nums">
                        desde {formatDate(u.created_at)}
                        {u.must_change_password && " · senha pendente"}
                      </p>
                    </div>

                    {/* ações */}
                    <div className="flex items-center gap-1">
                      <IconAction
                        title="resetar senha"
                        disabled={busy}
                        onClick={() => onReset(u)}
                      >
                        <KeyRound size={16} />
                      </IconAction>
                      <IconAction
                        title={u.is_admin ? "rebaixar a comum" : "promover a admin"}
                        disabled={busy}
                        onClick={() =>
                          act(u.id, () =>
                            updateUser(u.id, { is_admin: !u.is_admin })
                          )
                        }
                      >
                        {u.is_admin ? (
                          <ShieldOff size={16} />
                        ) : (
                          <ShieldCheck size={16} />
                        )}
                      </IconAction>
                      <IconAction
                        title={u.is_active ? "desativar" : "ativar"}
                        disabled={busy}
                        accent={!u.is_active}
                        onClick={() =>
                          act(u.id, () =>
                            updateUser(u.id, { is_active: !u.is_active })
                          )
                        }
                      >
                        <Power size={16} />
                      </IconAction>
                      <IconAction
                        title="excluir"
                        disabled={busy}
                        danger
                        onClick={() => onDelete(u)}
                      >
                        <Trash2 size={16} />
                      </IconAction>
                    </div>
                  </motion.li>
                );
              })}
              {users.length === 0 && (
                <li className="py-10 text-center text-text-faint">
                  <Users size={28} className="mx-auto mb-3 opacity-50" />
                  Nenhum usuário ainda.
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}

function IconAction({
  children,
  title,
  onClick,
  disabled,
  danger,
  accent,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  accent?: boolean;
}) {
  const hover = danger
    ? "hover:text-neg hover:border-neg"
    : "hover:text-accent hover:border-accent";
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={
        "grid h-9 w-9 place-items-center border border-line transition-colors " +
        "disabled:opacity-40 " +
        (accent ? "text-accent " : "text-text-dim ") +
        hover
      }
    >
      {children}
    </button>
  );
}
