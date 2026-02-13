import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                team: resolve(__dirname, 'team.html'),
                careers: resolve(__dirname, 'careers.html'),
            },
        },
    },
    server: {
        port: 3000,
        open: true,
    },
});
