# Projeto

`api` (NestJS , Prisma, PostgreSQL) e `web` (Next.js App Router).

## Arquitetura (api)
Clean Architecture + DDD. Dependências apontam sempre para dentro:

src/modules/<contexto>/
  domain/          # entities, value-objects, aggregates, domain-events, repository interfaces
  application/     # use-cases, DTOs, ports
  infrastructure/  # prisma repositories, mappers, adapters externos
  presentation/    # controllers, guards, pipes (HTTP)

Regras inegociáveis:
- `domain` não importa NestJS, Prisma nem nada externo.
- Use cases dependem de interfaces (ports), nunca de implementações.
- Prisma só existe em `infrastructure`. Entidades de domínio ≠ models do Prisma (usar mappers).
- SOLID em todo código novo. Injeção de dependência por token/interface.

## Testes
- Domain e use cases: unitários, sem I/O.
- Repositórios: integração com Postgres real (testcontainers).
- Controllers: e2e com supertest.
- Todo código novo exige teste. Cobertura mínima de 80% em domain/application.

## Fluxo de trabalho para features
planner → architect → ui-designer (só se houver UI) → [aprovação] → tester (red)
→ backend-dev / frontend-dev → tester (verifica) → code-reviewer → doc-writer