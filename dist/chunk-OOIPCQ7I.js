// src/dialects/formatter.ts
function quoteIdentifier(name, dialect) {
  switch (dialect) {
    case "mysql":
      return `\`${name}\``;
    case "postgresql":
      return `"${name}"`;
    case "sqlite":
      return `"${name}"`;
  }
}
function quoteString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}
function formatColumn(column, dialect) {
  const parts = [quoteIdentifier(column.name, dialect), column.type];
  if (dialect === "mysql" && column.unsigned && !column.type.includes("UNSIGNED")) {
    parts.push("UNSIGNED");
  }
  if (!column.nullable && !column.primaryKey) {
    parts.push("NOT NULL");
  } else if (column.nullable) {
    parts.push("NULL");
  }
  if (column.autoIncrement) {
    switch (dialect) {
      case "mysql":
        parts.push("AUTO_INCREMENT");
        break;
      case "sqlite":
        break;
      case "postgresql":
        break;
    }
  }
  if (column.primaryKey) {
    parts.push("PRIMARY KEY");
    if (dialect === "sqlite" && column.autoIncrement) {
      parts.push("AUTOINCREMENT");
    }
  }
  if (column.unique && !column.primaryKey) {
    parts.push("UNIQUE");
  }
  if (column.defaultValue !== void 0) {
    parts.push(`DEFAULT ${column.defaultValue}`);
  }
  if (column.comment && dialect === "mysql") {
    parts.push(`COMMENT ${quoteString(column.comment)}`);
  }
  return parts.join(" ");
}
function formatForeignKey(fk, dialect) {
  const localCols = fk.columns.map((c) => quoteIdentifier(c, dialect)).join(", ");
  const refCols = fk.referencesColumns.map((c) => quoteIdentifier(c, dialect)).join(", ");
  const refTable = quoteIdentifier(fk.referencesTable, dialect);
  let sql = `CONSTRAINT ${quoteIdentifier(fk.name, dialect)} `;
  sql += `FOREIGN KEY (${localCols}) `;
  sql += `REFERENCES ${refTable} (${refCols})`;
  if (fk.onDelete && fk.onDelete !== "NO ACTION") {
    sql += ` ON DELETE ${fk.onDelete}`;
  }
  if (fk.onUpdate && fk.onUpdate !== "NO ACTION") {
    sql += ` ON UPDATE ${fk.onUpdate}`;
  }
  return sql;
}
function formatIndex(index, tableName, dialect) {
  const cols = index.columns.map((c) => quoteIdentifier(c, dialect)).join(", ");
  const table = quoteIdentifier(tableName, dialect);
  const name = quoteIdentifier(index.name, dialect);
  if (index.type === "fulltext") {
    switch (dialect) {
      case "mysql":
        return `CREATE FULLTEXT INDEX ${name} ON ${table} (${cols});`;
      case "postgresql":
        const tsvectorCols = index.columns.map((c) => `to_tsvector('english', ${quoteIdentifier(c, dialect)})`).join(" || ");
        return `CREATE INDEX ${name} ON ${table} USING GIN (${tsvectorCols});`;
      case "sqlite":
        return `CREATE INDEX ${name} ON ${table} (${cols});`;
    }
  }
  if (index.type === "spatial") {
    switch (dialect) {
      case "mysql":
        return `CREATE SPATIAL INDEX ${name} ON ${table} (${cols});`;
      case "postgresql":
        return `CREATE INDEX ${name} ON ${table} USING GIST (${cols});`;
      case "sqlite":
        return `CREATE INDEX ${name} ON ${table} (${cols});`;
    }
  }
  if (index.type === "gin" && dialect === "postgresql") {
    return `CREATE INDEX ${name} ON ${table} USING GIN (${cols});`;
  }
  if (index.type === "gist" && dialect === "postgresql") {
    return `CREATE INDEX ${name} ON ${table} USING GIST (${cols});`;
  }
  if (index.type === "hash") {
    switch (dialect) {
      case "mysql":
        return `CREATE INDEX ${name} ON ${table} (${cols}) USING HASH;`;
      case "postgresql":
        return `CREATE INDEX ${name} ON ${table} USING HASH (${cols});`;
      case "sqlite":
        return `CREATE INDEX ${name} ON ${table} (${cols});`;
    }
  }
  const indexType = index.unique ? "UNIQUE INDEX" : "INDEX";
  return `CREATE ${indexType} ${name} ON ${table} (${cols});`;
}
function formatCreateTable(table, dialect, options) {
  const tableName = quoteIdentifier(table.name, dialect);
  const ifNotExists = options?.ifNotExists ? "IF NOT EXISTS " : "";
  const lines = [];
  for (const column of table.columns) {
    lines.push(`  ${formatColumn(column, dialect)}`);
  }
  for (const fk of table.foreignKeys) {
    lines.push(`  ${formatForeignKey(fk, dialect)}`);
  }
  let sql = `CREATE TABLE ${ifNotExists}${tableName} (
`;
  sql += lines.join(",\n");
  sql += "\n)";
  if (dialect === "mysql") {
    sql += " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
  }
  sql += ";";
  if (table.comment && dialect === "postgresql") {
    sql += `

COMMENT ON TABLE ${tableName} IS ${quoteString(table.comment)};`;
  }
  return sql;
}
function formatDropTable(tableName, dialect, options) {
  const table = quoteIdentifier(tableName, dialect);
  const ifExists = options?.ifExists ? "IF EXISTS " : "";
  const cascade = options?.cascade && dialect === "postgresql" ? " CASCADE" : "";
  return `DROP TABLE ${ifExists}${table}${cascade};`;
}
function formatIndexes(table, dialect) {
  return table.indexes.map((index) => formatIndex(index, table.name, dialect));
}
function formatColumnComments(table, dialect) {
  if (dialect !== "postgresql") {
    return [];
  }
  const statements = [];
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

// src/dialects/types.ts
var MYSQL_TYPES = {
  String: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  Int: { type: "INT" },
  BigInt: { type: "BIGINT" },
  Float: { type: "DOUBLE" },
  Decimal: { type: "DECIMAL", hasPrecision: true },
  Boolean: { type: "TINYINT(1)" },
  Text: { type: "TEXT" },
  LongText: { type: "LONGTEXT" },
  Date: { type: "DATE" },
  Time: { type: "TIME" },
  Timestamp: { type: "TIMESTAMP" },
  Json: { type: "JSON" },
  Email: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  Password: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  File: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  MultiFile: { type: "JSON" },
  Uuid: { type: "CHAR(36)" },
  Select: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  Lookup: { type: "BIGINT UNSIGNED" },
  // Spatial types
  Point: { type: "POINT" },
  Coordinates: { type: "DECIMAL(10, 8)" }
  // For latitude column (longitude uses DECIMAL(11, 8))
};
var POSTGRESQL_TYPES = {
  String: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  Int: { type: "INTEGER" },
  BigInt: { type: "BIGINT" },
  Float: { type: "DOUBLE PRECISION" },
  Decimal: { type: "DECIMAL", hasPrecision: true },
  Boolean: { type: "BOOLEAN" },
  Text: { type: "TEXT" },
  LongText: { type: "TEXT" },
  Date: { type: "DATE" },
  Time: { type: "TIME" },
  Timestamp: { type: "TIMESTAMP" },
  Json: { type: "JSONB" },
  Email: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  Password: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  File: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  MultiFile: { type: "JSONB" },
  Uuid: { type: "UUID" },
  Select: { type: "VARCHAR", hasLength: true, defaultLength: 255 },
  Lookup: { type: "BIGINT" },
  // Spatial types (requires PostGIS extension)
  Point: { type: "geometry(Point, 4326)" },
  Coordinates: { type: "DECIMAL(10, 8)" }
  // For latitude column
};
var SQLITE_TYPES = {
  String: { type: "TEXT" },
  Int: { type: "INTEGER" },
  BigInt: { type: "INTEGER" },
  Float: { type: "REAL" },
  Decimal: { type: "REAL" },
  Boolean: { type: "INTEGER" },
  Text: { type: "TEXT" },
  LongText: { type: "TEXT" },
  Date: { type: "TEXT" },
  Time: { type: "TEXT" },
  Timestamp: { type: "TEXT" },
  Json: { type: "TEXT" },
  Email: { type: "TEXT" },
  Password: { type: "TEXT" },
  File: { type: "TEXT" },
  MultiFile: { type: "TEXT" },
  Uuid: { type: "TEXT" },
  Select: { type: "TEXT" },
  Lookup: { type: "INTEGER" },
  // Spatial types (no native support, use TEXT for JSON or REAL for lat/lon)
  Point: { type: "TEXT" },
  // JSON representation: {"lat": 0, "lon": 0}
  Coordinates: { type: "REAL" }
  // For latitude/longitude columns
};
var DIALECT_TYPES = {
  mysql: MYSQL_TYPES,
  postgresql: POSTGRESQL_TYPES,
  sqlite: SQLITE_TYPES
};
function getSqlType(omnifyType, dialect, options) {
  const mapping = DIALECT_TYPES[dialect][omnifyType];
  if (!mapping) {
    return dialect === "sqlite" ? "TEXT" : "VARCHAR(255)";
  }
  let type = mapping.type;
  if (mapping.hasLength) {
    const length = options?.length ?? mapping.defaultLength ?? 255;
    type = `${type}(${length})`;
  }
  if (mapping.hasPrecision && options?.precision) {
    const scale = options.scale ?? 2;
    type = `${type}(${options.precision}, ${scale})`;
  }
  return type;
}
function getPrimaryKeyType(idType, dialect) {
  switch (dialect) {
    case "mysql":
      switch (idType) {
        case "Int":
          return { type: "INT UNSIGNED", autoIncrement: true };
        case "BigInt":
          return { type: "BIGINT UNSIGNED", autoIncrement: true };
        case "Uuid":
          return { type: "CHAR(36)", autoIncrement: false };
        case "String":
          return { type: "VARCHAR(255)", autoIncrement: false };
      }
      break;
    case "postgresql":
      switch (idType) {
        case "Int":
          return { type: "SERIAL", autoIncrement: false };
        // SERIAL handles auto-increment
        case "BigInt":
          return { type: "BIGSERIAL", autoIncrement: false };
        case "Uuid":
          return { type: "UUID", autoIncrement: false };
        case "String":
          return { type: "VARCHAR(255)", autoIncrement: false };
      }
      break;
    case "sqlite":
      switch (idType) {
        case "Int":
        case "BigInt":
          return { type: "INTEGER", autoIncrement: true };
        case "Uuid":
        case "String":
          return { type: "TEXT", autoIncrement: false };
      }
      break;
  }
  return { type: "BIGINT", autoIncrement: true };
}
function getForeignKeyType(referencedIdType, dialect) {
  switch (dialect) {
    case "mysql":
      switch (referencedIdType) {
        case "Int":
          return "INT UNSIGNED";
        case "BigInt":
          return "BIGINT UNSIGNED";
        case "Uuid":
          return "CHAR(36)";
        case "String":
          return "VARCHAR(255)";
      }
      break;
    case "postgresql":
      switch (referencedIdType) {
        case "Int":
          return "INTEGER";
        case "BigInt":
          return "BIGINT";
        case "Uuid":
          return "UUID";
        case "String":
          return "VARCHAR(255)";
      }
      break;
    case "sqlite":
      switch (referencedIdType) {
        case "Int":
        case "BigInt":
          return "INTEGER";
        case "Uuid":
        case "String":
          return "TEXT";
      }
      break;
  }
  return "BIGINT";
}
function getEnumType(values, dialect, enumName) {
  switch (dialect) {
    case "mysql":
      const enumValues = values.map((v) => `'${v}'`).join(", ");
      return { type: `ENUM(${enumValues})` };
    case "postgresql":
      const typeName = enumName ?? "enum_type";
      const pgValues = values.map((v) => `'${v}'`).join(", ");
      return {
        type: typeName,
        preStatement: `CREATE TYPE ${typeName} AS ENUM (${pgValues});`
      };
    case "sqlite":
      return { type: "TEXT" };
  }
}

// src/migration/schema-builder.ts
import { resolveLocalizedString } from "@famgia/omnify-types";
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, "");
}
function toTableName(schemaName) {
  const snake = toSnakeCase(schemaName);
  if (snake.endsWith("y") && !["ay", "ey", "oy", "uy"].some((v) => snake.endsWith(v))) {
    return snake.slice(0, -1) + "ies";
  }
  if (snake.endsWith("s") || snake.endsWith("x") || snake.endsWith("ch") || snake.endsWith("sh")) {
    return snake + "es";
  }
  return snake + "s";
}
function toColumnName(propertyName) {
  return toSnakeCase(propertyName);
}
function generatePrimaryKey(idType, dialect) {
  const pkInfo = getPrimaryKeyType(idType, dialect);
  return {
    name: "id",
    type: pkInfo.type,
    nullable: false,
    primaryKey: true,
    autoIncrement: pkInfo.autoIncrement,
    unique: false,
    unsigned: false
  };
}
function generateTimestampColumns(dialect) {
  const timestampType = dialect === "sqlite" ? "TEXT" : "TIMESTAMP";
  return [
    {
      name: "created_at",
      type: timestampType,
      nullable: true,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false
    },
    {
      name: "updated_at",
      type: timestampType,
      nullable: true,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false
    }
  ];
}
function generateSoftDeleteColumn(dialect) {
  const timestampType = dialect === "sqlite" ? "TEXT" : "TIMESTAMP";
  return {
    name: "deleted_at",
    type: timestampType,
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    unsigned: false
  };
}
function generateCoordinatesColumns(name, property, dialect) {
  const baseName = toColumnName(name);
  const nullable = property.nullable ?? false;
  const latType = dialect === "sqlite" ? "REAL" : "DECIMAL(10, 8)";
  const lonType = dialect === "sqlite" ? "REAL" : "DECIMAL(11, 8)";
  return [
    {
      name: `${baseName}_latitude`,
      type: latType,
      nullable,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false,
      comment: `Latitude for ${name}`
    },
    {
      name: `${baseName}_longitude`,
      type: lonType,
      nullable,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false,
      comment: `Longitude for ${name}`
    }
  ];
}
function propertyToColumn(name, property, dialect, _allSchemas) {
  if (property.type === "Association") {
    return null;
  }
  if (property.type === "Coordinates") {
    return null;
  }
  const columnName = toColumnName(name);
  const baseProp = property;
  if (property.type === "Enum") {
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
        defaultValue: baseProp.default !== void 0 ? `'${baseProp.default}'` : void 0,
        comment: baseProp.displayName
      };
    }
  }
  if (property.type === "Select" && baseProp.options) {
    const enumInfo = getEnumType(baseProp.options, dialect, `${columnName}_enum`);
    return {
      name: columnName,
      type: enumInfo.type,
      nullable: baseProp.nullable ?? false,
      primaryKey: false,
      autoIncrement: false,
      unique: baseProp.unique ?? false,
      unsigned: false,
      defaultValue: baseProp.default !== void 0 ? `'${baseProp.default}'` : void 0,
      comment: baseProp.displayName
    };
  }
  const sqlType = getSqlType(property.type, dialect, {
    length: baseProp.length,
    precision: baseProp.precision,
    scale: baseProp.scale
  });
  let defaultValue;
  if (baseProp.default !== void 0) {
    if (typeof baseProp.default === "string") {
      defaultValue = `'${baseProp.default}'`;
    } else if (typeof baseProp.default === "boolean") {
      defaultValue = dialect === "postgresql" ? baseProp.default ? "TRUE" : "FALSE" : baseProp.default ? "1" : "0";
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
    comment: baseProp.displayName
  };
}
function generateForeignKey(name, property, schema, dialect, allSchemas) {
  if (property.type !== "Association") {
    return null;
  }
  const assocProp = property;
  if (!["ManyToOne", "OneToOne"].includes(assocProp.relation ?? "")) {
    return null;
  }
  const targetName = assocProp.target;
  if (!targetName) {
    return null;
  }
  const targetSchema = allSchemas[targetName];
  const targetIdType = targetSchema?.options?.idType ?? "BigInt";
  const columnName = `${toColumnName(name)}_id`;
  const fkType = getForeignKeyType(targetIdType, dialect);
  const constraintName = `fk_${toTableName(schema.name)}_${columnName}`;
  const column = {
    name: columnName,
    type: fkType,
    nullable: property.nullable ?? false,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    unsigned: dialect === "mysql" && ["Int", "BigInt"].includes(targetIdType)
  };
  const foreignKey = {
    name: constraintName,
    columns: [columnName],
    referencesTable: toTableName(targetName),
    referencesColumns: ["id"],
    onDelete: assocProp.onDelete ?? "CASCADE",
    onUpdate: assocProp.onUpdate ?? "CASCADE"
  };
  return { column, foreignKey };
}
function generatePolymorphicColumns(name, property, dialect, allSchemas) {
  if (property.type !== "Association") {
    return null;
  }
  const assocProp = property;
  if (assocProp.relation !== "MorphTo" || !assocProp.targets?.length) {
    return null;
  }
  const baseName = toColumnName(name);
  let useUuid = false;
  for (const targetName of assocProp.targets) {
    const targetSchema = allSchemas[targetName];
    if (targetSchema?.options?.idType === "Uuid") {
      useUuid = true;
      break;
    }
  }
  const enumInfo = getEnumType(assocProp.targets, dialect, `${baseName}_type_enum`);
  const typeColumn = {
    name: `${baseName}_type`,
    type: enumInfo.type,
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    unsigned: false
  };
  const idType = useUuid ? dialect === "mysql" ? "CHAR(36)" : dialect === "postgresql" ? "UUID" : "TEXT" : dialect === "mysql" ? "BIGINT UNSIGNED" : dialect === "postgresql" ? "BIGINT" : "INTEGER";
  const idColumn = {
    name: `${baseName}_id`,
    type: idType,
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    unsigned: dialect === "mysql" && !useUuid
  };
  const index = {
    name: `idx_${baseName}_type_id`,
    columns: [`${baseName}_type`, `${baseName}_id`],
    unique: false
  };
  return {
    columns: [typeColumn, idColumn],
    index
  };
}
function schemaToTable(schema, allSchemas, options) {
  const columns = [];
  const foreignKeys = [];
  const indexes = [];
  const dialect = options.dialect;
  if (schema.options?.id !== false) {
    const idType = schema.options?.idType ?? "BigInt";
    columns.push(generatePrimaryKey(idType, dialect));
  }
  if (schema.properties) {
    for (const [propName, property] of Object.entries(schema.properties)) {
      const column = propertyToColumn(propName, property, dialect, allSchemas);
      if (column) {
        columns.push(column);
        if (column.unique) {
          indexes.push({
            name: `idx_${toTableName(schema.name)}_${column.name}_unique`,
            columns: [column.name],
            unique: true
          });
        }
        continue;
      }
      const fkResult = generateForeignKey(propName, property, schema, dialect, allSchemas);
      if (fkResult) {
        columns.push(fkResult.column);
        foreignKeys.push(fkResult.foreignKey);
        indexes.push({
          name: `idx_${toTableName(schema.name)}_${fkResult.column.name}`,
          columns: [fkResult.column.name],
          unique: false
        });
        continue;
      }
      const morphResult = generatePolymorphicColumns(propName, property, dialect, allSchemas);
      if (morphResult) {
        columns.push(...morphResult.columns);
        indexes.push(morphResult.index);
        continue;
      }
      if (property.type === "Coordinates") {
        const coordColumns = generateCoordinatesColumns(propName, property, dialect);
        columns.push(...coordColumns);
      }
    }
  }
  if (schema.options?.timestamps !== false) {
    columns.push(...generateTimestampColumns(dialect));
  }
  if (schema.options?.softDelete) {
    columns.push(generateSoftDeleteColumn(dialect));
  }
  if (schema.options?.indexes) {
    for (const indexDef of schema.options.indexes) {
      const indexName = indexDef.name ?? `idx_${toTableName(schema.name)}_${indexDef.columns.map((c) => toColumnName(c)).join("_")}`;
      indexes.push({
        name: indexName,
        columns: indexDef.columns.map((c) => toColumnName(c)),
        unique: indexDef.unique ?? false,
        type: indexDef.type
      });
    }
  }
  if (schema.options?.unique) {
    const uniqueConstraints = Array.isArray(schema.options.unique[0]) ? schema.options.unique : [schema.options.unique];
    for (const constraint of uniqueConstraints) {
      const constraintColumns = constraint.map((c) => toColumnName(c));
      indexes.push({
        name: `idx_${toTableName(schema.name)}_${constraintColumns.join("_")}_unique`,
        columns: constraintColumns,
        unique: true
      });
    }
  }
  return {
    name: toTableName(schema.name),
    columns,
    foreignKeys,
    indexes,
    comment: resolveLocalizedString(schema.displayName)
  };
}
function generatePivotTable(sourceSchema, _propertyName, property, allSchemas, options) {
  if (property.type !== "Association") {
    return null;
  }
  const assocProp = property;
  if (assocProp.relation !== "ManyToMany" || !assocProp.target) {
    return null;
  }
  const targetSchema = allSchemas[assocProp.target];
  if (!targetSchema) {
    return null;
  }
  const dialect = options.dialect;
  const sourceTable = toTableName(sourceSchema.name);
  const targetTable = toTableName(assocProp.target);
  const tables = [sourceTable, targetTable].sort();
  const pivotName = assocProp.joinTable ?? `${tables[0]}_${tables[1]}`;
  const sourceIdType = sourceSchema.options?.idType ?? "BigInt";
  const targetIdType = targetSchema.options?.idType ?? "BigInt";
  const sourceColName = `${toSnakeCase(sourceSchema.name)}_id`;
  const targetColName = `${toSnakeCase(assocProp.target)}_id`;
  const columns = [
    {
      name: sourceColName,
      type: getForeignKeyType(sourceIdType, dialect),
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: dialect === "mysql" && ["Int", "BigInt"].includes(sourceIdType)
    },
    {
      name: targetColName,
      type: getForeignKeyType(targetIdType, dialect),
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: dialect === "mysql" && ["Int", "BigInt"].includes(targetIdType)
    }
  ];
  const foreignKeys = [
    {
      name: `fk_${pivotName}_${sourceColName}`,
      columns: [sourceColName],
      referencesTable: sourceTable,
      referencesColumns: ["id"],
      onDelete: assocProp.onDelete ?? "CASCADE",
      onUpdate: "CASCADE"
    },
    {
      name: `fk_${pivotName}_${targetColName}`,
      columns: [targetColName],
      referencesTable: targetTable,
      referencesColumns: ["id"],
      onDelete: assocProp.onDelete ?? "CASCADE",
      onUpdate: "CASCADE"
    }
  ];
  const indexes = [
    {
      name: `idx_${pivotName}_unique`,
      columns: [sourceColName, targetColName],
      unique: true
    },
    {
      name: `idx_${pivotName}_${sourceColName}`,
      columns: [sourceColName],
      unique: false
    },
    {
      name: `idx_${pivotName}_${targetColName}`,
      columns: [targetColName],
      unique: false
    }
  ];
  return {
    name: pivotName,
    columns,
    foreignKeys,
    indexes
  };
}
function generateMorphPivotTable(sourceSchema, _propertyName, property, allSchemas, options) {
  if (property.type !== "Association") {
    return null;
  }
  const assocProp = property;
  if (assocProp.relation !== "MorphToMany" || !assocProp.target) {
    return null;
  }
  const targetSchema = allSchemas[assocProp.target];
  if (!targetSchema) {
    return null;
  }
  const dialect = options.dialect;
  const morphName = toSnakeCase(assocProp.target).replace(/s$/, "") + "ables";
  const pivotName = assocProp.joinTable ?? morphName;
  const targetIdType = targetSchema.options?.idType ?? "BigInt";
  const targetColName = `${toSnakeCase(assocProp.target)}_id`;
  const morphTypeName = `${morphName.replace(/s$/, "")}_type`;
  const morphIdName = `${morphName.replace(/s$/, "")}_id`;
  const morphTargets = [sourceSchema.name];
  for (const [schemaName, schema] of Object.entries(allSchemas)) {
    if (schemaName === sourceSchema.name) continue;
    if (!schema.properties) continue;
    for (const prop of Object.values(schema.properties)) {
      const p = prop;
      if (p.type === "Association" && p.relation === "MorphToMany" && p.target === assocProp.target) {
        if (!morphTargets.includes(schemaName)) {
          morphTargets.push(schemaName);
        }
      }
    }
  }
  let useUuid = false;
  for (const targetName of morphTargets) {
    const schema = allSchemas[targetName];
    if (schema?.options?.idType === "Uuid") {
      useUuid = true;
      break;
    }
  }
  const enumInfo = getEnumType(morphTargets, dialect, `${morphTypeName}_enum`);
  const morphIdType = useUuid ? dialect === "mysql" ? "CHAR(36)" : dialect === "postgresql" ? "UUID" : "TEXT" : dialect === "mysql" ? "BIGINT UNSIGNED" : dialect === "postgresql" ? "BIGINT" : "INTEGER";
  const columns = [
    {
      name: targetColName,
      type: getForeignKeyType(targetIdType, dialect),
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: dialect === "mysql" && ["Int", "BigInt"].includes(targetIdType)
    },
    {
      name: morphTypeName,
      type: enumInfo.type,
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: false
    },
    {
      name: morphIdName,
      type: morphIdType,
      nullable: false,
      primaryKey: false,
      autoIncrement: false,
      unique: false,
      unsigned: dialect === "mysql" && !useUuid
    }
  ];
  const foreignKeys = [
    {
      name: `fk_${pivotName}_${targetColName}`,
      columns: [targetColName],
      referencesTable: toTableName(assocProp.target),
      referencesColumns: ["id"],
      onDelete: assocProp.onDelete ?? "CASCADE",
      onUpdate: "CASCADE"
    }
  ];
  const indexes = [
    {
      name: `idx_${pivotName}_unique`,
      columns: [targetColName, morphTypeName, morphIdName],
      unique: true
    },
    {
      name: `idx_${pivotName}_${targetColName}`,
      columns: [targetColName],
      unique: false
    },
    {
      name: `idx_${pivotName}_morphable`,
      columns: [morphTypeName, morphIdName],
      unique: false
    }
  ];
  return {
    name: pivotName,
    columns,
    foreignKeys,
    indexes
  };
}

