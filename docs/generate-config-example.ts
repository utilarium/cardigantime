/* eslint-disable no-console, import/no-extraneous-dependencies */
import { create } from '@theunwalked/cardigantime';
import { z } from 'zod';

// Define a comprehensive configuration schema with default values
const MyAppConfigSchema = z.object({
    // Application settings
    appName: z.string().default('my-awesome-app'),
    version: z.string().default('1.0.0'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),

    // Server configuration
    server: z.object({
        host: z.string().default('localhost'),
        port: z.number().min(1).max(65535).default(3000),
        ssl: z.boolean().default(false),
    }),

    // Database configuration
    database: z.object({
        host: z.string().default('localhost'),
        port: z.number().default(5432),
        name: z.string().default('myapp_db'),
        ssl: z.boolean().default(false),
        maxConnections: z.number().positive().default(10),
    }),

    // API configuration
    api: z.object({
        baseUrl: z.string().url().default('https://api.example.com'),
        timeout: z.number().positive().default(5000),
        retries: z.number().min(0).max(10).default(3),
        rateLimit: z.number().positive().default(100),
    }),

    // Logging configuration
    logging: z.object({
        level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
        outputs: z.array(z.string()).default(['console', 'file']),
        format: z.enum(['json', 'text']).default('text'),
    }),

    // Feature flags
    features: z.object({
        auth: z.boolean().default(true),
        analytics: z.boolean().default(false),
        metrics: z.boolean().default(true),
        debugging: z.boolean().default(false),
    }),

    // File paths (these might be resolved relative to config directory)
    paths: z.object({
        uploads: z.string().default('./uploads'),
        logs: z.string().default('./logs'),
        cache: z.string().default('./cache'),
    }),

    // Optional advanced settings
    advanced: z.object({
        workers: z.number().positive().default(4),
        memoryLimit: z.string().default('512MB'),
        gcInterval: z.number().positive().default(60000),
    }).optional(),

    // Array of allowed origins for CORS
    allowedOrigins: z.array(z.string()).default(['http://localhost:3000']),

    // Custom metadata as a record
    metadata: z.record(z.string(), z.string()).default({}),
});

// Create a Cardigantime instance
const cardigantime = create({
    defaults: {
        configDirectory: './config',
        configFile: 'myapp.yaml',
        isRequired: false,
    },
    configShape: MyAppConfigSchema.shape,
    features: ['config'],
});

// Example usage function
async function demonstrateConfigGeneration() {
    try {
        console.log('🚀 Generating configuration file with default values...');

        // Generate config file in the default directory
        await cardigantime.generateConfig();

        console.log('✅ Configuration file generated successfully!');
        console.log('📁 Check ./config/myapp.yaml for your new configuration file');

        // You can also generate in a custom directory
        console.log('\n🔧 Generating configuration in a custom directory...');
        await cardigantime.generateConfig('./my-custom-config');

        console.log('✅ Custom configuration file generated successfully!');
        console.log('📁 Check ./my-custom-config/myapp.yaml for the custom configuration');

        // Try generating again to see the "file exists" behavior
        console.log('\n🔄 Trying to generate again to demonstrate existing file behavior...');
        await cardigantime.generateConfig();

    } catch (error: any) {
        console.error('❌ Error generating configuration:', error.message);

        if (error.name === 'FileSystemError') {
            console.error('💡 Tip: Make sure you have write permissions for the target directory');
        }
    }
}

// CLI usage example
async function setupNewProject() {
    console.log('🎯 Setting up a new project with CardiganTime...');

    try {
        // Step 1: Generate initial configuration
        await cardigantime.generateConfig('./project-config');
        console.log('✅ Initial configuration created');

        // Step 2: You can now customize the generated file
        console.log('📝 Next steps:');
        console.log('   1. Edit ./project-config/myapp.yaml to customize your settings');
        console.log('   2. Update database connection details');
        console.log('   3. Configure your API endpoints');
        console.log('   4. Set appropriate feature flags');

        // Step 3: Later, read and validate the configuration
        const config = await cardigantime.read({ configDirectory: './project-config' });
        await cardigantime.validate(config);

        console.log('🎉 Project configuration is ready!');
        console.log('Application:', config.appName);
        console.log('Environment:', config.environment);
        console.log('Server will run on:', `${config.server.host}:${config.server.port}`);

    } catch (error: any) {
        console.error('❌ Setup failed:', error.message);
    }
}

// Run the examples
if (require.main === module) {
    demonstrateConfigGeneration()
        .then(() => console.log('\n' + '='.repeat(50)))
        .then(() => setupNewProject())
        .catch(console.error);
}

export { demonstrateConfigGeneration, setupNewProject }; 