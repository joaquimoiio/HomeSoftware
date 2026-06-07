# 09 — Comparador de seguidores (sem banco)

**Status:** done

## Objetivo
Comparar duas listas de seguidores (JSON) e mostrar quem saiu, quem entrou e o
saldo — tudo em memória, com opção de salvar/usar snapshot de referência em disco.

## Skills a usar
- `backend-api` — router `/api/followers`: upload, parsing tolerante, comparação, snapshot.
- `frontend-ui` — tela de upload e resultado em duas colunas.
- `design-system` — colunas ganhos/perdidos, contadores em mono, estado vazio cuidado.

## Tasks
- [x] Endpoint de comparação: recebe lista atual + anterior (upload), processa em memória.
- [x] Parsing tolerante a formatos comuns; detectar e informar qual campo é o identificador.
- [x] Salvar snapshot da lista atual em `.json` numa **pasta por usuário**
      (`SNAPSHOT_DIR/<user_id>/`), NÃO no banco.
- [x] Comparar lista nova contra o snapshot salvo (do próprio usuário).
- [x] Tela: upload dos arquivos, resultado (saiu / entrou / contagens / saldo), botão snapshot.
- [x] Tratar JSON inválido com mensagem clara.

## Critérios de aceite
- Comparação correta (saiu/entrou/saldo) para exports comuns; nada salvo no SQLite.
- Snapshot grava e é reusável na próxima comparação; um usuário não acessa o
  snapshot de outro (pasta por usuário).
- JSON inválido não quebra o app (erro tratado).

## Dependências
- 02-autenticacao
- 03-design-base
