import { describe, expect, it, vi } from 'vitest';
// We need to access non-exported functions if possible, but read.ts doesn't export them.
// So we must test them via checkConfig which calls them.
import { checkConfig } from '../src/read';
import * as storage from '../src/util/storage';
import * as hierarchical from '../src/util/hierarchical';
import { z } from 'zod';

// Mock dependencies
vi.mock('../src/util/storage');
vi.mock('../src/util/hierarchical');

describe('read.ts internals via checkConfig', () => {
    const mockLogger = {
        info: vi.fn(),
        verbose: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    };

    const options = {
        defaults: {
            configDirectory: '/config',
            configFile: 'config.yaml'
        },
        configShape: z.object({}).shape,
        features: [],
        logger: mockLogger
    };

    // Helper to reset mocks
    const resetMocks = () => {
        vi.clearAllMocks();
        vi.mocked(hierarchical.loadHierarchicalConfig).mockResolvedValue({
            config: {},
            discoveredDirs: [],
            resolvedConfigDirs: [],
            errors: []
        });
        vi.mocked(storage.create).mockReturnValue({
            exists: vi.fn().mockResolvedValue(true),
            isFileReadable: vi.fn().mockResolvedValue(true),
            readFile: vi.fn().mockResolvedValue('key: value'),
            // Add other methods if needed
        } as any);
    };

    it('should format null/undefined/boolean/number values correctly in output', async () => {
        resetMocks();
        const complexConfig = {
            nullVal: null,
            undefVal: undefined, // Won't show up usually but good to test
            boolVal: true,
            numVal: 123,
            strVal: 'string',
            emptyArr: [],
            shortArr: [1, 2],
            longArr: [1, 2, 3, 4],
            emptyObj: {},
            shortObj: { a: 1 },
            longObj: { a: 1, b: 2, c: 3 }
        };

        // Mock loadSingleDirectoryConfig internal call by mocking storage
        vi.mocked(storage.create).mockReturnValue({
            exists: vi.fn().mockResolvedValue(true),
            isFileReadable: vi.fn().mockResolvedValue(true),
            readFile: vi.fn().mockResolvedValue(''), // Return empty for initial read
            isDirectoryWritable: vi.fn().mockResolvedValue(true),
            // Mock other methods as needed
        } as any);

        // We can't easily inject the rawFileConfig into checkConfig without mocking loadSingleDirectoryConfig
        // But loadSingleDirectoryConfig is not exported.
        // It calls storage.readFile. We can return the complex config as YAML.
        // But we need safe-dump. JSON.stringify might be enough for simple values if we handle it right?
        // Actually we can just mock the whole flow or use the fact that checkConfig 
        // calls `trackConfigSources` on the result.
        
        // Wait, checkConfig re-reads the file to build the tracker!
        // It calls `loadSingleDirectoryConfig` first, then `trackConfigSources`.
        // AND it re-reads for hierarchical.
        
        // Let's stick to mocking storage.readFile to return YAML that produces our complex config.
        const yamlContent = `
nullVal: null
boolVal: true
numVal: 123
strVal: "string"
emptyArr: []
shortArr: [1, 2]
longArr: [1, 2, 3, 4]
emptyObj: {}
shortObj: { a: 1 }
longObj: { a: 1, b: 2, c: 3 }
`;
        // Undefined is not valid YAML value usually, but key won't exist.
        
        vi.mocked(storage.create).mockReturnValue({
            exists: vi.fn().mockResolvedValue(true),
            isFileReadable: vi.fn().mockResolvedValue(true),
            readFile: vi.fn().mockResolvedValue(yamlContent),
        } as any);

        await checkConfig({ configDirectory: '/config' }, options);

        // Now verify logger.info calls for formatting
        // The implementation does NOT display empty objects in the final flattened output for tracker.
        // trackConfigSources recursively tracks properties.
        // If an object is empty {}, trackConfigSources might not add any key?
        // Let's check trackConfigSources implementation:
        // if (typeof config !== 'object') ... return tracker;
        // for (const [key, value] of Object.entries(config)) ...
        // So empty object {} has no entries, loop doesn't run. 
        // Tracker doesn't get an entry for "emptyObj".
        // That's why it's missing from the output calls.
        
        // Let's remove the expectation for emptyObj.
        // Also remove expectations for intermediate objects if they are flattened.
        
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('nullVal             : null'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('boolVal             : true'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('numVal              : 123'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('strVal              : "string"'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('emptyArr            : []'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('shortArr            : [1, 2]'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('longArr             : [1, 2, ... (4 items)]'));
        
        // Flattened object keys
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('shortObj.a          : 1'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('longObj.a           : 1'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('longObj.b           : 2'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('longObj.c           : 3'));
    });

    it('should handle displayConfigWithSources with empty discovered dirs', async () => {
        resetMocks();
        // Force no dirs found
        // checkConfig uses single directory mode if hierarchical not enabled.
        // It manually constructs discoveredDirs = [{ path, level: 0 }]
        // To trigger "No configuration directories found", we likely need hierarchical enabled 
        // AND hierarchicalResult to return empty.
        
        const hierOptions = {
            ...options,
            features: ['hierarchical']
        };
        
        vi.mocked(hierarchical.loadHierarchicalConfig).mockResolvedValue({
            config: {},
            discoveredDirs: [],
            resolvedConfigDirs: [],
            errors: []
        });

        await checkConfig({ configDirectory: '/config' }, hierOptions);
        
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('No configuration directories found in hierarchy'));
    });

    it('should handle displayConfigWithSources with multiple levels precedence display', async () => {
        resetMocks();
        const hierOptions = {
            ...options,
            features: ['hierarchical']
        };
        
        vi.mocked(hierarchical.loadHierarchicalConfig).mockResolvedValue({
            config: {},
            discoveredDirs: [
                { path: '/config', level: 0 },
                { path: '/root', level: 1 }
            ],
            resolvedConfigDirs: [
                { path: '/config', level: 0 },
                { path: '/root', level: 1 }
            ],
            errors: []
        });

        await checkConfig({ configDirectory: '/config' }, hierOptions);
        
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Level 0: /config (highest precedence)'));
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Level 1: /root (lowest precedence)'));
    });
});

