/**
 * @famgia/omnify-sql - Migration Generator
 *
 * Generates versioned SQL migration files.
 */

import type { SchemaCollection, LoadedSchema, PropertyDefinition } from '@famgia/omnify-types';
import type {
  SqlMigration,
  SqlTable,
  SqlGeneratorOptions,
  ResolvedSqlOptions,
  SqlDialect,
} from '../types.js';

/**
 * Types that have limited or no support in certain dialects.
 */
const DIALECT_INCOMPATIBLE_TYPES: Record<string, { dialects: SqlDialect[]; reason: string }> = {
  Point: {
    dialects: ['sqlite'],
    reason: 'SQLite does not support native spatial types. Point will be stored as TEXT (JSON), which is incompatible with MySQL/PostgreSQL spatial functions (ST_Distance, ST_Within, etc.). Use Coordinates type for cross-database compatibility.',
  },
};

/**
 * Index types that have limited or no support in certain dialects.
 */
const DIALECT_INCOMPATIBLE_INDEX_TYPES: Record<string, { dialects: SqlDialect[]; reason: string; suggestion?: string }> = {
  gin: {
    dialects: ['mysql', 'sqlite'],
    reason: 'GIN (Generalized Inverted Index) is PostgreSQL-specific.',
    suggestion: 'For fulltext search, use type: "fulltext" instead. For JSONB indexing, this only works in PostgreSQL.',
  },
  gist: {
    dialects: ['mysql', 'sqlite'],
    reason: 'GiST (Generalized Search Tree) is PostgreSQL-specific.',
    suggestion: 'For spatial data, use type: "spatial" which works on both MySQL and PostgreSQL.',
  },
  fulltext: {
    dialects: ['sqlite'],
    reason: 'SQLite does not support native fulltext indexes. FTS requires virtual tables which are not auto-generated.',
    suggestion: 'Consider using a regular index or implementing SQLite FTS manually.',
  },
  spatial: {
    dialects: ['sqlite'],
    reason: 'SQLite does not support spatial indexes.',
    suggestion: 'Use Coordinates type with regular indexes for cross-database compatibility.',
  },
};

/**
 * Validates that schema types and index types are compatible with the target dialect.
 * Throws an error if incompatible types are found.
 */
