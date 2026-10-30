import type { Metadata } from "next";
import { DEMO_MODE } from "@/lib/app-mode";
import { createFinanceReader } from "@/lib/api/finance-reader";
import { CardsScreen } from "@/features/cards/cards-screen";

export const metadata: Metadata = { title: "Cartões (demonstração)" };

export default function DemoCardsPage() {
  return <CardsScreen mode={DEMO_MODE} reader={createFinanceReader("demo")} />;
}
