# Finanças Pessoais - app mobile (iOS)

App iPhone (retrato) em Expo SDK 58 / React Native 0.88 / Expo Router, que consome a mesma API do web. Decisão e desenho: [`docs/adr/0011-app-mobile-ios.md`](../docs/adr/0011-app-mobile-ios.md), [`docs/specs/mobile-app.md`](../docs/specs/mobile-app.md) e [`docs/design/mobile-app.md`](../docs/design/mobile-app.md).

- iOS mínimo: **16.4** (o ADR pedia 16.0, mas o SDK 58 exige 16.4; ver "Desvios" no ADR 0011, seção 12).
- Só iPhone, só retrato, só iOS (`platforms: ['ios']`).
- Hermes e New Architecture (padrão do SDK 58).

## Setup

Pré-requisitos: Node 22 e npm. Para abrir o app é preciso um simulador iOS ou aparelho (macOS com Xcode) ou um dev client do EAS.

```bash
cd mobile
npm install
cp .env.example .env     # ajuste as URLs
npx expo start           # ou: npm run ios
```

A API precisa estar no ar (ver README da raiz). Como o app usa módulos nativos (`expo-secure-store`, `react-native-svg`), use um **dev client** (`eas build --profile development`) ou `npx expo run:ios`; o Expo Go não é o alvo.

## Variáveis de ambiente

São públicas: o Metro as grava no bundle. Nunca coloque segredos aqui.

| Variável | Uso |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL base da API (ex.: `http://localhost:3001` em desenvolvimento, `https://api.<domínio>` em produção). Em produção o ATS do iOS exige HTTPS. |
| `EXPO_PUBLIC_WEB_URL` | URL do web, usada para abrir a política de privacidade (`/privacy`) e o suporte (`/support`). |
| `EXPO_PUBLIC_E2E` | `1` só no perfil `e2e`. |
| `APP_VARIANT` | Lida por `app.config.ts` (não é `EXPO_PUBLIC_*`): `development` e `e2e` liberam `NSAllowsLocalNetworking`; `e2e` inclui a tela `/diagnostics`. Padrão: `production`. |

Em builds do EAS os valores vêm de `eas.json` (campo `env`); `.env.example` serve ao desenvolvimento local.

## Scripts

| Script | O que faz |
|---|---|
| `npm start` / `npm run ios` | Metro / Metro abrindo o simulador |
| `npm run test:rules` | Vitest: regras puras (dinheiro, datas, formulário, parcelas, gráficos, núcleo) |
| `npm run test:ui` | Jest + Testing Library (`TZ=America/Sao_Paulo`) |
| `npm run test:coverage` | Vitest com cobertura |
| `npm test` | `test:rules` + `test:ui` |
| `npm run check:shared` | Compara os arquivos compartilhados com o web (falha se divergirem) |
| `npm run sync:shared` | Copia do web para `src/lib/` |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc` (app e regras) |
| `npm run check:all` | lint + typecheck + check:shared + testes |

## Código compartilhado com o web

A fonte da verdade das regras puras está em `web/lib/`; o mobile mantém **cópias byte a byte** em `mobile/src/lib/`. A lista está em `scripts/shared-files.mjs` (`money/decimal.ts`, `dates/format.ts`, `entries/form.ts`, `entries/installments.ts`, `entries/payment-feedback.ts`, `dashboard/chart-data.ts`, `api/types.ts` e os `*.spec.ts` correspondentes).

Regra: **edite no web e rode `npm run sync:shared`**. Nunca edite a cópia em `mobile/src/lib/`. O CI (`.github/workflows/mobile.yml`) roda `check:shared` e falha com a deriva. `web/lib/auth/initial.ts` não é compartilhado (`Intl.Segmenter` não existe no Hermes); o mobile tem `src/core/initial.ts`.

## Perfis do EAS (`eas.json`)

| Perfil | Distribuição | `APP_VARIANT` | API / Web | Uso |
|---|---|---|---|---|
| `development` | interna, dev client, simulador | `development` | `http://localhost:3001` / `http://localhost:3000` | Desenvolvimento local |
| `e2e` | estende `development` | `e2e` (`EXPO_PUBLIC_E2E=1`) | idem | Fluxos Maestro e tela `/diagnostics` |
| `preview` | interna | `production` | `https://api-staging.example.com` / `https://staging.example.com` (placeholders) | Teste em aparelho contra homologação |
| `production` | App Store (`autoIncrement` do `buildNumber`) | `production` | `https://api.example.com` / `https://app.example.com` (placeholders) | TestFlight e App Store |

