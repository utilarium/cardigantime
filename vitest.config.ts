import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        environment: 'node',
        setupFiles: ['tests/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            thresholds: {
                lines: 75,
                branches: 56,
                functions: 82,
                statements: 75,
            },
        },
    },
});
