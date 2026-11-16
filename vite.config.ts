import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves a project site from /<repo>/, so assets have to be
  // requested from there rather than from the domain root. Must match the
  // repo name exactly — rename the repo and this has to change with it.
  base: '/donnataxtool/',
  // Windows resolves `localhost` to ::1 first, and Vite then binds IPv6 only,
  // so anything that reaches for 127.0.0.1 gets connection refused. Bind the
  // IPv4 loopback explicitly. Pass `--host` when you want it on the network
  // too, for instance to check the 320px layout on a real phone.
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    // The large chunks here are the data payloads and pdf-lib, every one of
    // them behind a dynamic import and none of them on the first paint. The
    // default 500 kB warning fires on all of them, which trains everyone to
    // ignore the build output. The limit is raised so that a warning means
    // something has actually landed in the initial bundle that should not
    // have: that chunk is around 380 kB and is the one worth watching.
    chunkSizeWarningLimit: 900,
  },
})
