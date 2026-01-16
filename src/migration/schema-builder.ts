/**
 * @famgia/omnify-sql - Schema Builder
 *
 * Converts Omnify schemas to SQL table definitions.
 */

import type { LoadedSchema, PropertyDefinition, SchemaCollection } from '@famgia/omnify-types';
import { resolveLocalizedString } from '@famgia/omnify-types';
import type {
  SqlDialect,
  SqlTable,
  SqlColumn,
  SqlForeignKey,
  SqlIndex,
  ResolvedSqlOptions,
} from '../types.js';
import { getSqlType, getPrimaryKeyType, getForeignKeyType, getEnumType } from '../dialects/types.js';

/**
 * Converts camelCase to snake_case.
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
}

/**
 * Converts schema name to table name (snake_case + plural).
 */
export function toTableName(schemaName: string): string {
  const snake = toSnakeCase(schemaName);

  // Simple pluralization rules
  if (snake.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].some(v => snake.endsWith(v))) {
    return snake.slice(0, -1) + 'ies';
  }
  if (snake.endsWith('s') || snake.endsWith('x') || snake.endsWith('ch') || snake.endsWith('sh')) {
    return snake + 'es';
  }
  return snake + 's';
}

/**
 * Converts property name to column name (snake_case).
 */
export function toColumnName(propertyName: string): string {
  return toSnakeCase(propertyName);
}

/**
 * Generates primary key column.
 */
export function generatePrimaryKey(
  idType: 'Int' | 'BigInt' | 'Uuid' | 'String',
  dialect: SqlDialect
): SqlColumn {
  const pkInfo = getPrimaryKeyType(idType, dialect);

  return {
    name: 'id',
    type: pkInfo.type,
    nullable: false,
    primaryKey: true,
    autoIncrement: pkInfo.autoIncrement,
    unique: false,
    unsigned: false,
  };
}

/**
 * Generates timestamp columns (created_at, updated_at).
 */
export function generateTimestampColumns(dialect: SqlDialect): SqlColumn[] {
  const timestampType = dialect === 'sqlite' ? 'TEXT' : 'TIMESTAMP';

  return [
    {
      name: 'created_at',
      type: timestampType,
      nullable: true,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false,
    },
    {
      name: 'updated_at',
      type: timestampType,
      nullable: true,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false,
    },
  ];
}

/**
 * Generates soft delete column.
 */
export function generateSoftDeleteColumn(dialect: SqlDialect): SqlColumn {
  const timestampType = dialect === 'sqlite' ? 'TEXT' : 'TIMESTAMP';

  return {
    name: 'deleted_at',
    type: timestampType,
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    unsigned: false,
  };
}

/**
 * Generates coordinate columns for Coordinates type.
 * Returns two columns: {name}_latitude and {name}_longitude
 */
export function generateCoordinatesColumns(
  name: string,
  property: PropertyDefinition,
  dialect: SqlDialect
): SqlColumn[] {
  const baseName = toColumnName(name);
  const nullable = (property as { nullable?: boolean }).nullable ?? false;

  // Latitude: -90 to +90 (needs 10,8 precision)
  // Longitude: -180 to +180 (needs 11,8 precision)
  const latType = dialect === 'sqlite' ? 'REAL' : 'DECIMAL(10, 8)';
  const lonType = dialect === 'sqlite' ? 'REAL' : 'DECIMAL(11, 8)';

  return [
    {
      name: `${baseName}_latitude`,
      type: latType,
      nullable,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false,
      comment: `Latitude for ${name}`,
    },
    {
      name: `${baseName}_longitude`,
      type: lonType,
      nullable,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false,
      comment: `Longitude for ${name}`,
    },
  ];
}

/**
 * Converts a property to a SQL column.
 * Returns null for association types and Coordinates (handled separately).
 */
