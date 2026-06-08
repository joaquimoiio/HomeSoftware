# 12 — Remover "categoria" do financeiro

**Status:** done

## Objetivo
Eliminar completamente o conceito de "categoria" no módulo financeiro (model,
API e UI), simplificando o lançamento para apenas tipo/valor/descrição/data.

## Skills a usar
- data-model — remover a coluna `categoria` de `Lancamento` e recriar o schema do
  banco (banco de testes é descartável, sem necessidade de migração preservando dados).
- backend-api — remover o campo `categoria` dos schemas (criação/edição/resposta) e
  do validador, o filtro `?categoria=`, e excluir o schema `PontoCategoria` + o
  endpoint `GET /finance/resumo/por-categoria`.
- frontend-ui — remover o input de categoria do formulário, a exibição da categoria
  na lista, o gráfico "saídas por categoria" (`GraficoPorCategoria`), e os
  tipos/função `getResumoPorCategoria`/`PontoCategoria` em `api.ts`.
- design-system — reequilibrar o layout da tela Financeiro após remover o gráfico de
  categorias, mantendo a identidade visual (não deixar buraco/grid quebrado).

## Tasks
- [ ] Backend model: remover `categoria` de `Lancamento` (`backend/app/models/finance.py`).
- [ ] Backend router: remover `categoria` dos schemas e validador, do filtro de listagem,
      do create/update e da resposta (`backend/app/routers/finance.py`).
- [ ] Backend router: remover `PontoCategoria` e o endpoint `/resumo/por-categoria`.
- [ ] Recriar o banco SQLite de testes para refletir o schema sem a coluna.
- [ ] Frontend `api.ts`: remover `categoria` dos tipos, `PontoCategoria` e `getResumoPorCategoria`.
- [ ] Frontend `Financeiro.tsx`: remover input, estado, exibição na lista e o
      componente `GraficoPorCategoria` (incluindo a chamada e o estado `porCategoria`).
- [ ] Ajustar o layout/grid da tela após remover o gráfico (design-system).

## Critérios de aceite
- Nenhuma ocorrência de "categoria" no código do financeiro (backend e frontend).
- Criar/editar lançamento funciona apenas com tipo, valor, descrição e data.
- A tela Financeiro carrega sem erros e sem o gráfico de categorias, com layout coerente.
- Backend sobe sem erros e os endpoints restantes (`resumo/por-mes`, listagem, saldo)
  continuam funcionando.

## Dependências
- 05 (Financeiro: fluxo de caixa) — feita.
