import { defineConfig } from 'vite';
import { VitePluginNode } from 'vite-plugin-node';
import replace from '@rollup/plugin-replace';
// import { visualizer } from 'rollup-plugin-visualizer';
import { execSync } from 'child_process';
import dts from 'vite-plugin-dts';

let gitInfo = {
    branch: '',
    commit: '',
    tags: '',
    commitDate: '',
};

try {
    gitInfo = {
        branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
        commit: execSync('git rev-parse --short HEAD').toString().trim(),
        tags: '',
        commitDate: execSync('git log -1 --format=%cd --date=iso').toString().trim(),
    };

    try {
        gitInfo.tags = execSync('git tag --points-at HEAD | paste -sd "," -').toString().trim();
    } catch {
        gitInfo.tags = '';
    }
} catch {
    // eslint-disable-next-line no-console
    console.log('Directory does not have a Git repository, skipping git info');
}


export default defineConfig({
    server: {
        port: 3000
    },
    plugins: [
        ...VitePluginNode({
            adapter: 'express',
            appPath: './src/cardigantime.ts',
            exportName: 'viteNodeApp',
            tsCompiler: 'swc',
            swcOptions: {
                sourceMaps: true,
            },
        }),
        // visualizer({
        //     template: 'network',
        //     filename: 'network.html',
        //     projectRoot: process.cwd(),
        // }),
        replace({
            '__VERSION__': process.env.npm_package_version,
            '__GIT_BRANCH__': gitInfo.branch,
            '__GIT_COMMIT__': gitInfo.commit,
            '__GIT_TAGS__': gitInfo.tags === '' ? '' : `T:${gitInfo.tags}`,
            '__GIT_COMMIT_DATE__': gitInfo.commitDate,
            '__SYSTEM_INFO__': `${process.platform} ${process.arch} ${process.version}`,
            preventAssignment: true,
        }),
        dts({
            entryRoot: 'src',
            outDir: 'dist',
            exclude: ['**/*.test.ts'],
            include: ['**/*.ts'],
        }),
    ],
    build: {
        target: 'esnext',
        outDir: 'dist',
        lib: {
            entry: './src/cardigantime.ts',
        },
        rollupOptions: {
            input: 'src/cardigantime.ts',
            output: [
                {
                    format: 'es',
                    entryFileNames: '[name].js',
                    chunkFileNames: '[name].js',
                    preserveModules: true,
                    preserveModulesRoot: 'src',
                    exports: 'named',
                },
                {
                    format: 'cjs',
                    entryFileNames: 'cardigantime.cjs',
                    chunkFileNames: '[name].cjs',
                    preserveModules: false,
                    exports: 'named',
                },
            ],
            external: [
                'commander',
                'glob',
                'js-yaml',
                'zod',
                // Node built-ins
                'fs',
                'path',
                'child_process',
                'os',
                'url',
                'util',
                'crypto',
                'stream',
                'events',
                'buffer',
                'process',
                'module',
                'assert',
                'querystring',
                'http',
                'https',
                'net',
                'tls',
                'dgram',
                'dns',
                'readline',
                'repl',
                'vm',
                'zlib',
                'console',
                'constants',
                'domain',
                'punycode',
                'string_decoder',
                'timers',
                'tty',
                'v8',
                'worker_threads',
                'cluster',
                'inspector',
                'perf_hooks',
                'async_hooks',
                'trace_events',
            ],
        },
        // Make sure Vite generates ESM-compatible code
        modulePreload: false,
        minify: false,
        sourcemap: true
    },
});