export function propertyToColumn(
  name: string,
  property: PropertyDefinition,
  dialect: SqlDialect,
  _allSchemas: SchemaCollection
): SqlColumn | null {
  // Skip associations - they're handled separately
  if (property.type === 'Association') {
    return null;
  }

  // Skip Coordinates - handled separately (generates 2 columns)
  if (property.type === 'Coordinates') {
    return null;
  }

  const columnName = toColumnName(name);
  const baseProp = property as {
    nullable?: boolean;
    unique?: boolean;
    default?: unknown;
    displayName?: string;
    length?: number;
    precision?: number;
    scale?: number;
    enum?: string | readonly string[];
    options?: readonly string[];
  };

  // Handle Enum type
  if (property.type === 'Enum') {
    if (Array.isArray(baseProp.enum)) {
      const enumInfo = getEnumType(baseProp.enum, dialect, `${columnName}_enum`);
      return {
        name: columnName,
        type: enumInfo.type,
        nullable: baseProp.nullable ?? false,
        primaryKey: false,
        autoIncrement: false,
        unique: baseProp.unique ?? false,
        unsigned: false,
        defaultValue: baseProp.default !== undefined ? `'${baseProp.default}'` : undefined,
        comment: baseProp.displayName,
      };
    }
  }

  // Handle Select type
  if (property.type === 'Select' && baseProp.options) {
    const enumInfo = getEnumType(baseProp.options, dialect, `${columnName}_enum`);
    return {
      name: columnName,
      type: enumInfo.type,
      nullable: baseProp.nullable ?? false,
      primaryKey: false,
      autoIncrement: false,
      unique: baseProp.unique ?? false,
      unsigned: false,
      defaultValue: baseProp.default !== undefined ? `'${baseProp.default}'` : undefined,
      comment: baseProp.displayName,
    };
  }

  // Standard type mapping
  const sqlType = getSqlType(property.type, dialect, {
    length: baseProp.length,
    precision: baseProp.precision,
    scale: baseProp.scale,
  });

  // Format default value
  let defaultValue: string | undefined;
  if (baseProp.default !== undefined) {
    if (typeof baseProp.default === 'string') {
      defaultValue = `'${baseProp.default}'`;
    } else if (typeof baseProp.default === 'boolean') {
      defaultValue = dialect === 'postgresql' ? (baseProp.default ? 'TRUE' : 'FALSE') : (baseProp.default ? '1' : '0');
    } else {
      defaultValue = String(baseProp.default);
    }
  }

  return {
    name: columnName,
    type: sqlType,
    nullable: baseProp.nullable ?? false,
    primaryKey: false,
    autoIncrement: false,
    unique: baseProp.unique ?? false,
    unsigned: false,
    defaultValue,
    comment: baseProp.displayName,
  };
}

/**
 * Generates foreign key column and constraint for an association.
 */
export function generateForeignKey(
  name: string,
  property: PropertyDefinition,
  schema: LoadedSchema,
  dialect: SqlDialect,
  allSchemas: SchemaCollection
): { column: SqlColumn; foreignKey: SqlForeignKey } | null {
  if (property.type !== 'Association') {
    return null;
  }

  const assocProp = property as {
    relation?: string;
    target?: string;
    targets?: readonly string[];
    onDelete?: string;
    onUpdate?: string;
  };

  // Only handle owning side relations
  if (!['ManyToOne', 'OneToOne'].includes(assocProp.relation ?? '')) {
    return null;
  }

  const targetName = assocProp.target;
  if (!targetName) {
    return null;
  }

  const targetSchema = allSchemas[targetName];
  const targetIdType = (targetSchema?.options?.idType ?? 'BigInt') as 'Int' | 'BigInt' | 'Uuid' | 'String';

  const columnName = `${toColumnName(name)}_id`;
  const fkType = getForeignKeyType(targetIdType, dialect);
  const constraintName = `fk_${toTableName(schema.name)}_${columnName}`;

  const column: SqlColumn = {
    name: columnName,
    type: fkType,
    nullable: (property as { nullable?: boolean }).nullable ?? false,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    unsigned: dialect === 'mysql' && ['Int', 'BigInt'].includes(targetIdType),
  };

  const foreignKey: SqlForeignKey = {
    name: constraintName,
    columns: [columnName],
    referencesTable: toTableName(targetName),
    referencesColumns: ['id'],
    onDelete: assocProp.onDelete ?? 'CASCADE',
    onUpdate: assocProp.onUpdate ?? 'CASCADE',
  };

  return { column, foreignKey };
}

