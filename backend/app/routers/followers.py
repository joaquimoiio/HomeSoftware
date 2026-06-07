"""Router do comparador de seguidores — /api/followers (SEM banco).

Compara duas listas de seguidores (JSON) **em memória**: quem saiu, quem entrou,
contagens e saldo. Nada é gravado no SQLite. Opcionalmente guarda um **snapshot**
da lista atual em disco para, numa próxima vez, subir só a lista nova e comparar
contra ele — os snapshots vivem numa **pasta por usuário** (`SNAPSHOT_DIR/<id>/`),
então um usuário nunca enxerga o snapshot de outro.

Parsing **tolerante** aos formatos comuns de export (Instagram, listas de objetos
com `username`/`handle`/`value`, listas de strings) e que **informa qual campo** foi
usado como identificador. JSON inválido vira 400 com mensagem clara, nunca 500.
"""
import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from ..core.config import settings
from ..core.security import get_current_user
from ..models.user import User

router = APIRouter(
    prefix="/api/followers",
    tags=["followers"],
    dependencies=[Depends(get_current_user)],
)

# Teto de tamanho do upload — exports de seguidores são pequenos; isto protege a
# RAM do Pi de um arquivo enorme acidental.
MAX_BYTES = 15 * 1024 * 1024  # 15 MB

# Campos comuns de username em exports de objetos, em ordem de preferência.
IDENT_FIELDS = ("username", "handle", "value", "screen_name", "login", "name")
# Chaves comuns que embrulham a lista num objeto (Instagram e afins).
LIST_KEYS = (
    "relationships_followers",
    "relationships_following",
    "followers",
    "following",
    "users",
    "data",
    "list",
)


# --- schemas -----------------------------------------------------------------
class Comparacao(BaseModel):
    campo_atual: str  # qual campo foi usado como identificador na lista atual
    campo_anterior: str
    total_atual: int
    total_anterior: int
    entrou: list[str]  # estão na atual, não estavam na anterior
    saiu: list[str]  # estavam na anterior, não estão na atual
    ganhos: int
    perdidos: int
    saldo: int  # total_atual - total_anterior
    fonte_anterior: str  # "upload" | "snapshot"


class SnapshotInfo(BaseModel):
    existe: bool
    total: int
    campo: str | None
    salvo_em: str | None  # ISO (naive, hora local) de quando foi salvo


