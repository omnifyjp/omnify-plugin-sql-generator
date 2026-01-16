import { S as SqlGeneratorOptions, a as SqlMigration, R as ResolvedSqlOptions, b as SqlTable, c as SqlDialect, d as SqlColumn, e as SqlForeignKey, f as SqlIndex } from './types-DkJkHX8d.js';
export { g as SqlIndexType } from './types-DkJkHX8d.js';
import { SchemaCollection, LoadedSchema, PropertyDefinition } from '@famgia/omnify-types';

/**
 * @famgia/omnify-sql - Migration Generator
 *
 * Generates versioned SQL migration files.
 */

/**
 * Generates all SQL migrations for a schema collection.
 */
declare function generateMigrations(schemas: SchemaCollection, options?: SqlGeneratorOptions): SqlMigration[];
/**
 * Generates a single migration from a schema.
 */
declare function generateMigrationFromSchema(schema: LoadedSchema, allSchemas: SchemaCollection, options?: SqlGeneratorOptions & {
    version?: number;
}): SqlMigration;
/**
 * Generates a DROP TABLE migration.
 */
declare function generateDropMigration(tableName: string, options?: SqlGeneratorOptions & {
    version?: number;
}): SqlMigration;
/**
 * Gets the file path for a migration.
 */
declare function getMigrationPath(migration: SqlMigration, basePath?: string): string;

/**
 * @famgia/omnify-sql - Schema Builder
 *
 * Converts Omnify schemas to SQL table definitions.
 */

/**
 * Converts camelCase to snake_case.
 */
declare function toSnakeCase(str: string): string;
/**
 * Converts schema name to table name (snake_case + plural).
 */
declare function toTableName(schemaName: string): string;
/**
 * Converts property name to column name (snake_case).
 */
declare function toColumnName(propertyName: string): string;
/**
 * Converts a schema to a SQL table definition.
 */
declare function schemaToTable(schema: LoadedSchema, allSchemas: SchemaCollection, options: ResolvedSqlOptions): SqlTable;
/**
 * Generates pivot table for ManyToMany relation.
 */
declare function generatePivotTable(sourceSchema: LoadedSchema, _propertyName: string, property: PropertyDefinition, allSchemas: SchemaCollection, options: ResolvedSqlOptions): SqlTable | null;
/**
 * Generates polymorphic pivot table for MorphToMany relation.
 */
declare function generateMorphPivotTable(sourceSchema: LoadedSchema, _propertyName: string, property: PropertyDefinition, allSchemas: SchemaCollection, options: ResolvedSqlOptions): SqlTable | null;

/**
 * @famgia/omnify-sql - Dialect Type Mappings
 *
 * Maps Omnify types to SQL types for each dialect.
 */

/**
 * Gets the SQL type for an Omnify type in a specific dialect.
 */
declare function getSqlType(omnifyType: string, dialect: SqlDialect, options?: {
    length?: number | undefined;
    precision?: number | undefined;
    scale?: number | undefined;
}): string;
/**
 * Gets the primary key type for a specific dialect.
 */
declare function getPrimaryKeyType(idType: 'Int' | 'BigInt' | 'Uuid' | 'String', dialect: SqlDialect): {
    type: string;
    autoIncrement: boolean;
};
/**
 * Gets the foreign key column type.
 */
declare function getForeignKeyType(referencedIdType: 'Int' | 'BigInt' | 'Uuid' | 'String', dialect: SqlDialect): string;
/**
 * Gets ENUM type for a dialect.
 * Note: PostgreSQL requires CREATE TYPE, MySQL uses ENUM inline, SQLite uses CHECK.
 */
declare function getEnumType(values: readonly string[], dialect: SqlDialect, enumName?: string): {
    type: string;
    preStatement?: string;
};

/**
 * @famgia/omnify-sql - SQL Formatter
 *
 * Formats SQL statements for each dialect.
 */

/**
 * Quotes an identifier based on dialect.
 */
declare function quoteIdentifier(name: string, dialect: SqlDialect): string;
/**
 * Quotes a string value.
 */
declare function quoteString(value: string): string;
/**
 * Formats a column definition.
 */
declare function formatColumn(column: SqlColumn, dialect: SqlDialect): string;
/**
 * Formats a foreign key constraint.
 */
declare function formatForeignKey(fk: SqlForeignKey, dialect: SqlDialect): string;
/**
 * Formats an index definition.
 */
declare function formatIndex(index: SqlIndex, tableName: string, dialect: SqlDialect): string;
/**
 * Formats a complete CREATE TABLE statement.
 */
declare function formatCreateTable(table: SqlTable, dialect: SqlDialect, options?: {
    ifNotExists?: boolean;
}): string;
/**
 * Formats a DROP TABLE statement.
 */
declare function formatDropTable(tableName: string, dialect: SqlDialect, options?: {
    ifExists?: boolean;
    cascade?: boolean;
}): string;

export { ResolvedSqlOptions, SqlColumn, SqlDialect, SqlForeignKey, SqlGeneratorOptions, SqlIndex, SqlMigration, SqlTable, formatColumn, formatCreateTable, formatDropTable, formatForeignKey, formatIndex, generateDropMigration, generateMigrationFromSchema, generateMigrations, generateMorphPivotTable, generatePivotTable, getEnumType, getForeignKeyType, getMigrationPath, getPrimaryKeyType, getSqlType, quoteIdentifier, quoteString, schemaToTable, toColumnName, toSnakeCase, toTableName };
