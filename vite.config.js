import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import {
    defineConfig
} from 'vite';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.jsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    esbuild: {
        jsx: 'automatic',
    },
    server: {
        watch: {
            // No frontend source here. Matters in the container, where the watcher polls every file.
            ignored: ['**/vendor/**', '**/storage/**', '**/bootstrap/cache/**', '**/database/**', '**/tests/**', '**/docs/**'],
        },
    },
});