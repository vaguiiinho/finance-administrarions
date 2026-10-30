import type { Metadata } from "next";
import { PROTECTED_MODE } from "@/lib/app-mode";
import { createFinanceReader } from "@/lib/api/finance-reader";
import { CardsScreen } from "@/features/cards/cards-screen";

export const metadata: Metadata = { title: "Cartões" };

export default function CardsPage() {
  return <CardsScreen mode={PROTECTED_MODE} reader={createFinanceReader("protected")} />;
}
