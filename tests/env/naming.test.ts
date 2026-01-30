import { describe, it, expect } from 'vitest';
import { 
  toScreamingSnakeCase, 
  generateEnvVarName, 
  flattenFieldPath 
} from '../../src/env/naming';

describe('toScreamingSnakeCase', () => {
  it('converts simple camelCase', () => {
    expect(toScreamingSnakeCase('planDirectory')).toBe('PLAN_DIRECTORY');
  });

  it('converts apiKey correctly', () => {
    expect(toScreamingSnakeCase('apiKey')).toBe('API_KEY');
  });

  it('converts maxRetryCount correctly', () => {
    expect(toScreamingSnakeCase('maxRetryCount')).toBe('MAX_RETRY_COUNT');
  });

  it('handles consecutive capitals', () => {
    expect(toScreamingSnakeCase('openaiAPIKey')).toBe('OPENAI_API_KEY');
  });

  it('handles numbers', () => {
    expect(toScreamingSnakeCase('maxRetry3Times')).toBe('MAX_RETRY3_TIMES');
  });

  it('handles already uppercase', () => {
    expect(toScreamingSnakeCase('API')).toBe('API');
  });

  it('handles single word', () => {
    expect(toScreamingSnakeCase('port')).toBe('PORT');
  });

  it('handles empty string', () => {
    expect(toScreamingSnakeCase('')).toBe('');
  });

  it('handles single character', () => {
    expect(toScreamingSnakeCase('a')).toBe('A');
  });

  it('handles multiple consecutive capitals followed by lowercase', () => {
    expect(toScreamingSnakeCase('HTTPSConnection')).toBe('HTTPS_CONNECTION');
  });

  it('handles numbers at start', () => {
    expect(toScreamingSnakeCase('3dModel')).toBe('3D_MODEL');
  });

  it('handles underscores in input (pass through)', () => {
    expect(toScreamingSnakeCase('already_snake')).toBe('ALREADY_SNAKE');
  });
});

describe('generateEnvVarName', () => {
  it('generates name with prefix', () => {
    expect(generateEnvVarName('riotplan', 'planDirectory'))
      .toBe('RIOTPLAN_PLAN_DIRECTORY');
  });

  it('handles nested paths as array', () => {
    expect(generateEnvVarName('riotplan', ['api', 'key']))
      .toBe('RIOTPLAN_API_KEY');
  });

  it('handles deeply nested paths', () => {
    expect(generateEnvVarName('riotplan', ['config', 'server', 'port']))
      .toBe('RIOTPLAN_CONFIG_SERVER_PORT');
  });

  it('uppercases app name', () => {
    expect(generateEnvVarName('MyApp', 'setting'))
      .toBe('MYAPP_SETTING');
  });

  it('handles lowercase app name', () => {
    expect(generateEnvVarName('protokoll', 'maxRetries'))
      .toBe('PROTOKOLL_MAX_RETRIES');
  });

  it('handles mixed case app name', () => {
    expect(generateEnvVarName('OpenAI', 'apiKey'))
      .toBe('OPENAI_API_KEY');
  });

  it('handles single segment array path', () => {
    expect(generateEnvVarName('app', ['setting']))
      .toBe('APP_SETTING');
  });

  it('handles camelCase in nested paths', () => {
    expect(generateEnvVarName('riotplan', ['apiConfig', 'maxRetries']))
      .toBe('RIOTPLAN_API_CONFIG_MAX_RETRIES');
  });
});

describe('flattenFieldPath', () => {
  it('flattens array to dot notation', () => {
    expect(flattenFieldPath(['api', 'key'])).toBe('api.key');
  });

  it('handles deeply nested paths', () => {
    expect(flattenFieldPath(['config', 'server', 'http', 'port']))
      .toBe('config.server.http.port');
  });

  it('handles single element array', () => {
    expect(flattenFieldPath(['setting'])).toBe('setting');
  });

  it('handles empty array', () => {
    expect(flattenFieldPath([])).toBe('');
  });

  it('handles three levels', () => {
    expect(flattenFieldPath(['a', 'b', 'c'])).toBe('a.b.c');
  });
});
