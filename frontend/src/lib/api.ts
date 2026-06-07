/**
 * Cliente HTTP fino para a API (/api/*).
 * Envia o cookie de sessão e, por padrão, trata 401 redirecionando ao login.
 * Chamadas que precisam inspecionar o 401 (ex.: checar quem está logado) passam
 * `{ redirectOn401: false }` e tratam o erro localmente.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ApiInit = RequestInit & { redirectOn401?: boolean };

export async function api<T>(path: string, init?: ApiInit): Promise<T> {
  const { redirectOn401 = true, ...rest } = init ?? {};
  // FormData (uploads) define o próprio Content-Type com boundary — não forçar JSON.
  const isForm = rest.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(rest.headers ?? {}),
    },
    ...rest,
  });

  if (res.status === 401 && redirectOn401) {
    window.location.href = "/login";
    throw new ApiError(401, "não autenticado");
  }
  if (!res.ok) {
    let detail = `erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* corpo sem JSON — mantém a mensagem padrão */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- auth --------------------------------------------------------------------
export type User = {
  id: number;
  username: string;
  is_admin: boolean;
  must_change_password: boolean;
};

export function getMe(): Promise<User | null> {
  return api<User>("/auth/me", { redirectOn401: false }).catch((e) => {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  });
}

export function login(username: string, password: string): Promise<User> {
  return api<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    redirectOn401: false,
  });
}

export function logout(): Promise<void> {
  return api<void>("/auth/logout", { method: "POST", redirectOn401: false });
}

export function changePassword(
  current_password: string,
  new_password: string
): Promise<User> {
  return api<User>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
    redirectOn401: false,
  });
}

// --- admin (gestão de usuários) ---------------------------------------------
export type AdminUser = {
  id: number;
  username: string;
  is_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
};

export type UserWithPassword = {
  user: AdminUser;
  generated_password: string;
};

export function listUsers(): Promise<AdminUser[]> {
  return api<AdminUser[]>("/admin/users");
}

export function createUser(
  username: string,
  is_admin = false
): Promise<UserWithPassword> {
  return api<UserWithPassword>("/admin/users", {
    method: "POST",
    body: JSON.stringify({ username, is_admin }),
  });
}

export function resetUserPassword(id: number): Promise<UserWithPassword> {
  return api<UserWithPassword>(`/admin/users/${id}/reset-password`, {
    method: "POST",
  });
}

