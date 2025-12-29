import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        environment: 'node',
        setupFiles: ['tests/setup.ts'],
        include: ['tests/**/*.test.ts'],
        exclude: ['node_modules/**/*', 'docs/**/*'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*'],
            exclude: ['docs/**/*', 'node_modules/**/*'],
            thresholds: {
                lines: 91,
                statements: 91,
                branches: 90,
                functions: 91,
            },
        },
    },
});
