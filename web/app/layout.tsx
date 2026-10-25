import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Finanças", template: "%s | Finanças" },
  description: "Lançamentos, cartões, faturas e resumo mensal.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Preferencia de tema lida no servidor: o primeiro quadro (inclusive loading/erro) ja nasce no tema certo (ADR 9.5).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="pt-BR" data-theme={theme} className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
