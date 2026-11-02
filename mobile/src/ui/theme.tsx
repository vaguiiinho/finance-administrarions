import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkPalette, lightPalette, type Palette } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';
const THEME_KEY = 'fa.theme';

interface ThemeValue {
  palette: Palette;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference(next: ThemePreference): void;
}

const ThemeContext = createContext<ThemeValue>({ palette: lightPalette, scheme: 'light', preference: 'system', setPreference: () => undefined });

/** Tema: sistema (ao vivo), claro ou escuro; a escolha fica em AsyncStorage (dado nao sensivel). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setPreferenceState(stored);
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  }, []);

  const scheme: 'light' | 'dark' = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(
    () => ({ palette: scheme === 'dark' ? darkPalette : lightPalette, scheme, preference, setPreference }),
    [scheme, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
