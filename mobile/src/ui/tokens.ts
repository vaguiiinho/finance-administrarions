/** Tokens de cor (design 2.1). Nenhuma cor literal fora deste arquivo. */
export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  inputBg: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDisabled: string;
  primary: string;
  primaryBorder: string;
  onPrimary: string;
  accent: string;
  successText: string;
  success: string;
  warningText: string;
  warning: string;
  dangerText: string;
  danger: string;
  income: string;
  expense: string;
  chartIncome: string;
  chartPaid: string;
  chartPending: string;
  chart: readonly string[];
  chartAxis: string;
  chartGrid: string;
  scrim: string;
  onAccent: string;
}

export const lightPalette: Palette = {
  bg: '#ECEEFC',
  surface: '#FFFFFF',
  surface2: '#F4F6F9',
  inputBg: '#FFFFFF',
  border: '#D9DEE6',
  borderStrong: '#6F798C',
  text: '#1E293B',
  textMuted: '#4B5567',
  textDisabled: '#6F798C',
  primary: '#4F46E5',
  primaryBorder: '#4F46E5',
  onPrimary: '#FFFFFF',
  accent: '#0E7490',
  successText: '#047857',
  success: '#047857',
  warningText: '#92400E',
  warning: '#B45309',
  dangerText: '#B91C1C',
  danger: '#B91C1C',
  income: '#1D4ED8',
  expense: '#BE123C',
  chartIncome: '#1D4ED8',
  chartPaid: '#059669',
  chartPending: '#B45309',
  chart: ['#4F46E5', '#0E7490', '#B45309', '#BE123C', '#047857', '#6F798C'],
  chartAxis: '#4B5567',
  chartGrid: '#D9DEE6',
  scrim: 'rgba(15, 23, 42, 0.45)',
  onAccent: '#FFFFFF',
};

export const darkPalette: Palette = {
  bg: '#181E2A',
  surface: '#1C2330',
  surface2: '#252D3C',
  inputBg: '#151B26',
  border: '#2E3747',
  borderStrong: '#7A8497',
  text: '#E3E7EE',
  textMuted: '#9BA5B7',
  textDisabled: '#7A8497',
  primary: '#4F46E5',
  primaryBorder: '#818CF8',
  onPrimary: '#FFFFFF',
  accent: '#5CC8DB',
  successText: '#34D399',
  success: '#34D399',
  warningText: '#FBBF24',
  warning: '#FBBF24',
  dangerText: '#F87171',
  danger: '#F87171',
  income: '#60A5FA',
  expense: '#FB7185',
  chartIncome: '#60A5FA',
  chartPaid: '#34D399',
  chartPending: '#FBBF24',
  chart: ['#818CF8', '#5CC8DB', '#FBBF24', '#FB7185', '#34D399', '#9BA5B7'],
  chartAxis: '#9BA5B7',
  chartGrid: '#343E51',
  scrim: 'rgba(8, 11, 17, 0.72)',
  onAccent: '#181E2A',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
export const MIN_TOUCH = 44;
