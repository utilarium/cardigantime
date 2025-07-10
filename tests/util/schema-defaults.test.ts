import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { extractSchemaDefaults, generateDefaultConfig } from '../../src/util/schema-defaults';

describe('schema-defaults', () => {
    describe('extractSchemaDefaults', () => {
        test('should extract simple default values', () => {
            const schema = z.object({
                name: z.string().default('test'),
                port: z.number().default(3000),
                debug: z.boolean().default(false)
            });

            const result = extractSchemaDefaults(schema);

            expect(result).toEqual({
                name: 'test',
                port: 3000,
                debug: false
            });
        });

        test('should handle nested objects with defaults', () => {
            const schema = z.object({
                app: z.object({
                    name: z.string().default('myapp'),
                    version: z.string().default('1.0.0')
                }),
                database: z.object({
                    host: z.string().default('localhost'),
                    port: z.number().default(5432)
                })
            });

            const result = extractSchemaDefaults(schema);

            expect(result).toEqual({
                app: {
                    name: 'myapp',
                    version: '1.0.0'
                },
                database: {
                    host: 'localhost',
                    port: 5432
                }
            });
        });

        test('should handle optional fields with defaults', () => {
            const schema = z.object({
                required: z.string().default('value'),
                optional: z.string().optional().default('optional-value'),
                nullable: z.string().nullable().default('nullable-value')
            });

            const result = extractSchemaDefaults(schema);

            expect(result).toEqual({
                required: 'value',
                optional: 'optional-value',
                nullable: 'nullable-value'
            });
        });

        test('should handle arrays with defaults', () => {
            const schema = z.object({
                tags: z.array(z.string()).default(['tag1', 'tag2']),
                numbers: z.array(z.number()).default([1, 2, 3]),
                objects: z.array(z.object({
                    id: z.number().default(1),
                    name: z.string().default('item')
                })).default([])
            });

            const result = extractSchemaDefaults(schema);

            expect(result).toEqual({
                tags: ['tag1', 'tag2'],
                numbers: [1, 2, 3],
                objects: []
            });
        });

        test('should handle arrays without explicit defaults', () => {
            const schema = z.object({
                simpleArray: z.array(z.string()),
                objectArray: z.array(z.object({
                    name: z.string().default('test')
                }))
            });

            const result = extractSchemaDefaults(schema);

            expect(result).toEqual({
                simpleArray: [],
                objectArray: [{ name: 'test' }]
            });
        });

        test('should handle record types', () => {
            const schema = z.object({
                metadata: z.record(z.string(), z.string()),
                numbers: z.record(z.string(), z.number())
            });

            const result = extractSchemaDefaults(schema);

            expect(result).toEqual({
                metadata: {},
                numbers: {}
            });
        });

        test('should return undefined for fields without defaults', () => {
            const schema = z.object({
                required: z.string(),
                optional: z.string().optional(),
                withDefault: z.string().default('value')
            });

            const result = extractSchemaDefaults(schema);

            expect(result).toEqual({
                withDefault: 'value'
            });
        });

        test('should handle complex nested structures', () => {
            const schema = z.object({
                api: z.object({
                    baseUrl: z.string().default('https://api.example.com'),
                    timeout: z.number().default(5000),
                    retries: z.number().default(3),
                    headers: z.record(z.string(), z.string()).default({}),
                    endpoints: z.array(z.string()).default(['/health', '/status'])
                }),
                database: z.object({
                    connections: z.object({
                        primary: z.object({
                            host: z.string().default('localhost'),
                            port: z.number().default(5432)
                        }),
                        replica: z.object({
                            host: z.string().optional(),
                            port: z.number().default(5433)
                        })
                    })
                }),
                features: z.array(z.string()).default(['auth', 'logging']),
                debug: z.boolean().default(false)
            });

            const result = extractSchemaDefaults(schema);

            expect(result).toEqual({
                api: {
                    baseUrl: 'https://api.example.com',
                    timeout: 5000,
                    retries: 3,
                    headers: {},
                    endpoints: ['/health', '/status']
                },
                database: {
                    connections: {
                        primary: {
                            host: 'localhost',
                            port: 5432
                        },
                        replica: {
                            port: 5433
                        }
                    }
                },
                features: ['auth', 'logging'],
                debug: false
            });
        });
    });

    describe('generateDefaultConfig', () => {
        test('should generate config excluding configDirectory', () => {
            const shape = z.object({
                name: z.string().default('myapp'),
                port: z.number().default(3000),
                debug: z.boolean().default(false)
            }).shape;

            const result = generateDefaultConfig(shape, './config');

            expect(result).toEqual({
                name: 'myapp',
                port: 3000,
                debug: false
            });
        });

        test('should handle empty schema gracefully', () => {
            const shape = z.object({}).shape;

            const result = generateDefaultConfig(shape, './config');

            expect(result).toEqual({});
        });

        test('should handle schema with no defaults', () => {
            const shape = z.object({
                apiKey: z.string(),
                secret: z.string().optional()
            }).shape;

            const result = generateDefaultConfig(shape, './config');

            expect(result).toEqual({});
        });
    });
}); 