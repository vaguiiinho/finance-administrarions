// Healthcheck do container (docker compose). ESM: o package.json da API é "type": "module".
// A API ainda não tem rota de health; qualquer resposta HTTP < 500 em /api prova que o processo subiu e está ouvindo
// (o CMD da imagem só inicia o servidor depois de `prisma migrate deploy` e do seed, que exigem o banco).
import { request } from 'node:http';

const req = request({ host: '127.0.0.1', port: process.env.PORT || 3001, path: '/api', timeout: 3000 }, (res) => {
  process.exit(res.statusCode < 500 ? 0 : 1);
});

req.on('error', () => process.exit(1));
req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});
req.end();
