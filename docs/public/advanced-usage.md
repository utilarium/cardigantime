# Advanced Usage

This guide covers advanced scenarios and patterns for using Cardigantime in complex applications.

## Hierarchical Configuration for Monorepos

Perfect for sharing configuration across multiple packages while allowing specific overrides.

### Directory Structure

```
/workspace/
├── .myapp/
│   └── config.yaml              # Global defaults
├── team-frontend/
│   ├── .myapp/
│   │   └── config.yaml          # Team-specific settings
│   ├── app1/
│   │   ├── .myapp/
│   │   │   └── config.yaml      # App-specific overrides
│   │   └── package.json
│   └── app2/
│       └── package.json         # Uses team + global config
```

### Configuration Schema

```typescript
const ProjectConfigSchema = z.object({
  projectName: z.string(),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    ssl: z.boolean().default(false),
    maxConnections: z.number().default(10),
  }),
  api: z.object({
    baseUrl: z.string().url(),
    timeout: z.number().default(5000),
    retries: z.number().default(3),
  }),
  features: z.record(z.boolean()).default({}),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    outputs: z.array(z.string()).default(['console']),
  }),
});

type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
```

### Cardigantime Setup

```typescript
const cardigantime = create({
  defaults: {
    configDirectory: '.myapp',
    configFile: 'config.yaml',
    fieldOverlaps: {
      'features': 'append',           // Accumulate features
      'logging.outputs': 'append',    // Combine logging outputs
    }
  },
  configShape: ProjectConfigSchema.shape,
  features: ['config', 'hierarchical'],
});
```

### Configuration Files

**Global (`/workspace/.myapp/config.yaml`):**
```yaml
database:
  host: prod.db.company.com
  ssl: true
api:
  baseUrl: https://api.company.com
logging:
  level: warn
  outputs: [console, file]
features:
  authentication: true
  monitoring: true
```

**Team (`/workspace/team-frontend/.myapp/config.yaml`):**
```yaml
database:
  host: team-frontend.db.company.com
api:
  timeout: 3000
features:
  analytics: true
  darkMode: true
logging:
  outputs: [console]
```

**App (`/workspace/team-frontend/app1/.myapp/config.yaml`):**
```yaml
projectName: frontend-app1
environment: development
database:
  host: localhost  # Override for local development
logging:
  level: debug
features:
  debugMode: true
```

## Complex Configuration Schema

### Advanced Validation Patterns

```typescript
// Base configurations for reuse
const DatabaseConfig = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(8),
  ssl: z.boolean().default(false),
  connectionTimeout: z.number().positive().default(30000),
});

const RedisConfig = z.object({
  url: z.string().url(),
  ttl: z.number().positive().default(3600),
  maxRetries: z.number().min(0).max(10).default(3),
});

// Main application configuration
const AppConfigSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    environment: z.enum(['development', 'staging', 'production']),
    port: z.number().min(1000).max(65535).default(3000),
  }),
  
  // Multiple database connections
  databases: z.object({
    primary: DatabaseConfig,
    readonly: DatabaseConfig.optional(),
    analytics: DatabaseConfig.optional(),
  }),
  
  // Cache configuration
  cache: z.object({
    redis: RedisConfig,
    memory: z.object({
      maxSize: z.string().regex(/^\d+[KMG]B$/),
      ttl: z.number().positive().default(300),
    }).optional(),
  }),
  
  // Feature flags with validation
  features: z.record(z.boolean()).default({}),
  
  // Advanced logging configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    transports: z.array(z.enum(['console', 'file', 'syslog'])).default(['console']),
    rotation: z.object({
      maxSize: z.string().regex(/^\d+[KMG]B$/),
      maxFiles: z.number().positive().default(5),
      frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    }).optional(),
  }),
  
  // Security configuration with conditional validation
  security: z.object({
    ssl: z.object({
      enabled: z.boolean().default(false),
      certPath: z.string().optional(),
      keyPath: z.string().optional(),
      passphrase: z.string().optional(),
    }).refine(
      (data) => !data.enabled || (data.certPath && data.keyPath),
      {
        message: "SSL certificate and key paths required when SSL is enabled",
        path: ['certPath', 'keyPath'],
      }
    ),
    
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string().url()).default([]),
      methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE'])).default(['GET', 'POST']),
    }),
    
    rateLimit: z.object({
      enabled: z.boolean().default(true),
      windowMs: z.number().positive().default(900000), // 15 minutes
      maxRequests: z.number().positive().default(100),
    }),
  }),
  
  // External service integrations
  integrations: z.object({
    email: z.object({
      provider: z.enum(['smtp', 'sendgrid', 'ses']),
      config: z.record(z.any()), // Provider-specific config
    }).optional(),
    
    monitoring: z.object({
      datadog: z.object({
        apiKey: z.string().min(32),
        tags: z.array(z.string()).default([]),
      }).optional(),
      
      sentry: z.object({
        dsn: z.string().url(),
        environment: z.string(),
        release: z.string().optional(),
      }).optional(),
    }).optional(),
  }),
});

type AppConfig = z.infer<typeof AppConfigSchema>;
```

