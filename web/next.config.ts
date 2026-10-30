import type { NextConfig } from "next";
import pkg from "./package.json";

// Origens extras aceitas pelas Server Actions atras de proxy (CSRF compara Origin com Host; ADR 0005 9.5/9.9)
const allowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);

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
