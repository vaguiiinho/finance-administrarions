# Avaliação do uso do Claude Code no projeto

**Data da auditoria:** 2026-11-01

**Escopo:** código atual de `api/` e `web/`, instruções e subagents em `.claude/`, documentação de specs/ADRs/design/runs e histórico Git de 2026-10-24 a 2026-11-01.

## Resumo executivo

**Conclusão:** a qualidade técnica entregue é alta; a eficiência operacional do fluxo de agents é moderada. O processo agrega valor em trabalho transversal e com decisões de negócio, mas foi aplicado com muitos handoffs, retomadas e ciclos de revisão. Há oportunidades concretas para reduzir custo e ruído sem abandonar testes, revisão ou rastreabilidade.

| Área | Avaliação |
|---|---|
| NestJS, DDD e separação de camadas | **Forte.** Entidades e regras centrais estão no domínio; Prisma está em infraestrutura; há teste automatizado das fronteiras. |
| Regras de negócio | **Forte.** Regras financeiras importantes aparecem em aggregates, value objects, services e casos de uso, em vez de serem mantidas só na UI. |
| Prisma e SQL | **Adequado, com custo de manutenção.** Há SQL explícito, mas restrito à infraestrutura e construído com `Prisma.sql`; não encontrei uso dos métodos `Unsafe`. |
| Next.js App Router e chamadas à API | **Alinhado.** Rotas finas, leitura no servidor, `server-only`, chamadas ao Nest por `fetch` e mutações por Server Actions. |
| Interação direta com o DOM | **Adequada e localizada.** Uso para foco, eventos e medidas de elementos em componentes client; não encontrei renderização manual de HTML de dados de usuário. |
| Orquestração de agents | **Eficaz para features grandes; pesada para mudanças menores.** Existem etapas e entregáveis claros, mas as execuções registram muitas retomadas e rodadas adicionais. |
| Documentação de decisões e execuções | **Útil, mas desigual e com trechos obsoletos.** Preserva experimentos e divergências, porém repete bastante conteúdo e não mantém todas as fontes sincronizadas. |

Não há dados confiáveis de duração, tokens ou custo por execução no repositório. Portanto, a eficiência foi avaliada por evidências observáveis — número de etapas/handoffs registrados, retomadas, ciclos de revisão, resultado de testes e volume/documentação — e não por uma estimativa de custo ou produtividade por hora.

## 1. NestJS: domínio, casos de uso, repositórios e eventos

### O que funcionou

