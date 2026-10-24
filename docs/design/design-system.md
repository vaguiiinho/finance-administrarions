# Design System

## Direção
Futurista, limpo, tecnológico. Dark-first com suporte a light mode.
Referências: interfaces de dashboards modernos, glassmorphism sutil (não exagerado).

## Cores (CSS variables em apps/web/src/styles/tokens.css)
- --bg:        #0B0F1A   (fundo)
- --surface:   #121829   (cards)
- --border:    #1F2940
- --primary:   #6366F1   (ações principais)
- --accent:    #22D3EE   (destaques, links, foco)
- --success:   #34D399 | --warning: #FBBF24 | --danger: #F87171
- --text:      #E6EAF5 | --text-muted: #8B95AD
Contraste mínimo WCAG AA (4.5:1) para texto.

## Tipografia
- Títulos: Space Grotesk (600/700) | Corpo: Inter (400/500) | Mono: JetBrains Mono
- Escala: 12 / 14 / 16 / 20 / 24 / 32 / 48

## Forma e profundidade
- Raio: 8px (inputs), 12px (cards), 999px (badges)
- Sombras suaves com glow sutil na cor primary em elementos de foco
- Blur (backdrop-filter) apenas em modais e headers fixos

## Motion
- 150–250ms, easing ease-out. Respeitar `prefers-reduced-motion`.

## Layout responsivo (mobile-first)
- Breakpoints: sm 640 / md 768 / lg 1024 / xl 1280
- Grid de 4 colunas (mobile), 8 (tablet), 12 (desktop)
- Alvos de toque ≥ 44px