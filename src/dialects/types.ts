/**
 * @famgia/omnify-sql - Dialect Type Mappings
 *
 * Maps Omnify types to SQL types for each dialect.
 */

import type { SqlDialect } from '../types.js';

/**
 * Type mapping for each dialect.
 */
export interface TypeMapping {
  /** SQL type string */
  readonly type: string;
  /** Whether type supports length parameter */
  readonly hasLength?: boolean;
  /** Default length if applicable */
  readonly defaultLength?: number;
  /** Whether type supports precision/scale */
  readonly hasPrecision?: boolean;
}

/**
 * MySQL type mappings.
 */
const MYSQL_TYPES: Record<string, TypeMapping> = {
  String: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  Int: { type: 'INT' },
  BigInt: { type: 'BIGINT' },
  Float: { type: 'DOUBLE' },
  Decimal: { type: 'DECIMAL', hasPrecision: true },
  Boolean: { type: 'TINYINT(1)' },
  Text: { type: 'TEXT' },
  LongText: { type: 'LONGTEXT' },
  Date: { type: 'DATE' },
  Time: { type: 'TIME' },
  Timestamp: { type: 'TIMESTAMP' },
  Json: { type: 'JSON' },
  Email: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  Password: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  File: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  MultiFile: { type: 'JSON' },
  Uuid: { type: 'CHAR(36)' },
  Select: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  Lookup: { type: 'BIGINT UNSIGNED' },
  // Spatial types
  Point: { type: 'POINT' },
  Coordinates: { type: 'DECIMAL(10, 8)' }, // For latitude column (longitude uses DECIMAL(11, 8))
};

/**
 * PostgreSQL type mappings.
 */
const POSTGRESQL_TYPES: Record<string, TypeMapping> = {
  String: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  Int: { type: 'INTEGER' },
  BigInt: { type: 'BIGINT' },
  Float: { type: 'DOUBLE PRECISION' },
  Decimal: { type: 'DECIMAL', hasPrecision: true },
  Boolean: { type: 'BOOLEAN' },
  Text: { type: 'TEXT' },
  LongText: { type: 'TEXT' },
  Date: { type: 'DATE' },
  Time: { type: 'TIME' },
  Timestamp: { type: 'TIMESTAMP' },
  Json: { type: 'JSONB' },
  Email: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  Password: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  File: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  MultiFile: { type: 'JSONB' },
  Uuid: { type: 'UUID' },
  Select: { type: 'VARCHAR', hasLength: true, defaultLength: 255 },
  Lookup: { type: 'BIGINT' },
  // Spatial types (requires PostGIS extension)
  Point: { type: 'geometry(Point, 4326)' },
  Coordinates: { type: 'DECIMAL(10, 8)' }, // For latitude column
};

/**
 * SQLite type mappings.
 */
const SQLITE_TYPES: Record<string, TypeMapping> = {
  String: { type: 'TEXT' },
  Int: { type: 'INTEGER' },
  BigInt: { type: 'INTEGER' },
  Float: { type: 'REAL' },
  Decimal: { type: 'REAL' },
  Boolean: { type: 'INTEGER' },
  Text: { type: 'TEXT' },
  LongText: { type: 'TEXT' },
  Date: { type: 'TEXT' },
  Time: { type: 'TEXT' },
  Timestamp: { type: 'TEXT' },
  Json: { type: 'TEXT' },
  Email: { type: 'TEXT' },
  Password: { type: 'TEXT' },
  File: { type: 'TEXT' },
  MultiFile: { type: 'TEXT' },
  Uuid: { type: 'TEXT' },
  Select: { type: 'TEXT' },
  Lookup: { type: 'INTEGER' },
  // Spatial types (no native support, use TEXT for JSON or REAL for lat/lon)
  Point: { type: 'TEXT' }, // JSON representation: {"lat": 0, "lon": 0}
  Coordinates: { type: 'REAL' }, // For latitude/longitude columns
};

/**
 * All dialect mappings.
 */
const DIALECT_TYPES: Record<SqlDialect, Record<string, TypeMapping>> = {
  mysql: MYSQL_TYPES,
  postgresql: POSTGRESQL_TYPES,
  sqlite: SQLITE_TYPES,
};

/**
 * Gets the SQL type for an Omnify type in a specific dialect.
 */
