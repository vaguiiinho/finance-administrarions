# Deploy na VPS (CD)

A cada push na `main`, `.github/workflows/deploy.yml` publica as imagens `vaguiiinho/finance-{api,web}:X.Y.Z` e, com
`DEPLOY_ENABLED=true`, entra por SSH na VPS e roda `deploy.sh X.Y.Z`. O script:

1. valida o `.env` e o `docker-compose.yml` novo (guarda o anterior em `docker-compose.yml.bak`);
2. baixa as imagens da versão antes de mexer em qualquer coisa;
3. faz backup do banco em `backups/` (pg_dump; mantém os 10 últimos), porque a API roda as migrations ao subir;
4. grava `APP_VERSION` no `.env` e sobe com `docker compose up -d --wait` (falha se os containers não ficarem saudáveis).

Nunca usa `down` nem `-v`: o Postgres só é recriado se a configuração dele mudar, e o volume `finance-postgres-data`
nunca é tocado.

## Arquivos na VPS (`/root/projects/finance`)

- `docker-compose.yml`: **substituído** pelo deste diretório a cada deploy (versionado no git; mudanças vão por PR).
- `.env`: **fica só na VPS** (segredos). O CD só altera a linha `APP_VERSION`. Variáveis lidas:

| Variável | Obrigatória | Observação |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | sim | Trocar no `.env` NÃO troca a senha de um banco já criado (use `ALTER USER`). |
| `SESSION_TOKEN_SECRET` | sim | ≥ 32 bytes (`openssl rand -base64 48`). Trocar encerra todas as sessões. |
| `APP_NODE_ENV` | não | Padrão `production`, que exige `TRUST_PROXY` com o IP do nginx. |
| `TRUST_PROXY` | com `production` | IP (ou sub-rede estreita) do nginx. |
| `SHOWCASE_ACCOUNT_PASSWORD` | não | Liga a conta demo (`demo` se `DEMO_ACCOUNT_HINT=on`). |
| `DEMO_ACCOUNT_HINT` | não | `on` mostra a dica `demo/demo` no login do web. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | só no 1º boot | Ignoradas quando já existe usuário; podem ser removidas. |
| `MOBILE_MIN_VERSION`, `MOBILE_STORE_URL`, `MAINTENANCE_INTERVAL_MS` | não | Ver `api/.env.example`. |
| `APP_VERSION` | gerida pelo CD | Não edite à mão (exceto rollback). |

## Configuração (uma vez)

Tudo na **sua máquina** (a chave privada nunca vai para a VPS nem para o repositório):

1. Gere um par de chaves só para o deploy (sem senha: o Actions não tem como digitá-la):
   `ssh-keygen -t ed25519 -C "github-deploy-finance" -N '' -f ~/.ssh/finance_deploy`
2. Autorize a chave pública no usuário de `VPS_USER`:
   `ssh-copy-id -i ~/.ssh/finance_deploy.pub -p <porta> <usuário>@<host>`
3. Teste: `ssh -i ~/.ssh/finance_deploy -p <porta> <usuário>@<host> "docker compose version"` (não pode pedir senha).
4. Pegue a identidade da VPS: `ssh-keyscan -p <porta> <host>`. Use o mesmo `<host>` de `VPS_HOST` (IP ou domínio).
   Confira as impressões digitais: `ssh-keyscan -p <porta> <host> 2>/dev/null | ssh-keygen -lf -` na sua máquina deve
   bater com `for f in /etc/ssh/ssh_host_*_key.pub; do ssh-keygen -lf "$f"; done` na VPS.
5. No GitHub (Settings > Secrets and variables > Actions):
   - Secrets:
     - `VPS_HOST`, `VPS_USER`;
     - `VPS_SSH_KEY`: conteúdo inteiro de `~/.ssh/finance_deploy`, com as linhas `-----BEGIN/END OPENSSH PRIVATE KEY-----`;
     - `VPS_KNOWN_HOSTS`: as linhas do passo 4 como saíram (com o host no início; sem as que começam com `#`).
   - Variables: `DEPLOY_ENABLED=true`; opcionais `VPS_PORT` e `VPS_PATH`.

Para revogar o acesso (chave vazada, por exemplo), apague a linha `github-deploy-finance` do `~/.ssh/authorized_keys`
da VPS.

## Rollback

Voltar a imagem com migrations já aplicadas pode quebrar; prefira corrigir e publicar uma versão nova. Se precisar:

```sh
cd /root/projects/finance
sed -i 's/^APP_VERSION=.*/APP_VERSION=1.0.5/' .env && docker compose up -d --wait
# banco (só se necessário; a API precisa estar parada):
docker compose stop api web
gunzip -c backups/<arquivo>.sql.gz | docker exec -i finance-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Restaurar um dump por cima de um banco que já tem dados gera conflitos. Para uma restauração limpa, recrie o schema
`public` antes (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`), sabendo que isso apaga o estado atual.