# --- parsing tolerante -------------------------------------------------------
def _achar_lista(data: object) -> list | None:
    """Acha a lista de seguidores: a raiz já é lista, ou está sob uma chave."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in LIST_KEYS:
            v = data.get(k)
            if isinstance(v, list):
                return v
        # fallback: a primeira lista que aparecer entre os valores.
        for v in data.values():
            if isinstance(v, list):
                return v
    return None


def _ident_de_item(item: object) -> tuple[str | None, str | None]:
    """Extrai (username, campo) de um item; (None, None) se não der."""
    if isinstance(item, str):
        v = item.strip()
        return (v, "(texto)") if v else (None, None)
    if isinstance(item, dict):
        # formato Instagram: string_list_data[0].value
        sld = item.get("string_list_data")
        if isinstance(sld, list) and sld and isinstance(sld[0], dict):
            v = sld[0].get("value")
            if isinstance(v, str) and v.strip():
                return v.strip(), "string_list_data[].value"
        for campo in IDENT_FIELDS:
            v = item.get(campo)
            if isinstance(v, str) and v.strip():
                return v.strip(), campo
    return None, None


def _extrair(data: object) -> tuple[list[str], str]:
    """Lista de usernames (sem duplicar, sem diferenciar maiúsc.) + campo usado.

    Levanta ValueError com mensagem clara quando não reconhece o formato — o
    chamador converte em HTTPException 400.
    """
    lista = _achar_lista(data)
    if lista is None:
        raise ValueError("não encontrei uma lista de seguidores no JSON")

    seguidores: list[str] = []
    vistos: set[str] = set()
    campo: str | None = None
    for item in lista:
        valor, c = _ident_de_item(item)
        if valor is None:
            continue
        if campo is None:
            campo = c
        chave = valor.lower()
        if chave not in vistos:
            vistos.add(chave)
            seguidores.append(valor)

    if campo is None:
        raise ValueError(
            "não identifiquei o campo de username nos itens (esperado um de: "
            + ", ".join(IDENT_FIELDS)
            + ", string_list_data[].value, ou texto puro)"
        )
    return seguidores, campo


def _comparar(atual: list[str], anterior: list[str]) -> tuple[list[str], list[str]]:
    """(saiu, entrou) comparando sem diferenciar maiúsculas, exibindo original."""
    map_atual = {a.lower(): a for a in atual}
    map_ant = {a.lower(): a for a in anterior}
    saiu = sorted(
        (map_ant[k] for k in map_ant if k not in map_atual), key=str.lower
    )
    entrou = sorted(
        (map_atual[k] for k in map_atual if k not in map_ant), key=str.lower
    )
    return saiu, entrou


async def _ler_json(arquivo: UploadFile) -> object:
    """Lê o upload e faz o parse de JSON, com erros claros (400) — nunca 500."""
    raw = await arquivo.read()
    nome = arquivo.filename or "arquivo"
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"O arquivo '{nome}' está vazio.",
        )
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"O arquivo '{nome}' é grande demais (máx. 15 MB).",
        )
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        msg = getattr(e, "msg", str(e))
        linha = getattr(e, "lineno", None)
        onde = f" (linha {linha})" if linha else ""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"JSON inválido em '{nome}': {msg}{onde}.",
        )


def _extrair_ou_400(data: object, nome: str) -> tuple[list[str], str]:
    try:
        return _extrair(data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Em '{nome}': {e}.",
        )


# --- snapshot em disco (por usuário) -----------------------------------------
def _snap_path(user_id: int) -> Path:
    # user_id é um int vindo do token — sem risco de path traversal.
    return Path(settings.SNAPSHOT_DIR) / str(user_id) / "followers.json"


def _carregar_snapshot(user_id: int) -> dict | None:
    p = _snap_path(user_id)
    if not p.is_file():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if not isinstance(data, dict) or not isinstance(data.get("seguidores"), list):
        return None
    return data


# --- endpoints ---------------------------------------------------------------
@router.post("/compare", response_model=Comparacao)
async def compare(
    atual: UploadFile = File(..., description="Lista atual de seguidores (JSON)"),
    anterior: UploadFile | None = File(
        None, description="Lista anterior (JSON). Se ausente, usa o snapshot salvo."
    ),
    user: User = Depends(get_current_user),
):
    """Compara a lista atual com a anterior (upload) ou com o snapshot salvo."""
    data_atual = await _ler_json(atual)
    lista_atual, campo_atual = _extrair_ou_400(data_atual, atual.filename or "atual")

    if anterior is not None:
        data_ant = await _ler_json(anterior)
        lista_ant, campo_ant = _extrair_ou_400(
            data_ant, anterior.filename or "anterior"
        )
        fonte = "upload"
    else:
        snap = _carregar_snapshot(user.id)
        if snap is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Nenhuma lista anterior enviada e você ainda não tem um "
                    "snapshot salvo. Envie as duas listas ou salve um snapshot antes."
                ),
            )
        lista_ant = [s for s in snap["seguidores"] if isinstance(s, str)]
        campo_ant = snap.get("campo") or "(snapshot)"
        fonte = "snapshot"

    saiu, entrou = _comparar(lista_atual, lista_ant)
    return Comparacao(
        campo_atual=campo_atual,
        campo_anterior=campo_ant,
        total_atual=len(lista_atual),
        total_anterior=len(lista_ant),
        entrou=entrou,
        saiu=saiu,
        ganhos=len(entrou),
        perdidos=len(saiu),
        saldo=len(lista_atual) - len(lista_ant),
        fonte_anterior=fonte,
    )


@router.post("/snapshot", response_model=SnapshotInfo)
async def save_snapshot(
    atual: UploadFile = File(..., description="Lista a guardar como referência"),
    user: User = Depends(get_current_user),
):
    """Guarda a lista atual como snapshot de referência do usuário (em disco)."""
    data = await _ler_json(atual)
    lista, campo = _extrair_ou_400(data, atual.filename or "atual")

    salvo_em = datetime.now().isoformat(timespec="seconds")
    payload = {"campo": campo, "salvo_em": salvo_em, "seguidores": lista}
    path = _snap_path(user.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    return SnapshotInfo(existe=True, total=len(lista), campo=campo, salvo_em=salvo_em)


@router.get("/snapshot", response_model=SnapshotInfo)
async def get_snapshot(user: User = Depends(get_current_user)):
    """Metadados do snapshot salvo (para a UI saber que há referência)."""
    snap = _carregar_snapshot(user.id)
    if snap is None:
        return SnapshotInfo(existe=False, total=0, campo=None, salvo_em=None)
    return SnapshotInfo(
        existe=True,
        total=len(snap["seguidores"]),
        campo=snap.get("campo"),
        salvo_em=snap.get("salvo_em"),
    )


@router.delete("/snapshot", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot(user: User = Depends(get_current_user)):
    """Apaga o snapshot do usuário, se existir (idempotente)."""
    p = _snap_path(user.id)
    try:
        p.unlink(missing_ok=True)
    except OSError:
        pass