/**
 * Generates polymorphic columns for MorphTo relation.
 */
export function generatePolymorphicColumns(
  name: string,
  property: PropertyDefinition,
  dialect: SqlDialect,
  allSchemas: SchemaCollection
): { columns: SqlColumn[]; index: SqlIndex } | null {
  if (property.type !== 'Association') {
    return null;
  }

  const assocProp = property as {
    relation?: string;
    targets?: readonly string[];
  };

  if (assocProp.relation !== 'MorphTo' || !assocProp.targets?.length) {
    return null;
  }

  const baseName = toColumnName(name);

  // Determine ID type (use UUID if any target uses UUID)
  let useUuid = false;
  for (const targetName of assocProp.targets) {
    const targetSchema = allSchemas[targetName];
    if (targetSchema?.options?.idType === 'Uuid') {
      useUuid = true;
      break;
    }
  }

  // Type column (ENUM)
  const enumInfo = getEnumType(assocProp.targets, dialect, `${baseName}_type_enum`);
  const typeColumn: SqlColumn = {
    name: `${baseName}_type`,
    type: enumInfo.type,
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    unsigned: false,
  };

  // ID column
  const idType = useUuid
    ? (dialect === 'mysql' ? 'CHAR(36)' : dialect === 'postgresql' ? 'UUID' : 'TEXT')
    : (dialect === 'mysql' ? 'BIGINT UNSIGNED' : dialect === 'postgresql' ? 'BIGINT' : 'INTEGER');

  const idColumn: SqlColumn = {
    name: `${baseName}_id`,
    type: idType,
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    unsigned: dialect === 'mysql' && !useUuid,
  };

  // Composite index
  const index: SqlIndex = {
    name: `idx_${baseName}_type_id`,
    columns: [`${baseName}_type`, `${baseName}_id`],
    unique: false,
  };

  return {
    columns: [typeColumn, idColumn],
    index,
  };
}

/**
 * Converts a schema to a SQL table definition.
 */
export function schemaToTable(
  schema: LoadedSchema,
  allSchemas: SchemaCollection,
  options: ResolvedSqlOptions
): SqlTable {
  const columns: SqlColumn[] = [];
  const foreignKeys: SqlForeignKey[] = [];
  const indexes: SqlIndex[] = [];
  const dialect = options.dialect;

  // Primary key
  if (schema.options?.id !== false) {
    const idType = (schema.options?.idType ?? 'BigInt') as 'Int' | 'BigInt' | 'Uuid' | 'String';
    columns.push(generatePrimaryKey(idType, dialect));
  }

  // Process properties
  if (schema.properties) {
    for (const [propName, property] of Object.entries(schema.properties)) {
      // Regular column
      const column = propertyToColumn(propName, property, dialect, allSchemas);
      if (column) {
        columns.push(column);

        // Add index for unique columns (if not already unique constraint)
        if (column.unique) {
          indexes.push({
            name: `idx_${toTableName(schema.name)}_${column.name}_unique`,
            columns: [column.name],
            unique: true,
          });
        }
        continue;
      }

      // Foreign key (ManyToOne, OneToOne)
      const fkResult = generateForeignKey(propName, property, schema, dialect, allSchemas);
      if (fkResult) {
        columns.push(fkResult.column);
        foreignKeys.push(fkResult.foreignKey);

        // Add index for FK column
        indexes.push({
          name: `idx_${toTableName(schema.name)}_${fkResult.column.name}`,
          columns: [fkResult.column.name],
          unique: false,
        });
        continue;
      }

      // Polymorphic columns (MorphTo)
      const morphResult = generatePolymorphicColumns(propName, property, dialect, allSchemas);
      if (morphResult) {
        columns.push(...morphResult.columns);
        indexes.push(morphResult.index);
        continue;
      }

      // Coordinates type (generates latitude/longitude columns)
      if (property.type === 'Coordinates') {
        const coordColumns = generateCoordinatesColumns(propName, property, dialect);
        columns.push(...coordColumns);
      }
    }
  }

  // Timestamps
  if (schema.options?.timestamps !== false) {
    columns.push(...generateTimestampColumns(dialect));
  }

  // Soft delete
  if (schema.options?.softDelete) {
    columns.push(generateSoftDeleteColumn(dialect));
  }

  // Custom indexes from schema options
  if (schema.options?.indexes) {
    for (const indexDef of schema.options.indexes) {
      const indexName = indexDef.name ?? `idx_${toTableName(schema.name)}_${indexDef.columns.map(c => toColumnName(c)).join('_')}`;
      indexes.push({
        name: indexName,
        columns: indexDef.columns.map(c => toColumnName(c)),
        unique: indexDef.unique ?? false,
        type: indexDef.type,
      });
    }
  }

  // Unique constraints from schema options
  if (schema.options?.unique) {
    // Normalize to array of arrays: ['col'] or [['col1', 'col2']]
    const uniqueConstraints = Array.isArray(schema.options.unique[0])
      ? (schema.options.unique as readonly (readonly string[])[])
      : [schema.options.unique as readonly string[]];

    for (const constraint of uniqueConstraints) {
      const constraintColumns = constraint.map(c => toColumnName(c));
      indexes.push({
        name: `idx_${toTableName(schema.name)}_${constraintColumns.join('_')}_unique`,
        columns: constraintColumns,
        unique: true,
      });
    }
  }

  return {
    name: toTableName(schema.name),
    columns,
    foreignKeys,
    indexes,
    comment: resolveLocalizedString(schema.displayName),
  };
}