export function updateUser(
  id: number,
  patch: { is_active?: boolean; is_admin?: boolean }
): Promise<AdminUser> {
  return api<AdminUser>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteUser(id: number): Promise<void> {
  return api<void>(`/admin/users/${id}`, { method: "DELETE" });
}

// --- financeiro: fluxo de caixa ---------------------------------------------
export type TipoLancamento = "entrada" | "saida";

export type Lancamento = {
  id: number;
  tipo: TipoLancamento;
  valor: number; // reais
  descricao: string;
  categoria: string;
  data: string; // YYYY-MM-DD
};

export type LancamentoInput = {
  tipo: TipoLancamento;
  valor: number;
  descricao: string;
  categoria: string;
  data: string;
};

export type Resumo = { entradas: number; saidas: number; saldo: number };
export type PontoMes = {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
};
export type PontoCategoria = { categoria: string; total: number };

export type Periodo = { inicio?: string; fim?: string };

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function listLancamentos(
  filtro: Periodo & { categoria?: string; tipo?: TipoLancamento } = {}
): Promise<Lancamento[]> {
  return api<Lancamento[]>(`/finance/lancamentos${qs(filtro)}`);
}

export function createLancamento(data: LancamentoInput): Promise<Lancamento> {
  return api<Lancamento>("/finance/lancamentos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateLancamento(
  id: number,
  data: LancamentoInput
): Promise<Lancamento> {
  return api<Lancamento>(`/finance/lancamentos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteLancamento(id: number): Promise<void> {
  return api<void>(`/finance/lancamentos/${id}`, { method: "DELETE" });
}

export function getResumo(periodo: Periodo = {}): Promise<Resumo> {
  return api<Resumo>(`/finance/resumo${qs(periodo)}`);
}

export function getResumoPorMes(periodo: Periodo = {}): Promise<PontoMes[]> {
  return api<PontoMes[]>(`/finance/resumo/por-mes${qs(periodo)}`);
}

export function getResumoPorCategoria(
  periodo: Periodo & { tipo?: TipoLancamento } = {}
): Promise<PontoCategoria[]> {
  return api<PontoCategoria[]>(`/finance/resumo/por-categoria${qs(periodo)}`);
}

// --- financeiro: patrimônio --------------------------------------------------
export type TipoItem = "reserva" | "investimento";

export type ItemPatrimonio = {
  id: number;
  nome: string;
  valor: number; // reais
  tipo: TipoItem;
  atualizado_em: string; // ISO datetime
};

export type ItemPatrimonioInput = {
  nome: string;
  valor: number;
  tipo: TipoItem;
};

export type ResumoPatrimonio = {
  guardado: number;
  investido: number;
  total: number;
};

export type PontoHistorico = { valor: number; registrado_em: string };

export function listPatrimonio(
  filtro: { tipo?: TipoItem } = {}
): Promise<ItemPatrimonio[]> {
  return api<ItemPatrimonio[]>(`/finance/patrimonio${qs(filtro)}`);
}

export function createItemPatrimonio(
  data: ItemPatrimonioInput
): Promise<ItemPatrimonio> {
  return api<ItemPatrimonio>("/finance/patrimonio", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateItemPatrimonio(
  id: number,
  data: ItemPatrimonioInput
): Promise<ItemPatrimonio> {
  return api<ItemPatrimonio>(`/finance/patrimonio/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteItemPatrimonio(id: number): Promise<void> {
  return api<void>(`/finance/patrimonio/${id}`, { method: "DELETE" });
}

export function getResumoPatrimonio(): Promise<ResumoPatrimonio> {
  return api<ResumoPatrimonio>("/finance/patrimonio/resumo");
}

export function getHistoricoPatrimonio(id: number): Promise<PontoHistorico[]> {
  return api<PontoHistorico[]>(`/finance/patrimonio/${id}/historico`);
}

// --- financeiro: dívidas e parcelas -----------------------------------------
export type Parcela = {
  id: number;
  numero: number;
  valor: number; // reais
  paga: boolean;
  vencimento: string | null; // YYYY-MM-DD
};

export type DividaResumo = {
  total: number;
  pago: number;
  falta: number;
  parcelas_totais: number;
  parcelas_pagas: number;
  parcelas_restantes: number;
};

export type Divida = {
  id: number;
  nome: string;
  resumo: DividaResumo;
};

export type DividaDetail = Divida & { parcelas: Parcela[] };

export type ResumoGeralDividas = {
  total_devido: number;
  total_pago: number;
  total_a_pagar: number;
  dividas: number;
};

export type ParcelaInput = { valor: number; vencimento?: string | null };

/** Criação de dívida — dois modos exclusivos: parcelas iguais ou diferentes. */
export type DividaCreate =
  | {
      nome: string;
      modo: "iguais";
      num_parcelas: number;
      valor_parcela: number;
      primeiro_vencimento?: string | null;
    }
  | {
      nome: string;
      modo: "diferentes";
      parcelas: ParcelaInput[];
    };

export function listDividas(): Promise<Divida[]> {
  return api<Divida[]>("/finance/dividas");
}

export function getDivida(id: number): Promise<DividaDetail> {
  return api<DividaDetail>(`/finance/dividas/${id}`);
}

export function createDivida(data: DividaCreate): Promise<DividaDetail> {
  return api<DividaDetail>("/finance/dividas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateDivida(id: number, nome: string): Promise<DividaDetail> {
  return api<DividaDetail>(`/finance/dividas/${id}`, {
    method: "PUT",
    body: JSON.stringify({ nome }),
  });
}

export function deleteDivida(id: number): Promise<void> {
  return api<void>(`/finance/dividas/${id}`, { method: "DELETE" });
}

export function updateParcela(
  dividaId: number,
  parcelaId: number,
  patch: { paga?: boolean; valor?: number; vencimento?: string | null }
): Promise<DividaDetail> {
  return api<DividaDetail>(
    `/finance/dividas/${dividaId}/parcelas/${parcelaId}`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
}

export function getResumoDividas(): Promise<ResumoGeralDividas> {
  return api<ResumoGeralDividas>("/finance/dividas/resumo");
}

// --- agenda: eventos do calendário ------------------------------------------
export type Recorrencia = "nenhuma" | "diaria" | "semanal" | "mensal";
export type CorEvento =
  | "amber"
  | "azul"
  | "verde"
  | "roxo"
  | "rosa"
  | "petroleo"
  | "vermelho"
  | "cinza";

/** Evento-base, como persiste no banco (usado ao abrir para editar). */
export type Evento = {
  id: number;
  titulo: string;
  descricao: string | null;
  inicio: string; // "YYYY-MM-DDTHH:MM:SS" (naive local)
  fim: string;
  dia_inteiro: boolean;
  local: string | null;
  cor: CorEvento;
  recorrencia: Recorrencia;
};

/** Uma ocorrência concreta dentro do intervalo consultado. */
export type Ocorrencia = Evento & { recorrente: boolean };

export type EventoInput = {
  titulo: string;
  descricao?: string | null;
  inicio: string;
  fim: string;
  dia_inteiro: boolean;
  local?: string | null;
  cor: CorEvento;
  recorrencia: Recorrencia;
};

/** Lista as ocorrências (recorrência já expandida) numa janela [inicio, fim]. */
export function listEventos(inicio: string, fim: string): Promise<Ocorrencia[]> {
  return api<Ocorrencia[]>(`/calendar/eventos${qs({ inicio, fim })}`);
}

export function getEvento(id: number): Promise<Evento> {
  return api<Evento>(`/calendar/eventos/${id}`);
}

export function createEvento(data: EventoInput): Promise<Evento> {
  return api<Evento>("/calendar/eventos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEvento(id: number, data: EventoInput): Promise<Evento> {
  return api<Evento>(`/calendar/eventos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteEvento(id: number): Promise<void> {
  return api<void>(`/calendar/eventos/${id}`, { method: "DELETE" });
}

// --- comparador de seguidores (sem banco; snapshots em disco) ----------------
export type Comparacao = {
  campo_atual: string;
  campo_anterior: string;
  total_atual: number;
  total_anterior: number;
  entrou: string[]; // estão na atual, não estavam na anterior
  saiu: string[]; // estavam na anterior, não estão na atual
  ganhos: number;
  perdidos: number;
  saldo: number;
  fonte_anterior: "upload" | "snapshot";
};

export type SnapshotInfo = {
  existe: boolean;
  total: number;
  campo: string | null;
  salvo_em: string | null; // ISO naive local
};

/** Compara a lista atual com a anterior; sem `anterior`, usa o snapshot salvo. */
export function compararSeguidores(
  atual: File,
  anterior?: File | null
): Promise<Comparacao> {
  const fd = new FormData();
  fd.append("atual", atual);
  if (anterior) fd.append("anterior", anterior);
  return api<Comparacao>("/followers/compare", { method: "POST", body: fd });
}

/** Guarda a lista atual como snapshot de referência (em disco, por usuário). */
export function salvarSnapshot(atual: File): Promise<SnapshotInfo> {
  const fd = new FormData();
  fd.append("atual", atual);
  return api<SnapshotInfo>("/followers/snapshot", { method: "POST", body: fd });
}

export function getSnapshot(): Promise<SnapshotInfo> {
  return api<SnapshotInfo>("/followers/snapshot");
}

export function deleteSnapshot(): Promise<void> {
  return api<void>("/followers/snapshot", { method: "DELETE" });
}
