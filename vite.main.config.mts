import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            external: ['better-sqlite3', 'bufferutil', 'utf-8-validate'],
        },
    },
    server: {
        watch: {
            ignored: ['**/bin/**'],
        },
    },
});
