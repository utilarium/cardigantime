#!/usr/bin/env npx tsx
/**
 * Deep Merge Demo for Cardigantime
 * 
 * This demo shows how cardigantime automatically performs deep merging of nested objects
 * in hierarchical configuration scenarios. This is exactly what you need for merging
 * scopeRoots configurations across parent directories.
 */

/* eslint-disable no-console */

import { deepMergeConfigs } from '../src/util/hierarchical';

console.log('🔧 Cardigantime Deep Merge Demo');
console.log('================================\n');

console.log('This demonstrates deep merging of nested objects like scopeRoots.\n');

// Simulate the exact scenario described:
// 1. ../../.kodrdriv/config.yaml (lower precedence)
// 2. ../.kodrdriv/config.yaml (higher precedence)

const lowerPrecedenceConfig = {
    link: null,
    scopeRoots: {
        "@theunwalked": "../../tobrien",
        "@riotprompt": "../../tobrien"
    }
};

const higherPrecedenceConfig = {
    link: null,
    scopeRoots: {
        "@powerfuck": "../../powerfuck"
    }
};

console.log('📁 Lower precedence config (../../.kodrdriv/config.yaml):');
console.log(JSON.stringify(lowerPrecedenceConfig, null, 2));
console.log('');

console.log('📁 Higher precedence config (../.kodrdriv/config.yaml):');
console.log(JSON.stringify(higherPrecedenceConfig, null, 2));
console.log('');

// Perform the deep merge (this happens automatically in cardigantime)
const mergedConfig = deepMergeConfigs([lowerPrecedenceConfig, higherPrecedenceConfig]);

console.log('✨ Merged result (what cardigantime produces):');
console.log(JSON.stringify(mergedConfig, null, 2));
console.log('');

console.log('🎯 Key points:');
console.log('- The scopeRoots objects were merged deeply, not replaced');
console.log('- All scope root mappings are preserved from both configs');
console.log('- This works automatically with hierarchical configuration');
console.log('- No special configuration needed - it\'s the default behavior');
console.log('');

console.log('🚀 To use this in your project:');
console.log('');
console.log('const cardigantime = create({');
console.log('  defaults: {');
console.log('    configDirectory: \'.kodrdriv\',');
console.log('    configFile: \'config.yaml\',');
console.log('  },');
console.log('  features: [\'config\', \'hierarchical\'],');
console.log('  configShape: YourSchema.shape');
console.log('});');
console.log('');
console.log('// The hierarchical discovery will automatically find and deep merge:');
console.log('// - ../../.kodrdriv/config.yaml');
console.log('// - ../.kodrdriv/config.yaml');
console.log('// - ./.kodrdriv/config.yaml (if it exists)');

// Additional examples with more complex scenarios
console.log('\n🔍 Additional Examples\n');

console.log('Example 1: Multiple levels with different scope mappings');
const level3Config = {
    scopeRoots: {
        "@global": "../../shared",
        "@utils": "../../utilities"
    }
};

const level2Config = {
    scopeRoots: {
        "@team": "../team-shared",
        "@components": "../components"
    }
};

const level1Config = {
    scopeRoots: {
        "@local": "./local-modules",
        "@global": "./overridden-global"  // This will override the global one
    }
};

const multiLevelMerged = deepMergeConfigs([level3Config, level2Config, level1Config]);

console.log('Three-level merge result:');
console.log(JSON.stringify(multiLevelMerged, null, 2));
console.log('');

console.log('Example 2: Mixed configuration with other nested objects');
const config1 = {
    database: {
        primary: { host: 'localhost', port: 5432 },
        replica: { host: 'replica1' }
    },
    scopeRoots: {
        "@db": "../../database-modules"
    }
};

const config2 = {
    database: {
        primary: { port: 5433 },
        backup: { host: 'backup1' }
    },
    scopeRoots: {
        "@api": "../../api-modules"
    }
};

const mixedMerged = deepMergeConfigs([config1, config2]);

console.log('Mixed configuration merge result:');
console.log(JSON.stringify(mixedMerged, null, 2));
console.log('');

console.log('✅ Summary: This functionality is already built into cardigantime!');
console.log('   Enable hierarchical discovery and all nested objects merge automatically.'); 