## Custom Logger Integration

### Winston Logger Setup

```typescript
import winston from 'winston';
import 'winston-daily-rotate-file';

// Create custom logger with multiple transports
const createCustomLogger = (config: AppConfig) => {
  const transports: winston.transport[] = [];
  
  // Console transport
  if (config.logging.transports.includes('console')) {
    transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    }));
  }
  
  // File transport with rotation
  if (config.logging.transports.includes('file') && config.logging.rotation) {
    transports.push(new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.rotation.maxSize,
      maxFiles: config.logging.rotation.maxFiles,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }));
  }
  
  return winston.createLogger({
    level: config.logging.level,
    transports,
    defaultMeta: {
      service: config.app.name,
      version: config.app.version,
      environment: config.app.environment,
    }
  });
};

// Set up Cardigantime with custom logger
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: AppConfigSchema.shape,
  logger, // Use custom logger for Cardigantime itself
});
```

### Using Configuration-Driven Logging

```typescript
async function setupApplication() {
  const program = new Command();
  await cardigantime.configure(program);
  program.parse();
  
  const config = await cardigantime.read(program.opts());
  await cardigantime.validate(config);
  
  // Create application logger based on configuration
  const appLogger = createCustomLogger(config);
  
  // Use the logger throughout your application
  appLogger.info('Application starting', {
    environment: config.app.environment,
    version: config.app.version,
    features: Object.keys(config.features).filter(k => config.features[k])
  });
  
  return { config, logger: appLogger };
}
```

## Environment-Specific Configuration

### Dynamic Configuration Based on Environment

```typescript
const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';
const isDevelopment = environment === 'development';

const cardigantime = create({
  defaults: {
    configDirectory: isProduction ? '/etc/myapp' : './config',
    configFile: `${environment}.yaml`,
    isRequired: isProduction, // Require config in production only
    encoding: 'utf8',
    
    // Path resolution only in development
    pathResolution: isDevelopment ? {
      pathFields: ['ssl.certPath', 'ssl.keyPath', 'logging.rotation.directory'],
      resolvePathArray: ['integrations.monitoring.datadog.tags']
    } : undefined,
    
    // Different field overlap strategies per environment
    fieldOverlaps: isProduction ? {
      'security.cors.origins': 'override', // Strict in production
      'features': 'override',
    } : {
      'security.cors.origins': 'append',   // Flexible in development
      'features': 'append',
    }
  },
  
  configShape: AppConfigSchema.shape,
  features: ['config', ...(isProduction ? ['hierarchical'] as const : [])],
  logger: isDevelopment ? console : productionLogger,
});
```

### Configuration Validation by Environment

```typescript
// Add environment-specific validation
const validateEnvironmentConfig = (config: AppConfig) => {
  if (config.app.environment === 'production') {
    // Production-specific validations
    if (!config.security.ssl.enabled) {
      throw new Error('SSL must be enabled in production');
    }
    
    if (config.logging.level === 'debug') {
      throw new Error('Debug logging not allowed in production');
    }
    
    if (!config.integrations?.monitoring) {
      throw new Error('Monitoring integration required in production');
    }
  }
  
  if (config.app.environment === 'development') {
    // Development-specific warnings
    if (config.security.ssl.enabled && (!config.ssl?.certPath || !config.ssl?.keyPath)) {
      console.warn('⚠️  SSL enabled but certificate paths not configured');
    }
  }
};

// Use in your application setup
async function main() {
  const config = await cardigantime.read(args);
  await cardigantime.validate(config);
  
  // Additional environment-specific validation
  validateEnvironmentConfig(config);
  
  await startApplication(config);
}
```

## Configuration Hot Reloading

### File Watching for Development