`appVersionSource` é `remote`: o EAS controla o `buildNumber`. A versão semver (`1.0.0`) está em `app.config.ts` e vai no cabeçalho `X-Client: mobile/<versão>`.

## Publicação: TestFlight -> App Store

1. Preencha os placeholders (próxima seção).
2. Tag no repositório: `git tag mobile-v1.0.0 && git push --tags`. O workflow `Mobile CI` roda os checks e, na tag `mobile-v*`, executa `eas build --platform ios --profile production --non-interactive --auto-submit`. Precisa do segredo `EXPO_TOKEN` no GitHub; certificados e App Store Connect ficam no EAS (`eas credentials`). Manualmente: `eas build -p ios --profile production` e `eas submit -p ios --profile production`.
3. O build chega ao **TestFlight** (processamento na Apple). Teste internamente e, se quiser, com testadores externos (exige revisão beta).
4. No App Store Connect: selecione o build, preencha metadados, URL de privacidade (`<web>/privacy`), URL de suporte (`<web>/support`) e as **notas de revisão** com a conta demo (abaixo). Envie para revisão.
5. Depois de aprovada a versão na loja, e só então, suba `MOBILE_MIN_VERSION` na API se precisar forçar a atualização (a API responde 426 `APP_UPDATE_REQUIRED` abaixo dela; `MOBILE_STORE_URL` leva o link da loja).

## Conta demo para o revisor da Apple

| Campo | Valor |
|---|---|
| Usuário (campo "E-mail") | `demo` (alias aceito pela API; o e-mail `demo@showcase.invalid` também funciona) |
| Senha | `demo`, a definida em `SHOWCASE_ACCOUNT_PASSWORD` na API (lida só pelo seed; sem a variável, a conta fica desligada) |

Texto sugerido para as notas de revisão do App Store Connect: "Conta de demonstração: usuário `demo` (ou `demo@showcase.invalid`) e senha `demo`. A conta já vem com dados de exemplo e é redefinida todos os dias às 03:00 (horário de Brasília)."

O app não valida o formato do campo, então `demo` funciona sem nova versão e **não há dica nem mudança de rótulo no app** (a credencial vai só nas notas de revisão). A conta é compartilhada e tem restrições: não troca senha nem renomeia (403 `FORBIDDEN`; no app, "Trocar senha" aparece visível e desabilitado) e **é redefinida todo dia às 03:00 (America/Sao_Paulo)**: o que foi criado ou alterado é descartado e os dados de exemplo voltam. Pode criar, editar, excluir e pagar lançamentos. O e-mail `.invalid` é reservado e não pode ser usado por usuários comuns.

Antes de enviar o app para revisão, rode `docker exec <container-da-api> npm run demo:reset` para a conta estar com os dados de exemplo. Atualize as notas de revisão antes do próximo envio (as antigas citavam só o e-mail e a conta vazia). O texto do aviso no app (`DEMO_CLEANUP_TEXT`) já usa a redação de "redefinida" e chega aos usuários na próxima versão publicada.

## O que ainda é placeholder

- Ícone do app e splash screen: não há arquivos nem campos em `app.config.ts`.
- `ascAppId` e `appleTeamId` em `eas.json` (`submit.production.ios`).
- `extra.eas.projectId` em `app.config.ts` (`eas init` preenche).
- `ios.bundleIdentifier` (`br.com.finance.app`), que também é o `appId` dos fluxos Maestro.
- URLs reais em `preview` e `production` (`example.com`) no `eas.json`, e `MOBILE_STORE_URL` na API.

## Testes de ponta a ponta (Maestro)

Os fluxos estão em `e2e/maestro/*.yaml` (login e criação, sessão expirada e atualização obrigatória, troca de senha pendente, diagnóstico de fuso, ações da conta demo). **Ainda não foram executados** e dependem de um Mac com simulador iOS e do stub estendido; ver pendência I7 no ADR 0011, seção 12.3.