/**
 * Generates pivot table for ManyToMany relation.
 */
export function generatePivotTable(
  sourceSchema: LoadedSchema,
  _propertyName: string,
  property: PropertyDefinition,
  allSchemas: SchemaCollection,
  options: ResolvedSqlOptions
): SqlTable | null {
  if (property.type !== 'Association') {
    return null;
  }

  const assocProp = property as {
    relation?: string;
    target?: string;
    joinTable?: string;
    onDelete?: string;
  };

  if (assocProp.relation !== 'ManyToMany' || !assocProp.target) {
    return null;
  }

  const targetSchema = allSchemas[assocProp.target];
  if (!targetSchema) {
    return null;
  }

  const dialect = options.dialect;
  const sourceTable = toTableName(sourceSchema.name);
  const targetTable = toTableName(assocProp.target);

  // Pivot table name: alphabetically sorted
  const tables = [sourceTable, targetTable].sort();
  const pivotName = assocProp.joinTable ?? `${tables[0]}_${tables[1]}`;

  const sourceIdType = (sourceSchema.options?.idType ?? 'BigInt') as 'Int' | 'BigInt' | 'Uuid' | 'String';
  const targetIdType = (targetSchema.options?.idType ?? 'BigInt') as 'Int' | 'BigInt' | 'Uuid' | 'String';

  const sourceColName = `${toSnakeCase(sourceSchema.name)}_id`;
  const targetColName = `${toSnakeCase(assocProp.target)}_id`;

  const columns: SqlColumn[] = [
    {
      name: sourceColName,
      type: getForeignKeyType(sourceIdType, dialect),
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: dialect === 'mysql' && ['Int', 'BigInt'].includes(sourceIdType),
    },
    {
      name: targetColName,
      type: getForeignKeyType(targetIdType, dialect),
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: dialect === 'mysql' && ['Int', 'BigInt'].includes(targetIdType),
    },
  ];

  const foreignKeys: SqlForeignKey[] = [
    {
      name: `fk_${pivotName}_${sourceColName}`,
      columns: [sourceColName],
      referencesTable: sourceTable,
      referencesColumns: ['id'],
      onDelete: assocProp.onDelete ?? 'CASCADE',
      onUpdate: 'CASCADE',
    },
    {
      name: `fk_${pivotName}_${targetColName}`,
      columns: [targetColName],
      referencesTable: targetTable,
      referencesColumns: ['id'],
      onDelete: assocProp.onDelete ?? 'CASCADE',
      onUpdate: 'CASCADE',
    },
  ];

  const indexes: SqlIndex[] = [
    {
      name: `idx_${pivotName}_unique`,
      columns: [sourceColName, targetColName],
      unique: true,
    },
    {
      name: `idx_${pivotName}_${sourceColName}`,
      columns: [sourceColName],
      unique: false,
    },
    {
      name: `idx_${pivotName}_${targetColName}`,
      columns: [targetColName],
      unique: false,
    },
  ];

  return {
    name: pivotName,
    columns,
    foreignKeys,
    indexes,
  };
}

