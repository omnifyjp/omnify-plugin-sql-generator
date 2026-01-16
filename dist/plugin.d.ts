import { OmnifyPlugin } from '@famgia/omnify-types';
import { c as SqlDialect } from './types-DkJkHX8d.js';

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

/**
 * Options for the SQL plugin.
 */
interface SqlPluginOptions {
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
 * Creates the SQL plugin with the specified options.
 *
 * @param options - Plugin configuration options
 * @returns OmnifyPlugin configured for SQL
 */
declare function sqlPlugin(options?: SqlPluginOptions): OmnifyPlugin;

export { type SqlPluginOptions, sqlPlugin as default, sqlPlugin };
