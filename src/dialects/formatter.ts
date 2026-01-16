/**
 * @famgia/omnify-sql - SQL Formatter
 *
 * Formats SQL statements for each dialect.
 */

import type { SqlDialect, SqlColumn, SqlForeignKey, SqlIndex, SqlTable } from '../types.js';

/**
 * Quotes an identifier based on dialect.
 */
export function quoteIdentifier(name: string, dialect: SqlDialect): string {
  switch (dialect) {
    case 'mysql':
      return `\`${name}\``;
    case 'postgresql':
      return `"${name}"`;
    case 'sqlite':
      return `"${name}"`;
  }
}

/**
 * Quotes a string value.
 */
export function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Formats a column definition.
 */
export function formatColumn(column: SqlColumn, dialect: SqlDialect): string {
  const parts: string[] = [quoteIdentifier(column.name, dialect), column.type];

  // Unsigned (MySQL only, and only if not already in type)
  if (dialect === 'mysql' && column.unsigned && !column.type.includes('UNSIGNED')) {
    parts.push('UNSIGNED');
  }

  // NOT NULL / NULL
  if (!column.nullable && !column.primaryKey) {
    parts.push('NOT NULL');
  } else if (column.nullable) {
    parts.push('NULL');
  }

  // Auto increment
  if (column.autoIncrement) {
    switch (dialect) {
      case 'mysql':
        parts.push('AUTO_INCREMENT');
        break;
      case 'sqlite':
        // SQLite uses AUTOINCREMENT only with INTEGER PRIMARY KEY
        break;
      case 'postgresql':
        // PostgreSQL uses SERIAL/BIGSERIAL types instead
        break;
    }
  }

  // Primary key (inline for single column)
  if (column.primaryKey) {
    parts.push('PRIMARY KEY');
    if (dialect === 'sqlite' && column.autoIncrement) {
      parts.push('AUTOINCREMENT');
    }
  }

  // Unique
  if (column.unique && !column.primaryKey) {
    parts.push('UNIQUE');
  }

  // Default value
  if (column.defaultValue !== undefined) {
    parts.push(`DEFAULT ${column.defaultValue}`);
  }

  // Comment (MySQL only inline)
  if (column.comment && dialect === 'mysql') {
    parts.push(`COMMENT ${quoteString(column.comment)}`);
  }

  return parts.join(' ');
}

/**
 * Formats a foreign key constraint.
 */
export function formatForeignKey(fk: SqlForeignKey, dialect: SqlDialect): string {
  const localCols = fk.columns.map(c => quoteIdentifier(c, dialect)).join(', ');
  const refCols = fk.referencesColumns.map(c => quoteIdentifier(c, dialect)).join(', ');
  const refTable = quoteIdentifier(fk.referencesTable, dialect);

  let sql = `CONSTRAINT ${quoteIdentifier(fk.name, dialect)} `;
  sql += `FOREIGN KEY (${localCols}) `;
  sql += `REFERENCES ${refTable} (${refCols})`;

  if (fk.onDelete && fk.onDelete !== 'NO ACTION') {
    sql += ` ON DELETE ${fk.onDelete}`;
  }

  if (fk.onUpdate && fk.onUpdate !== 'NO ACTION') {
    sql += ` ON UPDATE ${fk.onUpdate}`;
  }

  return sql;
}

/**
 * Formats an index definition.
 */