/**
 * Generates polymorphic pivot table for MorphToMany relation.
 */
export function generateMorphPivotTable(
  sourceSchema: LoadedSchema,
  _propertyName: string,
  property: PropertyDefinition,
  allSchemas: SchemaCollection,
  options: ResolvedSqlOptions
): SqlTable | null {
  if (property.type !== 'Association') {
    return null;
  }

  const assocProp = property as {
    relation?: string;
    target?: string;
    joinTable?: string;
    onDelete?: string;
  };

  if (assocProp.relation !== 'MorphToMany' || !assocProp.target) {
    return null;
  }

  const targetSchema = allSchemas[assocProp.target];
  if (!targetSchema) {
    return null;
  }

  const dialect = options.dialect;

  // Pivot table name: taggables, imageables, etc.
  const morphName = toSnakeCase(assocProp.target).replace(/s$/, '') + 'ables';
  const pivotName = assocProp.joinTable ?? morphName;

  const targetIdType = (targetSchema.options?.idType ?? 'BigInt') as 'Int' | 'BigInt' | 'Uuid' | 'String';
  const targetColName = `${toSnakeCase(assocProp.target)}_id`;
  const morphTypeName = `${morphName.replace(/s$/, '')}_type`;
  const morphIdName = `${morphName.replace(/s$/, '')}_id`;

  // Find all schemas that have MorphToMany to this target
  const morphTargets: string[] = [sourceSchema.name];
  for (const [schemaName, schema] of Object.entries(allSchemas)) {
    if (schemaName === sourceSchema.name) continue;
    if (!schema.properties) continue;

    for (const prop of Object.values(schema.properties)) {
      const p = prop as { type?: string; relation?: string; target?: string };
      if (p.type === 'Association' && p.relation === 'MorphToMany' && p.target === assocProp.target) {
        if (!morphTargets.includes(schemaName)) {
          morphTargets.push(schemaName);
        }
      }
    }
  }

  // Determine morphable ID type
  let useUuid = false;
  for (const targetName of morphTargets) {
    const schema = allSchemas[targetName];
    if (schema?.options?.idType === 'Uuid') {
      useUuid = true;
      break;
    }
  }

  const enumInfo = getEnumType(morphTargets, dialect, `${morphTypeName}_enum`);
  const morphIdType = useUuid
    ? (dialect === 'mysql' ? 'CHAR(36)' : dialect === 'postgresql' ? 'UUID' : 'TEXT')
    : (dialect === 'mysql' ? 'BIGINT UNSIGNED' : dialect === 'postgresql' ? 'BIGINT' : 'INTEGER');

  const columns: SqlColumn[] = [
    {
      name: targetColName,
      type: getForeignKeyType(targetIdType, dialect),
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: dialect === 'mysql' && ['Int', 'BigInt'].includes(targetIdType),
    },
    {
      name: morphTypeName,
      type: enumInfo.type,
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false,
    },
    {
      name: morphIdName,
      type: morphIdType,
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: dialect === 'mysql' && !useUuid,
    },
  ];

  const foreignKeys: SqlForeignKey[] = [
    {
      name: `fk_${pivotName}_${targetColName}`,
      columns: [targetColName],
      referencesTable: toTableName(assocProp.target),
      referencesColumns: ['id'],
      onDelete: assocProp.onDelete ?? 'CASCADE',
      onUpdate: 'CASCADE',
    },
  ];

  const indexes: SqlIndex[] = [
    {
      name: `idx_${pivotName}_unique`,
      columns: [targetColName, morphTypeName, morphIdName],
      unique: true,
    },
    {
      name: `idx_${pivotName}_${targetColName}`,
      columns: [targetColName],
      unique: false,
    },
    {
      name: `idx_${pivotName}_morphable`,
      columns: [morphTypeName, morphIdName],
      unique: false,
    },
  ];

  return {
    name: pivotName,
    columns,
    foreignKeys,
    indexes,
  };
}
