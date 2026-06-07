/**
 * Troca de senha — usada no fluxo forçado do 1º acesso (must_change_password)
 * e também voluntariamente. Ao concluir, atualiza o usuário e vai pro hub.
 */
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { ApiError, changePassword } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Field } from "../components/Field";
import { Button } from "../components/Button";

export default function ChangePassword() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.must_change_password;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres");
      return;
    }
    if (next !== confirm) {
      setError("A confirmação não confere com a nova senha");
      return;
    }
    setBusy(true);
    try {
      const u = await changePassword(current, next);
      setUser(u);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível trocar a senha"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-full grid place-items-center p-8">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <div className="flex items-center gap-2 text-accent">
          <KeyRound size={18} strokeWidth={1.75} />
          <span className="font-mono text-[11px] uppercase tracking-widest">
            segurança
          </span>
        </div>
        <h2 className="font-display text-3xl mt-3">
          {forced ? "Defina sua senha" : "Trocar senha"}
        </h2>
        {forced && (
          <p className="text-text-dim mt-3 text-sm">
            É seu primeiro acesso. Escolha uma senha nova antes de continuar.
          </p>
        )}

        <div className="mt-8 space-y-6">
          <Field
            id="current"
            label="senha atual"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <Field
            id="next"
            label="nova senha"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <Field
            id="confirm"
            label="confirmar nova senha"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="mt-5 text-sm text-neg" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy} className="mt-8 w-full">
          {busy ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </main>
  );
}
