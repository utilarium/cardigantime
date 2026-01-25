import { describe, it, expect } from 'vitest';
import {
    STANDARD_PATTERNS,
    DEFAULT_EXTENSIONS,
    expandPattern,
    getDiscoveryPaths,
} from '../../src/discovery/patterns';
import { ConfigNamingPattern } from '../../src/types';

describe('discovery/patterns', () => {
    describe('STANDARD_PATTERNS', () => {
        it('should have 5 standard patterns', () => {
            expect(STANDARD_PATTERNS).toHaveLength(5);
        });

        it('should have correct priorities (1-5)', () => {
            const priorities = STANDARD_PATTERNS.map(p => p.priority);
            expect(priorities).toEqual([1, 2, 3, 4, 5]);
        });

        it('should have visible patterns first (lower priority)', () => {
            const visiblePatterns = STANDARD_PATTERNS.filter(p => !p.hidden);
            const hiddenPatterns = STANDARD_PATTERNS.filter(p => p.hidden);
            
            const maxVisiblePriority = Math.max(...visiblePatterns.map(p => p.priority));
            const minHiddenPriority = Math.min(...hiddenPatterns.map(p => p.priority));
            
            expect(maxVisiblePriority).toBeLessThan(minHiddenPriority);
        });

        it('should include the modern config pattern', () => {
            const modernPattern = STANDARD_PATTERNS.find(p => p.pattern === '{app}.config.{ext}');
            expect(modernPattern).toBeDefined();
            expect(modernPattern?.priority).toBe(1);
            expect(modernPattern?.hidden).toBe(false);
        });

        it('should include the hidden directory pattern', () => {
            const hiddenDirPattern = STANDARD_PATTERNS.find(p => p.pattern === '.{app}/config.{ext}');
            expect(hiddenDirPattern).toBeDefined();
            expect(hiddenDirPattern?.hidden).toBe(true);
        });

        it('should include the rc pattern without extension', () => {
            const rcPattern = STANDARD_PATTERNS.find(p => p.pattern === '.{app}rc');
            expect(rcPattern).toBeDefined();
            expect(rcPattern?.hidden).toBe(true);
            expect(rcPattern?.pattern).not.toContain('{ext}');
        });
    });

    describe('DEFAULT_EXTENSIONS', () => {
        it('should include TypeScript extensions first', () => {
            expect(DEFAULT_EXTENSIONS[0]).toBe('ts');
            expect(DEFAULT_EXTENSIONS.slice(0, 3)).toEqual(['ts', 'mts', 'cts']);
        });

        it('should include JavaScript extensions', () => {
            expect(DEFAULT_EXTENSIONS).toContain('js');
            expect(DEFAULT_EXTENSIONS).toContain('mjs');
            expect(DEFAULT_EXTENSIONS).toContain('cjs');
        });

        it('should include data format extensions', () => {
            expect(DEFAULT_EXTENSIONS).toContain('json');
            expect(DEFAULT_EXTENSIONS).toContain('yaml');
            expect(DEFAULT_EXTENSIONS).toContain('yml');
        });
    });

    describe('expandPattern', () => {
        it('should expand {app} placeholder', () => {
            expect(expandPattern('{app}.config.{ext}', 'myapp', 'yaml'))
                .toBe('myapp.config.yaml');
        });

        it('should expand hidden directory pattern', () => {
            expect(expandPattern('.{app}/config.{ext}', 'protokoll', 'json'))
                .toBe('.protokoll/config.json');
        });

        it('should expand rc pattern with extension', () => {
            expect(expandPattern('.{app}rc.{ext}', 'myapp', 'yaml'))
                .toBe('.myapprc.yaml');
        });

        it('should expand rc pattern without extension', () => {
            expect(expandPattern('.{app}rc', 'myapp'))
                .toBe('.myapprc');
        });

        it('should handle patterns with no extension placeholder', () => {
            expect(expandPattern('.{app}rc', 'test', 'yaml'))
                .toBe('.testrc');
        });

        it('should handle empty app name', () => {
            expect(expandPattern('{app}.config.{ext}', '', 'json'))
                .toBe('.config.json');
        });

        it('should handle app names with special characters', () => {
            expect(expandPattern('{app}.config.{ext}', 'my-app', 'yaml'))
                .toBe('my-app.config.yaml');
        });

        it('should handle multiple {app} placeholders', () => {
            expect(expandPattern('{app}-{app}.{ext}', 'test', 'js'))
                .toBe('test-test.js');
        });

        it('should leave {ext} if no extension provided', () => {
            expect(expandPattern('{app}.config.{ext}', 'myapp'))
                .toBe('myapp.config.{ext}');
        });
    });

    describe('getDiscoveryPaths', () => {
        it('should return paths for all standard patterns with extensions', () => {
            const paths = getDiscoveryPaths('myapp', ['yaml', 'json']);
            
            expect(paths).toContain('myapp.config.yaml');
            expect(paths).toContain('myapp.config.json');
            expect(paths).toContain('myapp.conf.yaml');
            expect(paths).toContain('myapp.conf.json');
            expect(paths).toContain('.myapp/config.yaml');
            expect(paths).toContain('.myapp/config.json');
            expect(paths).toContain('.myapprc.yaml');
            expect(paths).toContain('.myapprc.json');
            expect(paths).toContain('.myapprc');
        });

        it('should order paths by priority', () => {
            const paths = getDiscoveryPaths('app', ['yaml']);
            
            // First should be the highest priority (1) pattern
            expect(paths[0]).toBe('app.config.yaml');
            // Second should be priority 2
            expect(paths[1]).toBe('app.conf.yaml');
            // Third should be priority 3
            expect(paths[2]).toBe('.app/config.yaml');
        });

        it('should exclude hidden patterns when includeHidden is false', () => {
            const paths = getDiscoveryPaths('myapp', ['yaml'], { includeHidden: false });
            
            // Should include visible patterns
            expect(paths).toContain('myapp.config.yaml');
            expect(paths).toContain('myapp.conf.yaml');
            
            // Should NOT include hidden patterns
            expect(paths).not.toContain('.myapp/config.yaml');
            expect(paths).not.toContain('.myapprc.yaml');
            expect(paths).not.toContain('.myapprc');
        });

        it('should include hidden patterns by default', () => {
            const paths = getDiscoveryPaths('myapp', ['yaml']);
            
            expect(paths).toContain('.myapp/config.yaml');
            expect(paths).toContain('.myapprc.yaml');
            expect(paths).toContain('.myapprc');
        });

        it('should use custom patterns when provided', () => {
            const customPatterns: ConfigNamingPattern[] = [
                { pattern: 'custom-{app}.{ext}', priority: 1, hidden: false },
                { pattern: '{app}.custom.{ext}', priority: 2, hidden: false },
            ];
            
            const paths = getDiscoveryPaths('test', ['json'], { patterns: customPatterns });
            
            expect(paths).toEqual(['custom-test.json', 'test.custom.json']);
        });

        it('should handle empty extensions array', () => {
            const paths = getDiscoveryPaths('myapp', []);
            
            // Only patterns without {ext} should be included
            expect(paths).toContain('.myapprc');
            expect(paths).toHaveLength(1);
        });

        it('should handle multiple extensions in priority order', () => {
            const paths = getDiscoveryPaths('app', ['ts', 'js', 'json']);
            
            // For each pattern, extensions should be in order provided
            const configPaths = paths.filter(p => p.startsWith('app.config.'));
            expect(configPaths).toEqual(['app.config.ts', 'app.config.js', 'app.config.json']);
        });

        it('should work with real-world app names', () => {
            const paths = getDiscoveryPaths('protokoll', ['yaml']);
            
            expect(paths).toContain('protokoll.config.yaml');
            expect(paths).toContain('.protokoll/config.yaml');
        });
    });
});
