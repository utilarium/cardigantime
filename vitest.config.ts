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
                statements: 97,
                branches: 95,
                functions: 91,
                lines: 97,
            },
        },
    },
});
