/* eslint-disable no-console */
/**
 * Field Overlaps Demonstration
 * 
 * This script demonstrates the new configurable array overlap functionality
 * in hierarchical configuration mode.
 */
import { deepMergeConfigs } from '../src/util/hierarchical';

console.log('🔧 Cardigantime Field Overlaps Demo\n');

// Sample configuration data representing hierarchical levels
const level2Config = {
    features: ['auth', 'basic-logging'],
    excludePatterns: ['*.tmp', '*.cache'],
    api: {
        endpoints: ['users', 'health'],
        middleware: ['cors']
    },
    database: {
        migrations: ['001_init', '002_users']
    }
};

const level1Config = {
    features: ['advanced-logging', 'metrics'],
    excludePatterns: ['*.log'],
    api: {
        endpoints: ['admin'],
        middleware: ['auth', 'rate-limit']
    },
    database: {
        migrations: ['003_posts']
    }
};

const level0Config = {
    features: ['debug-mode'],
    excludePatterns: ['*.debug'],
    api: {
        endpoints: ['debug'],
        middleware: ['debug']
    },
    database: {
        migrations: ['004_debug']
    }
};

console.log('📁 Sample Configuration Levels:');
console.log('Level 2 (lowest precedence):', JSON.stringify(level2Config, null, 2));
console.log('Level 1 (medium precedence):', JSON.stringify(level1Config, null, 2));
console.log('Level 0 (highest precedence):', JSON.stringify(level0Config, null, 2));
console.log('\n');

// Demo 1: Default override behavior
console.log('🔄 Demo 1: Default Override Behavior');
const defaultMerge = deepMergeConfigs([level2Config, level1Config, level0Config]);
console.log('Result (arrays override):', JSON.stringify(defaultMerge, null, 2));
console.log('\n');

// Demo 2: Append mode
console.log('➕ Demo 2: Append Mode');
const appendMerge = deepMergeConfigs([level2Config, level1Config, level0Config], {
    'features': 'append',
    'api.endpoints': 'append',
    'database.migrations': 'append'
});
console.log('Result (arrays append):', JSON.stringify(appendMerge, null, 2));
console.log('\n');

// Demo 3: Prepend mode
console.log('⬆️ Demo 3: Prepend Mode');
const prependMerge = deepMergeConfigs([level2Config, level1Config, level0Config], {
    'excludePatterns': 'prepend',
    'api.middleware': 'prepend'
});
console.log('Result (arrays prepend):', JSON.stringify(prependMerge, null, 2));
console.log('\n');

// Demo 4: Mixed modes
console.log('🎯 Demo 4: Mixed Overlap Modes');
const mixedMerge = deepMergeConfigs([level2Config, level1Config, level0Config], {
    'features': 'append',              // Accumulate all features
    'excludePatterns': 'prepend',      // Higher precedence patterns first
    'api.endpoints': 'append',         // Combine all endpoints
    'api.middleware': 'override',      // Use only highest precedence middleware
    'database.migrations': 'append'    // Accumulate all migrations
});
console.log('Result (mixed modes):', JSON.stringify(mixedMerge, null, 2));
console.log('\n');

// Demo 5: Real-world example
console.log('🌍 Demo 5: Real-world Application Configuration');

const globalConfig = {
    features: ['security', 'logging'],
    middleware: ['helmet', 'cors'],
    allowedOrigins: ['https://prod.example.com'],
    excludePatterns: ['node_modules/**', '.git/**']
};

const projectConfig = {
    features: ['analytics', 'monitoring'],
    middleware: ['compression'],
    allowedOrigins: ['https://staging.example.com'],
    excludePatterns: ['dist/**']
};

const localConfig = {
    features: ['debug', 'hot-reload'],
    middleware: ['morgan'],
    allowedOrigins: ['http://localhost:3000'],
    excludePatterns: ['*.log', '*.tmp']
};

const realWorldMerge = deepMergeConfigs([globalConfig, projectConfig, localConfig], {
    'features': 'append',          // All features are useful
    'middleware': 'append',        // Stack middleware
    'allowedOrigins': 'append',    // Allow all origins in dev
    'excludePatterns': 'prepend'   // Local excludes take precedence
});

console.log('Global config:', JSON.stringify(globalConfig, null, 2));
console.log('Project config:', JSON.stringify(projectConfig, null, 2));
console.log('Local config:', JSON.stringify(localConfig, null, 2));
console.log('Final merged config:', JSON.stringify(realWorldMerge, null, 2));

console.log('\n✨ Field overlaps enable powerful configuration composition!');
console.log('   Use "append" for accumulating features and capabilities');
console.log('   Use "prepend" for precedence-based ordering');
console.log('   Use "override" for replacing entire arrays'); 