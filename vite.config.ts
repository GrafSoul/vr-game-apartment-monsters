import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// WebXR needs a secure context. On the LAN the dev server runs over HTTPS and Quest 3 opens it as
// https://<mac-ip>:5173 (the browser asks once to trust the self-signed cert). `--mode mac` serves
// plain HTTP on localhost only, which is already a secure context, for testing on the Mac with the emulator.
export default defineConfig(({ mode }) => {
  const local = mode === 'mac';
  return {
    // GitHub Pages serves the build from `docs/` under /<repo>/ (or a custom domain at /): relative URLs work in both.
    base: './',
    build: { outDir: 'docs' },
    plugins: local ? [react()] : [react(), basicSsl()],
    server: local ? { host: 'localhost', port: 5174 } : { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
  };
});