export function getSqlType(
  omnifyType: string,
  dialect: SqlDialect,
  options?: { length?: number | undefined; precision?: number | undefined; scale?: number | undefined }
): string {
  const mapping = DIALECT_TYPES[dialect][omnifyType];

  if (!mapping) {
    // Default fallback
    return dialect === 'sqlite' ? 'TEXT' : 'VARCHAR(255)';
  }

  let type = mapping.type;

  // Add length if applicable
  if (mapping.hasLength) {
    const length = options?.length ?? mapping.defaultLength ?? 255;
    type = `${type}(${length})`;
  }

  // Add precision/scale if applicable
  if (mapping.hasPrecision && options?.precision) {
    const scale = options.scale ?? 2;
    type = `${type}(${options.precision}, ${scale})`;
  }

  return type;
}

/**
 * Gets the primary key type for a specific dialect.
 */
export function getPrimaryKeyType(
  idType: 'Int' | 'BigInt' | 'Uuid' | 'String',
  dialect: SqlDialect
): { type: string; autoIncrement: boolean } {
  switch (dialect) {
    case 'mysql':
      switch (idType) {
        case 'Int':
          return { type: 'INT UNSIGNED', autoIncrement: true };
        case 'BigInt':
          return { type: 'BIGINT UNSIGNED', autoIncrement: true };
        case 'Uuid':
          return { type: 'CHAR(36)', autoIncrement: false };
        case 'String':
          return { type: 'VARCHAR(255)', autoIncrement: false };
      }
      break;

    case 'postgresql':
      switch (idType) {
        case 'Int':
          return { type: 'SERIAL', autoIncrement: false }; // SERIAL handles auto-increment
        case 'BigInt':
          return { type: 'BIGSERIAL', autoIncrement: false };
        case 'Uuid':
          return { type: 'UUID', autoIncrement: false };
        case 'String':
          return { type: 'VARCHAR(255)', autoIncrement: false };
      }
      break;

    case 'sqlite':
      switch (idType) {
        case 'Int':
        case 'BigInt':
          return { type: 'INTEGER', autoIncrement: true };
        case 'Uuid':
        case 'String':
          return { type: 'TEXT', autoIncrement: false };
      }
      break;
  }

  return { type: 'BIGINT', autoIncrement: true };
}

/**
 * Gets the foreign key column type.
 */
export function getForeignKeyType(
  referencedIdType: 'Int' | 'BigInt' | 'Uuid' | 'String',
  dialect: SqlDialect
): string {
  switch (dialect) {
    case 'mysql':
      switch (referencedIdType) {
        case 'Int':
          return 'INT UNSIGNED';
        case 'BigInt':
          return 'BIGINT UNSIGNED';
        case 'Uuid':
          return 'CHAR(36)';
        case 'String':
          return 'VARCHAR(255)';
      }
      break;

    case 'postgresql':
      switch (referencedIdType) {
        case 'Int':
          return 'INTEGER';
        case 'BigInt':
          return 'BIGINT';
        case 'Uuid':
          return 'UUID';
        case 'String':
          return 'VARCHAR(255)';
      }
      break;

    case 'sqlite':
      switch (referencedIdType) {
        case 'Int':
        case 'BigInt':
          return 'INTEGER';
        case 'Uuid':
        case 'String':
          return 'TEXT';
      }
      break;
  }

  return 'BIGINT';
}

/**
 * Gets ENUM type for a dialect.
 * Note: PostgreSQL requires CREATE TYPE, MySQL uses ENUM inline, SQLite uses CHECK.
 */
export function getEnumType(
  values: readonly string[],
  dialect: SqlDialect,
  enumName?: string
): { type: string; preStatement?: string } {
  switch (dialect) {
    case 'mysql':
      const enumValues = values.map(v => `'${v}'`).join(', ');
      return { type: `ENUM(${enumValues})` };

    case 'postgresql':
      // PostgreSQL needs CREATE TYPE first
      const typeName = enumName ?? 'enum_type';
      const pgValues = values.map(v => `'${v}'`).join(', ');
      return {
        type: typeName,
        preStatement: `CREATE TYPE ${typeName} AS ENUM (${pgValues});`,
      };

    case 'sqlite':
      // SQLite uses CHECK constraint, return TEXT and add constraint later
      return { type: 'TEXT' };
  }
}
