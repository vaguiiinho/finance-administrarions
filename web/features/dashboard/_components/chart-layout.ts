/** Arranjo rosca + legenda (ADR 0012): empilhado por padrao, lado a lado a partir de @3xl (48rem) do contêiner. Compartilhado com o skeleton. */
export const DONUT_ARRANGEMENT = "flex flex-col items-center gap-4 @3xl:flex-row @3xl:justify-center @3xl:gap-8";
export const DONUT_LEGEND = "flex w-full min-w-0 max-w-md flex-col gap-2 text-sm @3xl:flex-1";
export const DONUT_RING = "h-[220px] w-[220px] shrink-0";
export const DONUT_CONTAINER = "@container";
/** Altura das barras do grafico mensal: fonte unica, usada tambem pelo skeleton. Modulo sem "use client" (importavel por Server Components). */
export const MONTHLY_CHART_HEIGHT = "h-[260px] md:h-[280px] lg:h-[320px]";
/** Cabecalho dos skeletons: espelha o figcaption do ChartCard (titulo text-xl + subtitulo + alternador min-h-11). */
export const CHART_HEADER_SKELETON = "flex flex-wrap items-start justify-between gap-3";