function validateSchemaCompatibility(
  schemas: SchemaCollection,
  dialect: SqlDialect
): void {
  const errors: string[] = [];

  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (schema.kind === 'enum') continue;

    // Check property types
    if (schema.properties) {
      for (const [propName, property] of Object.entries(schema.properties)) {
        const propType = (property as PropertyDefinition).type;
        const incompatibility = DIALECT_INCOMPATIBLE_TYPES[propType];

        if (incompatibility && incompatibility.dialects.includes(dialect)) {
          errors.push(
            `Schema "${schemaName}", property "${propName}": Type "${propType}" is not supported in ${dialect}. ${incompatibility.reason}`
          );
        }
      }
    }

    // Check index types
    if (schema.options?.indexes) {
      for (const indexDef of schema.options.indexes) {
        if (indexDef.type) {
          const incompatibility = DIALECT_INCOMPATIBLE_INDEX_TYPES[indexDef.type];

          if (incompatibility && incompatibility.dialects.includes(dialect)) {
            const indexName = indexDef.name ?? `index on [${indexDef.columns.join(', ')}]`;
            let message = `Schema "${schemaName}", index "${indexName}": Index type "${indexDef.type}" is not supported in ${dialect}. ${incompatibility.reason}`;
            if (incompatibility.suggestion) {
              message += ` ${incompatibility.suggestion}`;
            }
            errors.push(message);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `SQL Generator: Incompatible types detected for dialect "${dialect}":\n\n` +
      errors.map((e, i) => `${i + 1}. ${e}`).join('\n\n') +
      '\n\nTo fix: Either change the type/index or use a compatible dialect.'
    );
  }
}
import {
  formatCreateTable,
  formatDropTable,
  formatIndexes,
  formatColumnComments,
} from '../dialects/formatter.js';
import {
  schemaToTable,
  generatePivotTable,
  generateMorphPivotTable,
  toTableName,
} from './schema-builder.js';

/**
 * Resolves options with defaults.
 */
function resolveOptions(options?: SqlGeneratorOptions): ResolvedSqlOptions {
  return {
    dialect: options?.dialect ?? 'mysql',
    ifNotExists: options?.ifNotExists ?? true,
    generateDown: options?.generateDown ?? true,
    startVersion: options?.startVersion ?? 1,
    versionPadding: options?.versionPadding ?? 4,
  };
}

/**
 * Formats version number with padding.
 */
function formatVersion(version: number, padding: number): string {
  return String(version).padStart(padding, '0');
}

/**
 * Generates file name for a migration.
 */
function generateFileName(version: number, name: string, padding: number): string {
  const versionStr = formatVersion(version, padding);
  return `${versionStr}_${name}.sql`;
}

/**
 * Generates SQL content for a CREATE TABLE migration.
 */
function generateCreateTableSql(
  table: SqlTable,
  options: ResolvedSqlOptions
): string {
  const lines: string[] = [];
  const dialect = options.dialect;

  // Header comment
  lines.push(`-- Migration: Create ${table.name} table`);
  lines.push(`-- Generated by @famgia/omnify-sql`);
  lines.push('');

  // CREATE TABLE
  lines.push(formatCreateTable(table, dialect, { ifNotExists: options.ifNotExists }));
  lines.push('');

  // Indexes (separate statements)
  const indexStatements = formatIndexes(table, dialect);
  if (indexStatements.length > 0) {
    lines.push('-- Indexes');
    lines.push(...indexStatements);
    lines.push('');
  }

  // Column comments (PostgreSQL)
  const commentStatements = formatColumnComments(table, dialect);
  if (commentStatements.length > 0) {
    lines.push('-- Column comments');
    lines.push(...commentStatements);
    lines.push('');
  }

  // Down migration
  if (options.generateDown) {
    lines.push('-- Down migration');
    lines.push(`-- ${formatDropTable(table.name, dialect, { ifExists: true, cascade: true })}`);
  }

  return lines.join('\n');
}

/**
 * Topologically sorts schemas based on foreign key dependencies.
 */
function topologicalSort(schemas: SchemaCollection): LoadedSchema[] {
  const sorted: LoadedSchema[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(schemaName: string) {
    if (visited.has(schemaName)) return;
    if (visiting.has(schemaName)) {
      // Circular dependency - just skip
      return;
    }

    visiting.add(schemaName);

    const schema = schemas[schemaName];
    if (!schema) return;

    // Visit dependencies first
    if (schema.properties) {
      for (const property of Object.values(schema.properties)) {
        if (property.type === 'Association') {
          const assocProp = property as { relation?: string; target?: string };
          if (['ManyToOne', 'OneToOne'].includes(assocProp.relation ?? '') && assocProp.target) {
            visit(assocProp.target);
          }
        }
      }
    }

    visiting.delete(schemaName);
    visited.add(schemaName);
    sorted.push(schema);
  }

  for (const schemaName of Object.keys(schemas)) {
    visit(schemaName);
  }

  return sorted;
}

/**
 * Generates all SQL migrations for a schema collection.
 */
export function generateMigrations(
  schemas: SchemaCollection,
  options?: SqlGeneratorOptions
): SqlMigration[] {
  const resolved = resolveOptions(options);

  // Validate type compatibility with target dialect
  validateSchemaCompatibility(schemas, resolved.dialect);

  const migrations: SqlMigration[] = [];
  let version = resolved.startVersion;

  // Filter object schemas (skip enums)
  const objectSchemas: Record<string, LoadedSchema> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    if (schema.kind !== 'enum') {
      objectSchemas[name] = schema;
    }
  }

  // Sort schemas by dependency order
  const sortedSchemas = topologicalSort(objectSchemas);

  // Track created pivot tables to avoid duplicates
  const createdPivots = new Set<string>();

  // Generate CREATE TABLE migrations for each schema
  for (const schema of sortedSchemas) {
    const table = schemaToTable(schema, schemas, resolved);

    migrations.push({
      version,
      name: `create_${table.name}`,
      fileName: generateFileName(version, `create_${table.name}`, resolved.versionPadding),
      content: generateCreateTableSql(table, resolved),
      tables: [table.name],
      type: 'create',
    });

    version++;
  }

  // Generate pivot tables for ManyToMany relations
  for (const schema of sortedSchemas) {
    if (!schema.properties) continue;

    for (const [propName, property] of Object.entries(schema.properties)) {
      // ManyToMany pivot tables
      const pivotTable = generatePivotTable(schema, propName, property, schemas, resolved);
      if (pivotTable && !createdPivots.has(pivotTable.name)) {
        createdPivots.add(pivotTable.name);

        migrations.push({
          version,
          name: `create_${pivotTable.name}`,
          fileName: generateFileName(version, `create_${pivotTable.name}`, resolved.versionPadding),
          content: generateCreateTableSql(pivotTable, resolved),
          tables: [pivotTable.name],
          type: 'pivot',
        });

        version++;
      }

      // MorphToMany pivot tables
      const morphPivot = generateMorphPivotTable(schema, propName, property, schemas, resolved);
      if (morphPivot && !createdPivots.has(morphPivot.name)) {
        createdPivots.add(morphPivot.name);

        migrations.push({
          version,
          name: `create_${morphPivot.name}`,
          fileName: generateFileName(version, `create_${morphPivot.name}`, resolved.versionPadding),
          content: generateCreateTableSql(morphPivot, resolved),
          tables: [morphPivot.name],
          type: 'pivot',
        });

        version++;
      }
    }
  }

  return migrations;
}

/**
 * Generates a single migration from a schema.
 */
export function generateMigrationFromSchema(
  schema: LoadedSchema,
  allSchemas: SchemaCollection,
  options?: SqlGeneratorOptions & { version?: number }
): SqlMigration {
  const resolved = resolveOptions(options);
  const version = options?.version ?? resolved.startVersion;

  const table = schemaToTable(schema, allSchemas, resolved);

  return {
    version,
    name: `create_${table.name}`,
    fileName: generateFileName(version, `create_${table.name}`, resolved.versionPadding),
    content: generateCreateTableSql(table, resolved),
    tables: [table.name],
    type: 'create',
  };
}

/**
 * Generates a DROP TABLE migration.
 */
export function generateDropMigration(
  tableName: string,
  options?: SqlGeneratorOptions & { version?: number }
): SqlMigration {
  const resolved = resolveOptions(options);
  const version = options?.version ?? resolved.startVersion;

  // If tableName looks like a table name (snake_case or already pluralized), use as-is
  // Otherwise treat as schema name and convert
  const isTableName = tableName.includes('_') || tableName.endsWith('s') || tableName.endsWith('es');
  const snakeTable = isTableName ? tableName : toTableName(tableName);
  const dropSql = formatDropTable(snakeTable, resolved.dialect, { ifExists: true, cascade: true });

  const lines: string[] = [
    `-- Migration: Drop ${snakeTable} table`,
    '-- Generated by @famgia/omnify-sql',
    '',
    dropSql,
  ];

  return {
    version,
    name: `drop_${snakeTable}`,
    fileName: generateFileName(version, `drop_${snakeTable}`, resolved.versionPadding),
    content: lines.join('\n'),
    tables: [snakeTable],
    type: 'drop',
  };
}

/**
 * Gets the file path for a migration.
 */
export function getMigrationPath(migration: SqlMigration, basePath: string = 'migrations'): string {
  return `${basePath}/${migration.fileName}`;
}
