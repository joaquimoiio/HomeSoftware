/**
 * Tela de login — entrada do "command center".
 * Composição assimétrica: marca/relógio à esquerda (em telas largas), formulário
 * deslocado. Sotaque âmbar só no foco e na ação. Números em mono.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn, ShieldCheck } from "lucide-react";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Field } from "../components/Field";
import { Button } from "../components/Button";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Já logado? sai do login.
  useEffect(() => {
    if (user) navigate(user.must_change_password ? "/trocar-senha" : from, { replace: true });
  }, [user, from, navigate]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(username.trim(), password);
      navigate(u.must_change_password ? "/trocar-senha" : from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível entrar"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-full grid lg:grid-cols-[1.1fr_1fr]">
      {/* coluna editorial — some no mobile */}
      <section className="hidden lg:flex flex-col justify-between p-12 border-r border-line bg-bg-800">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
          painel de comando
        </p>
        <div>
          <h1 className="font-display text-6xl leading-[0.95]">
            Acesso ao
            <br />
            seu centro
            <br />
            de comando.
          </h1>
          <p className="text-text-dim mt-6 max-w-sm">
            Financeiro, agenda e métricas — tudo num lugar só, isolado por
            usuário e rodando na sua própria máquina.
          </p>
        </div>
        <div className="font-mono text-sm text-text-faint tabular-nums">
          {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          {" · "}
          {now.toLocaleTimeString("pt-BR")}
        </div>
      </section>

      {/* coluna do formulário */}
      <section className="grid place-items-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="flex items-center gap-2 text-accent">
            <ShieldCheck size={18} strokeWidth={1.75} />
            <span className="font-mono text-[11px] uppercase tracking-widest">
              entrar
            </span>
          </div>
          <h2 className="font-display text-3xl mt-3">Bem-vindo de volta</h2>

          <div className="mt-8 space-y-6">
            <Field
              id="username"
              label="usuário"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Field
              id="password"
              label="senha"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="mt-5 text-sm text-neg" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy} className="mt-8 w-full">
            <LogIn size={18} strokeWidth={2} />
            {busy ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