```typescript
import chokidar from 'chokidar';

class ConfigurationManager {
  private currentConfig: AppConfig;
  private configChangeCallbacks: Array<(config: AppConfig) => void> = [];
  
  constructor(private cardigantime: ReturnType<typeof create>) {}
  
  async loadInitialConfig(args: any): Promise<AppConfig> {
    this.currentConfig = await this.cardigantime.read(args);
    await this.cardigantime.validate(this.currentConfig);
    return this.currentConfig;
  }
  
  startWatching(configDirectory: string) {
    const watcher = chokidar.watch(`${configDirectory}/**/*.yaml`, {
      persistent: true,
      ignoreInitial: true,
    });
    
    watcher.on('change', async (path) => {
      console.log(`Configuration file changed: ${path}`);
      
      try {
        // Reload configuration
        const newConfig = await this.cardigantime.read({});
        await this.cardigantime.validate(newConfig);
        
        const oldConfig = this.currentConfig;
        this.currentConfig = newConfig;
        
        // Notify all listeners
        this.configChangeCallbacks.forEach(callback => {
          try {
            callback(newConfig);
          } catch (error) {
            console.error('Error in config change callback:', error);
          }
        });
        
        console.log('✅ Configuration reloaded successfully');
        
      } catch (error) {
        console.error('❌ Failed to reload configuration:', error.message);
      }
    });
    
    return watcher;
  }
  
  onConfigChange(callback: (config: AppConfig) => void) {
    this.configChangeCallbacks.push(callback);
  }
  
  getCurrentConfig(): AppConfig {
    return this.currentConfig;
  }
}

// Usage
const configManager = new ConfigurationManager(cardigantime);

async function setupApp() {
  const config = await configManager.loadInitialConfig(args);
  
  // Set up hot reloading in development
  if (config.app.environment === 'development') {
    configManager.startWatching('./config');
    
    configManager.onConfigChange((newConfig) => {
      console.log('Applying new configuration...');
      // Update application components with new config
      updateDatabaseConnections(newConfig.databases);
      updateLogger(newConfig.logging);
      updateFeatureFlags(newConfig.features);
    });
  }
  
  return config;
}
```

## Configuration Composition Patterns

### Modular Configuration

```typescript
// Separate schemas for different concerns
const DatabaseSchema = z.object({
  databases: z.object({
    primary: DatabaseConfig,
    readonly: DatabaseConfig.optional(),
  })
});

const SecuritySchema = z.object({
  security: z.object({
    ssl: z.object({
      enabled: z.boolean().default(false),
      certPath: z.string().optional(),
      keyPath: z.string().optional(),
    }),
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string().url()).default([]),
    }),
  })
});

const LoggingSchema = z.object({
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    transports: z.array(z.enum(['console', 'file'])).default(['console']),
  })
});

// Compose into final schema
const ComposedSchema = DatabaseSchema.merge(SecuritySchema).merge(LoggingSchema);
```

### Plugin-Based Configuration

```typescript
interface ConfigPlugin {
  name: string;
  schema: z.ZodSchema<any>;
  configPath?: string;
  priority?: number;
}

class PluginConfigManager {
  private plugins: ConfigPlugin[] = [];
  
  registerPlugin(plugin: ConfigPlugin) {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  
  buildSchema() {
    let baseSchema = z.object({});
    
    for (const plugin of this.plugins) {
      baseSchema = baseSchema.merge(plugin.schema);
    }
    
    return baseSchema;
  }
  
  async loadPluginConfigs(baseConfig: any) {
    const pluginConfigs: Record<string, any> = {};
    
    for (const plugin of this.plugins) {
      if (plugin.configPath) {
        try {
          const pluginConfig = await loadYamlFile(plugin.configPath);
          pluginConfigs[plugin.name] = pluginConfig;
        } catch (error) {
          console.warn(`Failed to load config for plugin ${plugin.name}:`, error.message);
        }
      }
    }
    
    return { ...baseConfig, plugins: pluginConfigs };
  }
}

// Usage
const pluginManager = new PluginConfigManager();

pluginManager.registerPlugin({
  name: 'database',
  schema: DatabaseSchema,
  configPath: './plugins/database.yaml',
  priority: 100,
});

pluginManager.registerPlugin({
  name: 'authentication',
  schema: AuthSchema,
  configPath: './plugins/auth.yaml', 
  priority: 90,
});

const composedSchema = pluginManager.buildSchema();
const cardigantime = create({
  defaults: { configDirectory: './config' },
  configShape: composedSchema.shape,
});
```

This advanced usage guide demonstrates how Cardigantime can handle sophisticated configuration scenarios while maintaining type safety and excellent developer experience. 