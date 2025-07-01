#!/usr/bin/env tsx

/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */

/**
 * Demonstration of the --check-config feature
 * 
 * This script shows how the new --check-config command line argument
 * displays resolved configuration with source tracking, similar to git blame.
 * 
 * Usage:
 *   npx tsx docs/check-config-demo.ts --help
 *   npx tsx docs/check-config-demo.ts --check-config
 *   npx tsx docs/check-config-demo.ts --config-directory ./some/path --check-config
 */

import { Command } from 'commander';
import { z } from 'zod';
import { create } from '../src/cardigantime';

// Define a sample configuration schema
const MyAppConfigSchema = z.object({
    api: z.object({
        endpoint: z.string().default('https://api.example.com'),
        timeout: z.number().default(5000),
        retries: z.number().default(3)
    }),
    features: z.array(z.string()).default(['auth', 'logging']),
    debug: z.boolean().default(false),
    outputDir: z.string().default('./output'),
    excludePatterns: z.array(z.string()).default(['*.tmp', '*.log'])
});

async function main() {
    // Create a Cardigantime instance with hierarchical configuration support
    const cardigantime = create({
        defaults: {
            configDirectory: './.myapp-config',
            configFile: 'config.yaml',
            // Configure path resolution for outputDir
            pathResolution: {
                pathFields: ['outputDir'],
                resolvePathArray: []
            },
            // Configure how arrays are merged in hierarchical mode
            fieldOverlaps: {
                'features': 'append',           // Accumulate features from all levels
                'excludePatterns': 'prepend'    // Higher precedence patterns come first
            }
        },
        features: ['config', 'hierarchical'],
        configShape: MyAppConfigSchema.shape
    });

    // Create the CLI program
    const program = new Command();
    program
        .name('check-config-demo')
        .description('Demonstration of Cardigantime\'s --check-config feature')
        .version('1.0.0');

    // Configure the program with Cardigantime options
    await cardigantime.configure(program);

    // Add a custom action that shows how to use checkConfig
    program.action(async (options) => {
        console.log('Check Config Demo - Hierarchical Configuration Source Tracking\n');

        if (options.checkConfig) {
            // Use the checkConfig method to display configuration sources
            console.log('📋 Running configuration check with source tracking...\n');
            try {
                await cardigantime.checkConfig(options);
            } catch (error: any) {
                console.error('❌ Configuration check failed:', error.message);
                process.exit(1);
            }
            return;
        }

        if (options.initConfig) {
            // Generate initial configuration
            console.log('🔧 Generating initial configuration...\n');
            try {
                await cardigantime.generateConfig(options.configDirectory);
            } catch (error: any) {
                console.error('❌ Configuration generation failed:', error.message);
                process.exit(1);
            }
            return;
        }

        // Normal application flow
        console.log('📖 Reading configuration normally...\n');
        try {
            const config = await cardigantime.read(options);
            await cardigantime.validate(config);

            console.log('✅ Configuration loaded successfully!');
            console.log('Configuration summary:');
            console.log(`  Config Directory: ${config.configDirectory}`);
            console.log(`  API Endpoint: ${config.api.endpoint}`);
            console.log(`  API Timeout: ${config.api.timeout}ms`);
            console.log(`  Features: [${config.features.join(', ')}]`);
            console.log(`  Debug Mode: ${config.debug}`);
            console.log(`  Output Directory: ${config.outputDir}`);
            console.log(`  Exclude Patterns: [${config.excludePatterns.map(p => `"${p}"`).join(', ')}]`);

            console.log('\n💡 Try running with --check-config to see detailed source tracking!');
            console.log('💡 Try running with --init-config to generate a sample configuration!');

        } catch (error: any) {
            console.error('❌ Configuration error:', error.message);
            process.exit(1);
        }
    });

    // Parse command line arguments
    try {
        await program.parseAsync();
    } catch (error: any) {
        console.error('❌ Command error:', error.message);
        process.exit(1);
    }
}

// Helper to create example configuration structure for testing
export async function createExampleConfigStructure() {
    console.log(`
📁 To test hierarchical configuration, create this structure:

project/
├── .myapp-config/
│   └── config.yaml          # Lower precedence (parent)
└── subproject/
    └── .myapp-config/
        └── config.yaml      # Higher precedence (child)

Example parent config (project/.myapp-config/config.yaml):
---
api:
  endpoint: "https://api.parent.com"
  timeout: 10000
features:
  - auth
  - logging  
debug: false
outputDir: ./build
excludePatterns:
  - "*.tmp"

Example child config (project/subproject/.myapp-config/config.yaml):
---
api:
  endpoint: "https://api.child.com"
  retries: 5
features:
  - analytics
debug: true
excludePatterns:
  - "*.log"

With 'append' mode for features and 'prepend' mode for excludePatterns:
- Final features: ["auth", "logging", "analytics"] (parent + child)
- Final excludePatterns: ["*.log", "*.tmp"] (child first, then parent)
- Final api.endpoint: "https://api.child.com" (child overrides parent)
`);
}

// Run main function if this file is executed directly
main().catch(console.error); 