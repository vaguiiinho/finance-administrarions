import { AppHeader } from "@/components/app-header";
import { NavProvider } from "@/components/navigation";
import { ToastProvider } from "@/components/ui/toast";

/** Shell das telas (design D9): navbar + conteudo no container de 1280px. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NavProvider>
        <AppHeader />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-[1280px] px-4 py-4 outline-none md:px-6 md:py-6 lg:px-8">
          {children}
        </main>
      </NavProvider>
    </ToastProvider>
  );
}