// src/migration/generator.ts
var DIALECT_INCOMPATIBLE_TYPES = {
  Point: {
    dialects: ["sqlite"],
    reason: "SQLite does not support native spatial types. Point will be stored as TEXT (JSON), which is incompatible with MySQL/PostgreSQL spatial functions (ST_Distance, ST_Within, etc.). Use Coordinates type for cross-database compatibility."
  }
};
var DIALECT_INCOMPATIBLE_INDEX_TYPES = {
  gin: {
    dialects: ["mysql", "sqlite"],
    reason: "GIN (Generalized Inverted Index) is PostgreSQL-specific.",
    suggestion: 'For fulltext search, use type: "fulltext" instead. For JSONB indexing, this only works in PostgreSQL.'
  },
  gist: {
    dialects: ["mysql", "sqlite"],
    reason: "GiST (Generalized Search Tree) is PostgreSQL-specific.",
    suggestion: 'For spatial data, use type: "spatial" which works on both MySQL and PostgreSQL.'
  },
  fulltext: {
    dialects: ["sqlite"],
    reason: "SQLite does not support native fulltext indexes. FTS requires virtual tables which are not auto-generated.",
    suggestion: "Consider using a regular index or implementing SQLite FTS manually."
  },
  spatial: {
    dialects: ["sqlite"],
    reason: "SQLite does not support spatial indexes.",
    suggestion: "Use Coordinates type with regular indexes for cross-database compatibility."
  }
};
function validateSchemaCompatibility(schemas, dialect) {
  const errors = [];
  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (schema.kind === "enum") continue;
    if (schema.properties) {
      for (const [propName, property] of Object.entries(schema.properties)) {
        const propType = property.type;
        const incompatibility = DIALECT_INCOMPATIBLE_TYPES[propType];
        if (incompatibility && incompatibility.dialects.includes(dialect)) {
          errors.push(
            `Schema "${schemaName}", property "${propName}": Type "${propType}" is not supported in ${dialect}. ${incompatibility.reason}`
          );
        }
      }
    }
    if (schema.options?.indexes) {
      for (const indexDef of schema.options.indexes) {
        if (indexDef.type) {
          const incompatibility = DIALECT_INCOMPATIBLE_INDEX_TYPES[indexDef.type];
          if (incompatibility && incompatibility.dialects.includes(dialect)) {
            const indexName = indexDef.name ?? `index on [${indexDef.columns.join(", ")}]`;
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
      `SQL Generator: Incompatible types detected for dialect "${dialect}":

` + errors.map((e, i) => `${i + 1}. ${e}`).join("\n\n") + "\n\nTo fix: Either change the type/index or use a compatible dialect."
    );
  }
}
function resolveOptions(options) {
  return {
    dialect: options?.dialect ?? "mysql",
    ifNotExists: options?.ifNotExists ?? true,
    generateDown: options?.generateDown ?? true,
    startVersion: options?.startVersion ?? 1,
    versionPadding: options?.versionPadding ?? 4
  };
}
function formatVersion(version, padding) {
  return String(version).padStart(padding, "0");
}
function generateFileName(version, name, padding) {
  const versionStr = formatVersion(version, padding);
  return `${versionStr}_${name}.sql`;
}
function generateCreateTableSql(table, options) {
  const lines = [];
  const dialect = options.dialect;
  lines.push(`-- Migration: Create ${table.name} table`);
  lines.push(`-- Generated by @famgia/omnify-sql`);
  lines.push("");
  lines.push(formatCreateTable(table, dialect, { ifNotExists: options.ifNotExists }));
  lines.push("");
  const indexStatements = formatIndexes(table, dialect);
  if (indexStatements.length > 0) {
    lines.push("-- Indexes");
    lines.push(...indexStatements);
    lines.push("");
  }
  const commentStatements = formatColumnComments(table, dialect);
  if (commentStatements.length > 0) {
    lines.push("-- Column comments");
    lines.push(...commentStatements);
    lines.push("");
  }
  if (options.generateDown) {
    lines.push("-- Down migration");
    lines.push(`-- ${formatDropTable(table.name, dialect, { ifExists: true, cascade: true })}`);
  }
  return lines.join("\n");
}
function topologicalSort(schemas) {
  const sorted = [];
  const visited = /* @__PURE__ */ new Set();
  const visiting = /* @__PURE__ */ new Set();
  function visit(schemaName) {
    if (visited.has(schemaName)) return;
    if (visiting.has(schemaName)) {
      return;
    }
    visiting.add(schemaName);
    const schema = schemas[schemaName];
    if (!schema) return;
    if (schema.properties) {
      for (const property of Object.values(schema.properties)) {
        if (property.type === "Association") {
          const assocProp = property;
          if (["ManyToOne", "OneToOne"].includes(assocProp.relation ?? "") && assocProp.target) {
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
function generateMigrations(schemas, options) {
  const resolved = resolveOptions(options);
  validateSchemaCompatibility(schemas, resolved.dialect);
  const migrations = [];
  let version = resolved.startVersion;
  const objectSchemas = {};
  for (const [name, schema] of Object.entries(schemas)) {
    if (schema.kind !== "enum") {
      objectSchemas[name] = schema;
    }
  }
  const sortedSchemas = topologicalSort(objectSchemas);
  const createdPivots = /* @__PURE__ */ new Set();
  for (const schema of sortedSchemas) {
    const table = schemaToTable(schema, schemas, resolved);
    migrations.push({
      version,
      name: `create_${table.name}`,
      fileName: generateFileName(version, `create_${table.name}`, resolved.versionPadding),
      content: generateCreateTableSql(table, resolved),
      tables: [table.name],
      type: "create"
    });
    version++;
  }
  for (const schema of sortedSchemas) {
    if (!schema.properties) continue;
    for (const [propName, property] of Object.entries(schema.properties)) {
      const pivotTable = generatePivotTable(schema, propName, property, schemas, resolved);
      if (pivotTable && !createdPivots.has(pivotTable.name)) {
        createdPivots.add(pivotTable.name);
        migrations.push({
          version,
          name: `create_${pivotTable.name}`,
          fileName: generateFileName(version, `create_${pivotTable.name}`, resolved.versionPadding),
          content: generateCreateTableSql(pivotTable, resolved),
          tables: [pivotTable.name],
          type: "pivot"
        });
        version++;
      }
      const morphPivot = generateMorphPivotTable(schema, propName, property, schemas, resolved);
      if (morphPivot && !createdPivots.has(morphPivot.name)) {
        createdPivots.add(morphPivot.name);
        migrations.push({
          version,
          name: `create_${morphPivot.name}`,
          fileName: generateFileName(version, `create_${morphPivot.name}`, resolved.versionPadding),
          content: generateCreateTableSql(morphPivot, resolved),
          tables: [morphPivot.name],
          type: "pivot"
        });
        version++;
      }
    }
  }
  return migrations;
}
function generateMigrationFromSchema(schema, allSchemas, options) {
  const resolved = resolveOptions(options);
  const version = options?.version ?? resolved.startVersion;
  const table = schemaToTable(schema, allSchemas, resolved);
  return {
    version,
    name: `create_${table.name}`,
    fileName: generateFileName(version, `create_${table.name}`, resolved.versionPadding),
    content: generateCreateTableSql(table, resolved),
    tables: [table.name],
    type: "create"
  };
}
function generateDropMigration(tableName, options) {
  const resolved = resolveOptions(options);
  const version = options?.version ?? resolved.startVersion;
  const isTableName = tableName.includes("_") || tableName.endsWith("s") || tableName.endsWith("es");
  const snakeTable = isTableName ? tableName : toTableName(tableName);
  const dropSql = formatDropTable(snakeTable, resolved.dialect, { ifExists: true, cascade: true });
  const lines = [
    `-- Migration: Drop ${snakeTable} table`,
    "-- Generated by @famgia/omnify-sql",
    "",
    dropSql
  ];
  return {
    version,
    name: `drop_${snakeTable}`,
    fileName: generateFileName(version, `drop_${snakeTable}`, resolved.versionPadding),
    content: lines.join("\n"),
    tables: [snakeTable],
    type: "drop"
  };
}
function getMigrationPath(migration, basePath = "migrations") {
  return `${basePath}/${migration.fileName}`;
}

export {
  quoteIdentifier,
  quoteString,
  formatColumn,
  formatForeignKey,
  formatIndex,
  formatCreateTable,
  formatDropTable,
  getSqlType,
  getPrimaryKeyType,
  getForeignKeyType,
  getEnumType,
  toSnakeCase,
  toTableName,
  toColumnName,
  schemaToTable,
  generatePivotTable,
  generateMorphPivotTable,
  generateMigrations,
  generateMigrationFromSchema,
  generateDropMigration,
  getMigrationPath
};
//# sourceMappingURL=chunk-OOIPCQ7I.js.map