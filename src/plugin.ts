/**
 * @famgia/omnify-sql - Plugin
 *
 * Plugin wrapper for SQL migration generator.
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@famgia/omnify';
 * import sql from '@famgia/omnify-sql/plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     sql({
 *       dialect: 'postgresql',
 *       migrationsPath: 'migrations',
 *     }),
 *   ],
 * });
 * ```
 */

import type { OmnifyPlugin, GeneratorOutput, GeneratorContext } from '@famgia/omnify-types';
import type { SqlDialect, SqlGeneratorOptions } from './types.js';
import { generateMigrations, getMigrationPath } from './migration/index.js';

/**
 * Options for the SQL plugin.
 */
export interface SqlPluginOptions {
  /**
   * SQL dialect to generate.
   * @default 'mysql'
   */
  dialect?: SqlDialect;

  /**
   * Path for SQL migration files.
   * @default 'migrations'
   */
  migrationsPath?: string;

  /**
   * Use IF NOT EXISTS in CREATE TABLE.
   * @default true
   */
  ifNotExists?: boolean;

  /**
   * Include commented DROP TABLE in migrations.
   * @default true
   */
  generateDown?: boolean;

  /**
   * Starting version number.
   * @default 1
   */
  startVersion?: number;

  /**
   * Version number padding (e.g., 4 for 0001).
   * @default 4
   */
  versionPadding?: number;
}

/**
 * Resolved options with defaults.
 */
interface ResolvedPluginOptions {
  dialect: SqlDialect;
  migrationsPath: string;
  ifNotExists: boolean;
  generateDown: boolean;
  startVersion: number;
  versionPadding: number;
}

/**
 * Resolves options with defaults.
 */
function resolveOptions(options?: SqlPluginOptions): ResolvedPluginOptions {
  return {
    dialect: options?.dialect ?? 'mysql',
    migrationsPath: options?.migrationsPath ?? 'migrations',
    ifNotExists: options?.ifNotExists ?? true,
    generateDown: options?.generateDown ?? true,
    startVersion: options?.startVersion ?? 1,
    versionPadding: options?.versionPadding ?? 4,
  };
}

/**
 * Creates the SQL plugin with the specified options.
 *
 * @param options - Plugin configuration options
 * @returns OmnifyPlugin configured for SQL
 */
export default function sqlPlugin(options?: SqlPluginOptions): OmnifyPlugin {
  const resolved = resolveOptions(options);

  return {
    name: '@famgia/omnify-sql',
    version: '0.0.1',

    generators: [
      {
        name: 'sql-migrations',
        description: `Generate ${resolved.dialect.toUpperCase()} SQL migration files`,

        generate: async (ctx: GeneratorContext): Promise<GeneratorOutput[]> => {
          const generatorOptions: SqlGeneratorOptions = {
            dialect: resolved.dialect,
            ifNotExists: resolved.ifNotExists,
            generateDown: resolved.generateDown,
            startVersion: resolved.startVersion,
            versionPadding: resolved.versionPadding,
          };

          const migrations = generateMigrations(ctx.schemas, generatorOptions);

          return migrations.map((migration) => ({
            path: getMigrationPath(migration, resolved.migrationsPath),
            content: migration.content,
            type: 'migration' as const,
            metadata: {
              version: migration.version,
              tables: migration.tables,
              migrationType: migration.type,
              dialect: resolved.dialect,
            },
          }));
        },
      },
    ],
  };
}

// Named export for flexibility
export { sqlPlugin };
