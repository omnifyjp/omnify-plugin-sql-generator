/**
 * @famgia/omnify-sql - Raw SQL Migration Generator
 *
 * Generates versioned SQL migration files from Omnify schemas.
 *
 * @example
 * ```typescript
 * import { generateMigrations } from '@famgia/omnify-sql';
 *
 * const migrations = generateMigrations(schemas, {
 *   dialect: 'mysql',
 *   ifNotExists: true,
 * });
 *
 * for (const migration of migrations) {
 *   console.log(migration.fileName);
 *   console.log(migration.content);
 * }
 * ```
 */

// Types
export type {
  SqlDialect,
  SqlIndexType,
  SqlMigration,
  SqlColumn,
  SqlForeignKey,
  SqlIndex,
  SqlTable,
  SqlGeneratorOptions,
  ResolvedSqlOptions,
} from './types.js';

// Migration generator
export {
  generateMigrations,
  generateMigrationFromSchema,
  generateDropMigration,
  getMigrationPath,
} from './migration/index.js';

// Schema builder
export {
  toSnakeCase,
  toTableName,
  toColumnName,
  schemaToTable,
  generatePivotTable,
  generateMorphPivotTable,
} from './migration/index.js';

// Dialect utilities
export {
  getSqlType,
  getPrimaryKeyType,
  getForeignKeyType,
  getEnumType,
} from './dialects/types.js';

export {
  quoteIdentifier,
  quoteString,
  formatColumn,
  formatForeignKey,
  formatIndex,
  formatCreateTable,
  formatDropTable,
} from './dialects/formatter.js';