export function formatIndex(index: SqlIndex, tableName: string, dialect: SqlDialect): string {
  const cols = index.columns.map(c => quoteIdentifier(c, dialect)).join(', ');
  const table = quoteIdentifier(tableName, dialect);
  const name = quoteIdentifier(index.name, dialect);

  // Handle special index types
  if (index.type === 'fulltext') {
    switch (dialect) {
      case 'mysql':
        return `CREATE FULLTEXT INDEX ${name} ON ${table} (${cols});`;
      case 'postgresql':
        // PostgreSQL uses GIN index with to_tsvector
        const tsvectorCols = index.columns.map(c => `to_tsvector('english', ${quoteIdentifier(c, dialect)})`).join(' || ');
        return `CREATE INDEX ${name} ON ${table} USING GIN (${tsvectorCols});`;
      case 'sqlite':
        // SQLite FTS requires virtual table, just create regular index
        return `CREATE INDEX ${name} ON ${table} (${cols});`;
    }
  }

  if (index.type === 'spatial') {
    switch (dialect) {
      case 'mysql':
        return `CREATE SPATIAL INDEX ${name} ON ${table} (${cols});`;
      case 'postgresql':
        return `CREATE INDEX ${name} ON ${table} USING GIST (${cols});`;
      case 'sqlite':
        return `CREATE INDEX ${name} ON ${table} (${cols});`;
    }
  }

  if (index.type === 'gin' && dialect === 'postgresql') {
    return `CREATE INDEX ${name} ON ${table} USING GIN (${cols});`;
  }

  if (index.type === 'gist' && dialect === 'postgresql') {
    return `CREATE INDEX ${name} ON ${table} USING GIST (${cols});`;
  }

  if (index.type === 'hash') {
    switch (dialect) {
      case 'mysql':
        return `CREATE INDEX ${name} ON ${table} (${cols}) USING HASH;`;
      case 'postgresql':
        return `CREATE INDEX ${name} ON ${table} USING HASH (${cols});`;
      case 'sqlite':
        return `CREATE INDEX ${name} ON ${table} (${cols});`;
    }
  }

  // Default: btree or regular index
  const indexType = index.unique ? 'UNIQUE INDEX' : 'INDEX';
  return `CREATE ${indexType} ${name} ON ${table} (${cols});`;
}

/**
 * Formats a complete CREATE TABLE statement.
 */
export function formatCreateTable(
  table: SqlTable,
  dialect: SqlDialect,
  options?: { ifNotExists?: boolean }
): string {
  const tableName = quoteIdentifier(table.name, dialect);
  const ifNotExists = options?.ifNotExists ? 'IF NOT EXISTS ' : '';

  const lines: string[] = [];

  // Columns
  for (const column of table.columns) {
    lines.push(`  ${formatColumn(column, dialect)}`);
  }

  // Foreign keys (inline in CREATE TABLE)
  for (const fk of table.foreignKeys) {
    lines.push(`  ${formatForeignKey(fk, dialect)}`);
  }

  let sql = `CREATE TABLE ${ifNotExists}${tableName} (\n`;
  sql += lines.join(',\n');
  sql += '\n)';

  // MySQL engine and charset
  if (dialect === 'mysql') {
    sql += ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
  }

  sql += ';';

  // Add table comment for PostgreSQL (separate statement)
  if (table.comment && dialect === 'postgresql') {
    sql += `\n\nCOMMENT ON TABLE ${tableName} IS ${quoteString(table.comment)};`;
  }

  return sql;
}

/**
 * Formats a DROP TABLE statement.
 */
export function formatDropTable(
  tableName: string,
  dialect: SqlDialect,
  options?: { ifExists?: boolean; cascade?: boolean }
): string {
  const table = quoteIdentifier(tableName, dialect);
  const ifExists = options?.ifExists ? 'IF EXISTS ' : '';
  const cascade = options?.cascade && dialect === 'postgresql' ? ' CASCADE' : '';

  return `DROP TABLE ${ifExists}${table}${cascade};`;
}

/**
 * Formats indexes as separate statements (after CREATE TABLE).
 */
export function formatIndexes(table: SqlTable, dialect: SqlDialect): string[] {
  return table.indexes.map(index => formatIndex(index, table.name, dialect));
}

/**
 * Formats column comments for PostgreSQL (separate statements).
 */
export function formatColumnComments(table: SqlTable, dialect: SqlDialect): string[] {
  if (dialect !== 'postgresql') {
    return [];
  }

  const statements: string[] = [];
  const tableName = quoteIdentifier(table.name, dialect);

  for (const column of table.columns) {
    if (column.comment) {
      const colName = quoteIdentifier(column.name, dialect);
      statements.push(
        `COMMENT ON COLUMN ${tableName}.${colName} IS ${quoteString(column.comment)};`
      );
    }
  }

  return statements;
}
