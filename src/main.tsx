import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initialLang } from './i18n';
import { settings } from './state/settings';
import './styles.css';

async function boot(): Promise<void> {
  // The emulator runs only under `npm run dev:local` (mode "mac"). The headset can also open the page as
  // localhost (USB + adb reverse), so the hostname alone must not switch the emulator on.
  if (import.meta.env.MODE === 'mac') {
    const { installEmulator } = await import('./dev/emulator');
    installEmulator();
  }
  settings.set({ lang: initialLang() });
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
