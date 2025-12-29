# Project Roadmap

`cardigantime` is a robust configuration management tool designed to bring type safety and developer ergonomics to Node.js applications. This roadmap outlines the strategic direction for the project, focusing on usability, integration, and advanced features.

## 🎯 Short-Term Goals (v0.1.x - v0.2.0)

Focus: Stability, Developer Experience, and Documentation.

- [x] **Testing & Robustness**: Achieve >90% code coverage and >90% branch coverage (In Progress).
- [x] **AI Documentation**: Establish a `guide/` directory for LLM-friendly documentation.
- [ ] **Interactive Initialization**: Add a `cardigantime init` CLI command to help users generate schemas and setup projects interactively.
- [ ] **Config Validation CLI**: Enhance the CLI to validate existing config files against a schema without running the full application.
- [ ] **Better Error Messages**: Provide human-readable, actionable error messages for Zod validation failures (e.g., "Field 'server.port' is missing" instead of raw Zod errors).

## 🚀 Medium-Term Goals (v0.5.0)

Focus: Integration ecosystem and advanced configuration features.

- [ ] **Environment Variable Mapping**:
    - Auto-map `MYAPP_SERVER_PORT` to `server.port` configuration.
    - Support prefixing (e.g., `MYAPP_`) to avoid collisions.
- [ ] **Remote Configuration**:
    - Support loading configuration from remote URLs (HTTP/HTTPS).
    - Support loading from cloud stores (AWS Parameter Store, S3, Secrets Manager).
- [ ] **Hot Reloading**:
    - Watch configuration files for changes and emit events when configuration updates.
    - Allow applications to react to config changes without restarting.
- [ ] **Configuration Profiles**:
    - Explicit support for "profiles" (e.g., `dev`, `prod`, `test`) that load specific override files (e.g., `config.dev.yaml`).

## 🌟 Long-Term Vision (v1.0.0+)

Focus: Enterprise-grade features and framework integration.

- [ ] **Framework Plugins**:
    - **NestJS Module**: Drop-in module for NestJS applications.
    - **Fastify Plugin**: Seamless integration with Fastify.
- [ ] **Secret Management**:
    - Native integration with secret managers to inject sensitive values securely at runtime.
    - Support for encrypted values in configuration files (e.g., SOPS integration).
- [ ] **Schema Export**:
    - Generate JSON Schema from Zod definition for IDE autocompletion (VS Code) in YAML/JSON files.
    - Generate TypeScript interfaces from configuration schema.
- [ ] **Multi-Format Support**:
    - First-class support for JSON, TOML, and JSON5 alongside YAML.

## 💡 Experimental Ideas

- **AI-Generated Config**: Use LLMs to generate valid configuration based on the Zod schema and user intent.
- **Config Diff**: CLI tool to show the difference between the default config and the current effective config.
- **Runtime Type Reflection**: Expose schema metadata at runtime for building admin UIs automatically.

