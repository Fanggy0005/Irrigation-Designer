import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Kept apart from vite.config.js: unit tests cover plain TS in resources/js/domain and
// need neither the Laravel plugin nor React.
export default defineConfig({
    resolve: {
        alias: { '@': fileURLToPath(new URL('./resources/js', import.meta.url)) },
    },
    test: {
        include: ['resources/js/**/*.test.ts'],
    },
});
