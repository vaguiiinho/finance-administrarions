---
description: Executa o ciclo completo de uma feature com os subagentes
argument-hint: <descrição da feature>
---
Feature: $ARGUMENTS

Execute em ordem, delegando cada etapa ao subagente indicado e passando
os caminhos dos arquivos gerados na etapa anterior:

1. `planner` → gera a spec em docs/specs/. Na spec, marque explicitamente
   se a feature **tem interface nova ou alterada** (campo "Impacto em UI: sim/não").
2. `architect` → gera o ADR em docs/adr/.
3. `ui-designer` → **somente se "Impacto em UI: sim"** na spec.
   Gera docs/design/<feature>.md. Pule esta etapa para features só de backend.
4. PARE e apresente um resumo da spec, do ADR e (se houver) do design.
   Aguarde minha aprovação.
5. `tester` (modo RED) → escreve os testes que falham.
6. `backend-dev` → tarefas [api] e [db].
   `frontend-dev` → tarefas [web], seguindo docs/design/<feature>.md quando existir.
7. `tester` (modo VERIFICAÇÃO) → roda a suíte e a cobertura.
8. `code-reviewer` → revisa. Se houver itens 🔴, devolva ao dev e repita 6–8 (máx. 3 ciclos).
9. `doc-writer` → atualiza a documentação.

Ao final, resuma o que foi feito, os arquivos criados e pendências.