import type { NextConfig } from "next";
import pkg from "./package.json";

// Origens extras aceitas pelas Server Actions atras de proxy (CSRF compara Origin com Host; ADR 0005 9.5/9.9)
const allowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);

// SUPPORT_EMAIL e obrigatoria em producao: a App Store exige um contato acessivel em /support (ADR 0011, S1).
// So avisa (nao quebra o build nem o dev); a pagina cai num texto neutro sem link se a variavel faltar.
if (process.env.NODE_ENV === "production" && !process.env.SUPPORT_EMAIL?.trim()) {
  console.warn("[web] AVISO: SUPPORT_EMAIL nao definida. Em producao ela e obrigatoria (a App Store exige contato acessivel em /support).");
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Versao do app para o footer: fixada no build, lida so no servidor (nao e NEXT_PUBLIC_*)
  env: { APP_VERSION: pkg.version },
  /* config options here */
  experimental: {
    agentFeedback: true,
    ...(allowedOrigins.length > 0 ? { serverActions: { allowedOrigins } } : {}),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