A organização em `domain/`, `application/`, `infrastructure/` e `presentation/` está presente nos contextos `finance` e `identity`, e corresponde à intenção descrita em [CLAUDE.md](../../CLAUDE.md#L12). O teste de arquitetura verifica que o domínio não importa NestJS/Prisma, que application não depende de infrastructure/presentation e que Prisma permanece em infrastructure ([architecture.spec.ts](../../api/test/architecture.spec.ts#L26)).

Há exemplos concretos de regras no lugar certo:

- [Entry](../../api/src/modules/finance/domain/entry/entry.ts#L44) valida invariantes ao criar e restaurar o aggregate; calcula status inicial, mês de referência e datas de fatura para cartão.
- [EntryPaymentService](../../api/src/modules/finance/domain/payment/entry-payment.service.ts#L14) impede que um pagamento em lote altere despesas antes de detectar todas as receitas inválidas.
- [resolveInitialMonth](../../api/src/modules/finance/domain/initial-month/resolve-initial-month.ts#L21) implementa uma regra pura de domínio, recebendo o mês atual como dado.
- [PayEntriesInBatch](../../api/src/modules/finance/application/use-cases/entries/pay-entries-in-batch.ts#L27) coordena validação, isolamento por proprietário, unidade de trabalho e publicação de eventos; a transação e os adapters concretos ficam fora do domínio.

Os use cases dependem de portas, e o mapeamento para Prisma é ligado em [finance-infrastructure.providers.ts](../../api/src/modules/finance/infrastructure/finance-infrastructure.providers.ts). Não encontrei regra central de cartão, faturamento ou pagamento implementada somente no frontend. Filtros e defaults de URL mantidos no web são comportamento de apresentação, não substitutos dessas invariantes.

### Simplificação a considerar: eventos sem consumidores

O domínio registra eventos e os use cases publicam por uma interface, mas o adapter atual declara explicitamente que não há assinantes: [InProcessEventPublisher](../../api/src/shared/infrastructure/in-process-event-publisher.ts#L4). É um ponto de extensão legítimo, não um defeito funcional; no estado atual, porém, o port, a coleta dos eventos e as chamadas de publicação não produzem efeito.

**Recomendação:** se não há consumidor previsto no escopo próximo, remover ou postergar a infraestrutura de publicação. Se eventos passarem a acionar efeitos que precisam sobreviver a falhas, definir consumidor e estratégia transacional (por exemplo, outbox) antes de tratar a publicação in-process como garantia de entrega.

## 2. Prisma e SQL explícito

Há SQL explícito em repositórios/read models de `finance` e em partes de `identity`, sempre dentro de `infrastructure`. As queries utilizam `Prisma.sql` com valores interpolados como parâmetros; os `Prisma.raw` encontrados são fragmentos estáticos de colunas em [entry-sql.ts](../../api/src/modules/finance/infrastructure/mappers/entry-sql.ts#L7). Não encontrei `queryRawUnsafe` ou `executeRawUnsafe` em código de produção.

Há razões técnicas visíveis para parte desse SQL:

- agregações com `FILTER`, `HAVING` e `to_char` nos read models de faturas/resumos;
- `FOR UPDATE`, `unnest` e atualização atômica no [PrismaEntryRepository](../../api/src/modules/finance/infrastructure/repositories/prisma-entry.repository.ts#L18);
- paginação e subtotal obtidos no mesmo snapshot em [PrismaEntryReadModel](../../api/src/modules/finance/infrastructure/read-models/entry-read-model.prisma.ts#L28).

**Conclusão:** o SQL estar legível no código não representa, por si só, vazamento de arquitetura nem falha de segurança. A localização, parametrização e mapeamento para tipos de domínio são bons. O trade-off é perder parte da verificação de schema/tipos que o Prisma gera: aliases e formatos retornados são contratos mantidos manualmente.

**Melhoria:** manter SQL nos casos em que os recursos do PostgreSQL, bloqueios, consistência ou desempenho o justificam; preferir Prisma Client para CRUD simples; para cada query raw importante, registrar a razão e manter testes de integração e, quando relevante, planos/desempenho. Não há evidência que justifique substituir todas as queries por Prisma Client.

## 3. Next.js: estrutura, DOM e chamadas à API

### Organização `app/` e `features/`

As páginas em `web/app/` funcionam como adaptadores de rota: por exemplo, [entries/page.tsx](<../../web/app/(protected)/entries/page.tsx#L9>) prepara parâmetros/leitor e delega à tela [EntriesScreen](../../web/features/entries/entries-screen.tsx#L35). A lógica visual e os componentes de uma feature ficam em `web/features/<feature>/`; grupos `(protected)`, `(public)` e `(auth)` organizam segmentos sem mudar a URL.

Isso é compatível com o App Router. A documentação do Next.js não exige que a pasta se chame `features`: ela permite organizar o código junto a `app/` ou fora dela, mantendo os arquivos especiais de roteamento no lugar convencionado. Portanto, `app/` encaminhando para `features/` é uma convenção válida e clara, não um requisito oficial nem uma violação. A separação atual ajuda a evitar que o código de domínio visual fique misturado às convenções de rota.

### Server Components e fluxo para a API

As páginas e painéis são Server Components por padrão; os painéis assíncronos carregam dados e o `Suspense` delimita estados de espera ([EntriesScreen](../../web/features/entries/entries-screen.tsx#L53)). A documentação atual recomenda Server Components para buscar dados de APIs perto da origem e permite chamar APIs REST já existentes por `fetch`, especialmente quando há um backend separado. Também recomenda centralizar o acesso em uma camada server-only com autorização e DTOs.

O projeto segue esse desenho:

- [finance-reader.ts](../../web/lib/api/finance-reader.ts#L1) e [http.ts](../../web/lib/api/http.ts#L1) são marcados `server-only`;
- `API_URL` permanece no servidor ([api-url.ts](../../web/lib/api/api-url.ts#L1));
- o wrapper centraliza autenticação, erros e `fetch` com `cache: "no-store"` ([http.ts](../../web/lib/api/http.ts#L56));
- leituras são feitas nos Server Components; mutações e leituras sob demanda da UI passam por [Server Actions](<../../web/app/(protected)/entries/actions.ts#L15>), com revalidação das rotas afetadas.

Para este projeto, que já tem uma API NestJS separada, chamar essa API no servidor Next é mais adequado do que duplicar persistência/regra de negócio no Next ou expor a chamada autenticada ao navegador. Não há motivo geral para acrescentar Route Handlers como proxy sem uma necessidade adicional de protocolo, cache ou composição. A documentação oficial alerta que Server Actions devem ser tratadas como entradas públicas: autenticação/autorização e validação precisam permanecer no servidor. Aqui, a sessão é lida do lado server e os IDs/mês usados nas ações são validados no web; a API Nest continua sendo a autoridade para as regras e validações de negócio. O `CreateEntry` depende da validação da API, portanto essa validação no backend não pode ser removida por confiar no tipo TypeScript do payload.

### Interação direta com o DOM

Os usos encontrados são localizados e orientados a comportamento que precisa de APIs do navegador: foco após fechar diálogos, foco em listas, medição/posicionamento de menu, `matchMedia`, eventos de ponteiro e redimensionamento. Eles aparecem em componentes client. Isso é compatível com o propósito de Client Components segundo a documentação do Next.js.

Há um único `dangerouslySetInnerHTML` em [global-error.tsx](../../web/app/global-error.tsx#L9): o conteúdo é uma constante estática para aplicar o tema antes da primeira pintura, sem conteúdo de usuário interpolado. Não encontrei `innerHTML`/`insertAdjacentHTML` usados para renderizar dados. Para novos casos, prefira refs quando o elemento já é conhecido; mantenha consultas globais ao DOM limitadas a foco e coordenação de acessibilidade, como ocorre hoje.

## 4. Qualidade, testes e eficiência observável

Na verificação desta auditoria:

| Projeto | Testes | Lint | Typecheck | Cobertura medida |
|---|---:|---|---|---|
| API | 917 passaram | Passou, com **10 warnings**, todos em testes/helpers | Passou | 96,41% statements; 94,91% branches; 97,16% lines |
| Web | 1.760 passaram | Passou | Passou | 92,85% statements; 88,60% branches; 94,12% lines |

Esses resultados dão boa evidência de qualidade e de testes unitários/componentes. Os warnings do lint da API não bloquearam o comando, mas devem ser eliminados ou explicitamente aceitos para que avisos novos continuem visíveis.

**Limite importante de e2e:** não executei Playwright nem testes de integração com PostgreSQL durante esta auditoria. O registro de `listagem-mes-e-status-padrao` documenta 10 falhas no Playwright completo (562/572), atribuídas à base, e informa que a suíte completa não foi repetida após o último ciclo; o registro mais recente de novembro relata 47 e2e focados passando. Logo, não é correto concluir que a suíte e2e completa está verde hoje sem nova execução.

## 5. Eficiência do fluxo e qualidade dos subagents

### Pontos fortes

- As instruções estabelecem papéis separados, entregáveis explícitos, aprovação antes de implementar, RED/VERIFICAÇÃO e revisão; isso reduz ambiguidades em features de várias camadas ([feature.md](../../.claude/commands/feature.md#L10)).
- O `frontend-dev` prioriza Server Components e o tester define testes por camada; o reviewer tem escopo somente leitura. Há boa separação de permissões e responsabilidade.
- Os registros `docs/runs/` ajudam a preservar o que foi tentado, divergências aceitas, testes e handoffs — informação valiosa quando agentes são interrompidos.
- Decisões revisadas aparecem, em alguns casos, como adendos explícitos: por exemplo, o ADR 0009 registra que a regra de faturas antigas mudou em relação ao ADR 0007, sem alterar o comportamento de PIX antigo.

### Onde o processo ficou caro ou frágil

1. **Muitos handoffs para uma feature:** o run de lançamentos financeiros chega a 18 etapas registradas, incluindo retomadas de agentes após limite de uso; outras features registram até três ciclos de correção/revisão. Isso pode ser adequado para a primeira entrega ampla, mas não deve ser o padrão para toda mudança local.
2. **Rodadas adicionais por sugestões não bloqueantes:** embora o fluxo diga para reabrir a implementação quando houver itens vermelhos, os registros mostram ciclos adicionais tratando itens amarelos e até sugestões. Isso melhora o acabamento, mas aumenta custo e pode gerar rework desproporcional ao risco.
3. **Disponibilidade dos modelos:** os arquivos de agent fixam `opus`/`sonnet`; o registro mais recente relata falha de inicialização por modelo indisponível para planner e tester, seguindo com produção/revisão direta. As instruções não descrevem um fallback operacional.
4. **Escopo do UI designer:** ele é acionado sempre que a spec marca impacto em UI. Uma mudança em comportamento de tela existente, sem estrutura visual ou interação nova, pode não precisar de um artefato de design independente.
5. **Verificação e conclusão:** há evidência de teste e revisão rigorosos, mas também de suíte e2e ampla com falhas conhecidas sem repetição depois do ciclo final. O processo precisa distinguir claramente “falhas de baseline”, “falhas da mudança” e “suíte final aprovada”.

### Documentação: rastreável, mas ruidosa

O repositório tem 9 arquivos em cada um de `docs/specs/`, `docs/adr/` e `docs/design/`, mas 6 registros em `docs/runs/`; esses conjuntos somam aproximadamente 15,4 mil linhas. Parte desse detalhe é útil para as features maiores, mas specs, ADRs, designs e runs repetem critérios, decisões, listas extensas de arquivos e resultados de testes.

Há ao menos um caso verificável de informação obsoleta no ADR 0004: a seção inicial diz que as escolhas ainda não foram aprovadas, apesar do status aceito e do histórico de aprovação; depois, afirma que o registro de execução ainda não existe, embora [o run da mesma feature](../runs/superficies-vidro-fosco.md#L20) esteja presente. O run esclarece que a medição de desempenho manual continua pendente. Isso é ruído editorial, não evidência de uma decisão técnica errada.

O run mais recente também deixa claro quando os subagents falharam e houve fallback direto, o que é bom para auditoria. A rastreabilidade ainda é incompleta: a autenticação tem spec/ADR e implementação registrada no commit `cad1728` (`implemented auth-authorized`), mas não há run correspondente em `docs/runs/`, apesar de a regra do fluxo exigir esse registro.

### Melhorias prioritárias para os subagents e o orquestrador

1. **Criar um caminho “completo” e outro “enxuto”.** Reservar planner + architect + UI design + revisão iterativa para mudanças transversais, migrações, regras financeiras ou segurança. Para ajustes localizados em comportamento existente, usar spec delta curta, teste focado, implementação, verificação do escopo afetado e revisão única.
2. **Aplicar o limite de revisão já definido.** Fazer novas rodadas obrigatórias apenas para bloqueadores e riscos altos. Itens amarelos/sugestões devem ser aceitos, registrados como follow-up ou agrupados em uma rodada única quando realmente fizerem parte do escopo.
3. **Reduzir o contrato de handoff.** Cada agent deve devolver: resumo curto, arquivos alterados, comandos/resultados, pendências e bloqueadores. O orquestrador pode obter a lista de arquivos do diff, em vez de pedir listas duplicadas e extensas a cada etapa.
4. **Adicionar fallback para modelo indisponível.** Antes de iniciar a sequência, validar a disponibilidade dos modelos configurados; se falhar, oferecer ou adotar uma rota de execução direta documentada, mantendo os mesmos testes e revisão. Evitar fixar o fluxo a uma única variante/modelo quando o ambiente não a disponibiliza.
5. **Restringir o UI designer a decisões de UI reais.** Acioná-lo para nova tela, layout, componente ou interação material; para ajustes de estado/filtro em componente existente, basta o designer/frontend-dev aplicar o design system e registrar a decisão na spec.
6. **Enxugar e versionar a documentação.** Manter requisitos na spec, decisões duradouras no ADR, detalhes visuais no design e no run somente decisões alteradas, agentes acionados e verificação final. Marcar propostas/experimentos/superseded explicitamente e retirar ou mover texto contraditório das seções históricas. Não reescrever README/CHANGELOG em toda correção interna sem mudança percebida pelo usuário.
7. **Fechar a verificação de forma objetiva.** Preservar falhas de baseline com assinatura e commit-base; antes de concluir, repetir os testes e2e relevantes após a última correção e registrar se a suíte completa passou ou quais falhas permanecem.
8. **Reavaliar eventos sem consumidores.** Remover/postergar o publisher inerte até haver um consumidor ou implementar uma necessidade concreta de entrega confiável; isso reduz abstração sem benefício atual.

## 6. Referências oficiais do Next.js consultadas

- [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) — Server Components, `fetch`, streaming e APIs externas.
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — uso de Server Components para dados e Client Components para interação/APIs do navegador.
- [Data Security](https://nextjs.org/docs/app/guides/data-security) — chamadas a APIs REST existentes, camada de acesso server-only, autorização e DTOs.
- [`use server`](https://nextjs.org/docs/app/api-reference/directives/use-server) — validação/autorização e tratamento de Server Functions como entrada de servidor.

**Síntese final:** Claude Code ajudou a entregar uma base com limites arquiteturais verificáveis, regras de domínio testáveis e alta cobertura unitária. O principal ganho futuro não é adicionar mais agentes ou documentos; é preservar esses controles com menos handoffs, fallback previsível, critérios claros para reabrir revisão e uma fonte documental consistente.
