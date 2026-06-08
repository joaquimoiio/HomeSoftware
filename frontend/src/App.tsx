/**
 * Roteamento + guarda de autenticação.
 * Tudo fica atrás do login (ProtectedRoute). Quem tem must_change_password é
 * levado a /trocar-senha antes de usar o app. O hub e os módulos chegam nas
 * próximas sprints — aqui o "/" é só um placeholder protegido.
 */
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Admin from "./pages/Admin";
import Hub from "./pages/Hub";
import Financeiro from "./pages/Financeiro";
import Patrimonio from "./pages/Patrimonio";
import Dividas from "./pages/Dividas";
import Agenda from "./pages/Agenda";
import WorkLog from "./pages/WorkLog";
import Seguidores from "./pages/Seguidores";

function Loader() {
  return (
    <main className="min-h-full grid place-items-center">
      <p className="font-mono text-xs uppercase tracking-widest text-text-faint">
        carregando…
      </p>
    </main>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loader />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.must_change_password && location.pathname !== "/trocar-senha")
    return <Navigate to="/trocar-senha" replace />;
  return <>{children}</>;
}

// Rotas só para admin: reaproveita o ProtectedRoute e, se não for admin, manda
// pro hub (não vaza a existência do painel para usuário comum).
function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user && !user.is_admin) return <Navigate to="/" replace />;
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/trocar-senha"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <ProtectedRoute>
            <Financeiro />
          </ProtectedRoute>
        }
      />
      <Route
        path="/financeiro/patrimonio"
        element={
          <ProtectedRoute>
            <Patrimonio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/financeiro/dividas"
        element={
          <ProtectedRoute>
            <Dividas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agenda"
        element={
          <ProtectedRoute>
            <Agenda />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agenda/worklog"
        element={
          <ProtectedRoute>
            <WorkLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seguidores"
        element={
          <ProtectedRoute>
            <Seguidores />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Hub />
          </ProtectedRoute>
        }
      />
      {/* rota desconhecida → hub (que decide login/troca-senha) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
