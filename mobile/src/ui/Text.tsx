import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from './theme';
import type { Palette } from './tokens';

export type TextVariant = 'largeTitle' | 'title2' | 'title3' | 'headline' | 'body' | 'subheadline' | 'footnote' | 'caption';
export type TextTone = 'text' | 'muted' | 'accent' | 'danger' | 'success' | 'warning' | 'income' | 'expense' | 'disabled' | 'onPrimary';

const VARIANTS: Record<TextVariant, { fontSize: number; fontWeight: '400' | '500' | '600' | '700' }> = {
  largeTitle: { fontSize: 34, fontWeight: '700' },
  title2: { fontSize: 22, fontWeight: '700' },
  title3: { fontSize: 20, fontWeight: '600' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  subheadline: { fontSize: 15, fontWeight: '400' },
  footnote: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '500' },
};

export function toneColor(palette: Palette, tone: TextTone): string {
  switch (tone) {
    case 'muted':
      return palette.textMuted;
    case 'accent':
      return palette.accent;
    case 'danger':
      return palette.dangerText;
    case 'success':
      return palette.successText;
    case 'warning':
      return palette.warningText;
    case 'income':
      return palette.income;
    case 'expense':
      return palette.expense;
    case 'disabled':
      return palette.textDisabled;
    case 'onPrimary':
      return palette.onPrimary;
    default:
      return palette.text;
  }
}

interface Props extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Valores e datas: algarismos de largura fixa. */
  tabular?: boolean;
  center?: boolean;
}

/** Texto do app: fonte do sistema, Dynamic Type (allowFontScaling ligado) e tokens de cor. */
export function Text({ variant = 'body', tone = 'text', tabular, center, style, ...rest }: Props) {
  const { palette } = useTheme();
  return (
    <RNText
      allowFontScaling
      style={[VARIANTS[variant], { color: toneColor(palette, tone) }, tabular && { fontVariant: ['tabular-nums'] }, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}
