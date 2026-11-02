import * as WebBrowser from 'expo-web-browser';
import type { ExternalBrowser } from '@/core/ports';

/** Navegador do sistema (SFSafariViewController). */
export const externalBrowser: ExternalBrowser = {
  async open(url) {
    await WebBrowser.openBrowserAsync(url);
  },
};
