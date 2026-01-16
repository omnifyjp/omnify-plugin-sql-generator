# @famgia/omnify-sql

Raw SQL Migration Generator for Omnify schemas. Generates versioned SQL migration files (`0001_create_users.sql`, `0002_create_posts.sql`, etc.) from Omnify schema definitions.

## Installation

```bash
npm install @famgia/omnify-sql
# or
pnpm add @famgia/omnify-sql
```

## Features

- **Multi-dialect support**: MySQL, PostgreSQL, SQLite
- **Versioned migrations**: Auto-numbered migration files
- **Foreign keys**: Automatic FK generation with referential actions
- **Pivot tables**: ManyToMany and MorphToMany support
- **Index types**: btree, hash, fulltext, spatial, gin, gist
- **Spatial types**: Point and Coordinates
- **Compatibility validation**: Errors for incompatible type/dialect combinations

## Quick Start

```typescript
import { generateMigrations } from '@famgia/omnify-sql';

const schemas = {
  User: {
    name: 'User',
    kind: 'object',
    properties: {
      email: { type: 'Email', unique: true },
      name: { type: 'String' },
    },
    options: { timestamps: true },
  },
};

const migrations = generateMigrations(schemas, { dialect: 'mysql' });

for (const migration of migrations) {
  console.log(migration.fileName);
  // 0001_create_users.sql
  console.log(migration.content);
  // CREATE TABLE `users` ...
}
```

## Supported Dialects

| Feature | MySQL | PostgreSQL | SQLite |
|---------|:-----:|:----------:|:------:|
| Basic types | ✅ | ✅ | ✅ |
| Foreign keys | ✅ | ✅ | ✅ |
| Timestamps | ✅ | ✅ | ✅ |
| Soft delete | ✅ | ✅ | ✅ |
| JSON | `JSON` | `JSONB` | `TEXT` |
| UUID | `CHAR(36)` | `UUID` | `TEXT` |
| Boolean | `TINYINT(1)` | `BOOLEAN` | `INTEGER` |

## Data Types

### Type Compatibility Matrix

| Omnify Type | MySQL | PostgreSQL | SQLite | Notes |
|-------------|:-----:|:----------:|:------:|-------|
| `String` | ✅ | ✅ | ✅ | |
| `Int` | ✅ | ✅ | ✅ | |
| `BigInt` | ✅ | ✅ | ✅ | |
| `Float` | ✅ | ✅ | ✅ | |
| `Decimal` | ✅ | ✅ | ⚠️ | SQLite uses REAL (less precision) |
| `Boolean` | ✅ | ✅ | ✅ | |
| `Text` | ✅ | ✅ | ✅ | |
| `LongText` | ✅ | ✅ | ✅ | |
| `Date` | ✅ | ✅ | ⚠️ | SQLite uses TEXT |
| `Time` | ✅ | ✅ | ⚠️ | SQLite uses TEXT |
| `Timestamp` | ✅ | ✅ | ⚠️ | SQLite uses TEXT |
| `Json` | ✅ | ✅ | ⚠️ | SQLite uses TEXT (no JSON functions) |
| `Email` | ✅ | ✅ | ✅ | |
| `Password` | ✅ | ✅ | ✅ | |
| `File` | ✅ | ✅ | ✅ | |
| `MultiFile` | ✅ | ✅ | ⚠️ | SQLite uses TEXT |
| `Point` | ✅ | ✅ | ❌ | **Error** - SQLite not supported |
| `Coordinates` | ✅ | ✅ | ✅ | Cross-DB compatible |
| `Enum` | ✅ | ✅ | ✅ | |
| `Select` | ✅ | ✅ | ✅ | |
| `Lookup` | ✅ | ✅ | ✅ | |

Legend: ✅ Full support | ⚠️ Works with limitations | ❌ Not supported (throws error)

### SQL Type Mappings

| Omnify Type | MySQL | PostgreSQL | SQLite |
|-------------|-------|------------|--------|
| `String` | `VARCHAR(255)` | `VARCHAR(255)` | `TEXT` |
| `Int` | `INT` | `INTEGER` | `INTEGER` |
| `BigInt` | `BIGINT` | `BIGINT` | `INTEGER` |
| `Float` | `DOUBLE` | `DOUBLE PRECISION` | `REAL` |
| `Decimal` | `DECIMAL(p,s)` | `DECIMAL(p,s)` | `REAL` |
| `Boolean` | `TINYINT(1)` | `BOOLEAN` | `INTEGER` |
| `Text` | `TEXT` | `TEXT` | `TEXT` |
| `LongText` | `LONGTEXT` | `TEXT` | `TEXT` |
| `Date` | `DATE` | `DATE` | `TEXT` |
| `Time` | `TIME` | `TIME` | `TEXT` |
| `Timestamp` | `TIMESTAMP` | `TIMESTAMP` | `TEXT` |
| `Json` | `JSON` | `JSONB` | `TEXT` |
| `Email` | `VARCHAR(255)` | `VARCHAR(255)` | `TEXT` |
| `Password` | `VARCHAR(255)` | `VARCHAR(255)` | `TEXT` |

### Spatial/Geographic Types

| Type | MySQL | PostgreSQL | SQLite | Cross-DB |
|------|-------|------------|--------|:--------:|
| `Point` | `POINT` | `geometry(Point, 4326)` | ❌ Error | No |
| `Coordinates` | `DECIMAL(10,8)` + `DECIMAL(11,8)` | `DECIMAL(10,8)` + `DECIMAL(11,8)` | `REAL` + `REAL` | ✅ Yes |

**Note**: `Coordinates` type generates two columns: `{name}_latitude` and `{name}_longitude`.

```yaml
# Schema
properties:
  location:
    type: Coordinates
    nullable: true

# Generated SQL (MySQL)
`location_latitude` DECIMAL(10, 8) NULL,
`location_longitude` DECIMAL(11, 8) NULL
```

## Index Types

| Index Type | MySQL | PostgreSQL | SQLite | Use Case |
|------------|:-----:|:----------:|:------:|----------|
| `btree` | ✅ | ✅ | ✅ | Default, general purpose |
| `hash` | ✅ | ✅ | ✅ (fallback) | Equality lookups |
| `fulltext` | ✅ | ✅ (GIN) | ❌ Error | Text search |
| `spatial` | ✅ | ✅ (GIST) | ❌ Error | Geographic data |
| `gin` | ❌ Error | ✅ | ❌ Error | JSONB, arrays |
| `gist` | ❌ Error | ✅ | ❌ Error | Spatial, range types |

### Example

```yaml
options:
  indexes:
    - columns: [title, content]
      type: fulltext
      name: articles_fulltext
    - columns: [email]
      unique: true
```

Generated SQL:
```sql
-- MySQL
CREATE FULLTEXT INDEX `articles_fulltext` ON `articles` (`title`, `content`);

-- PostgreSQL
CREATE INDEX "articles_fulltext" ON "articles"
  USING GIN (to_tsvector('english', "title") || to_tsvector('english', "content"));
```

## Compatibility Validation

The generator automatically validates type and index compatibility with the target dialect. Incompatible combinations throw descriptive errors:

```
SQL Generator: Incompatible types detected for dialect "sqlite":

1. Schema "Store", property "location": Type "Point" is not supported in sqlite.
   SQLite does not support native spatial types. Use Coordinates type for
   cross-database compatibility.

2. Schema "Article", index "articles_ft": Index type "fulltext" is not supported
   in sqlite. SQLite does not support native fulltext indexes.

To fix: Either change the type/index or use a compatible dialect.
```

## API Reference

### `generateMigrations(schemas, options)`

Generates all migrations for a schema collection.

```typescript
const migrations = generateMigrations(schemas, {
  dialect: 'mysql',        // 'mysql' | 'postgresql' | 'sqlite'
  ifNotExists: true,       // Add IF NOT EXISTS
  generateDown: true,      // Include DROP TABLE comments
  startVersion: 1,         // Starting version number
  versionPadding: 4,       // Padding for version (0001, 00001, etc.)
});
```

### `generateMigrationFromSchema(schema, allSchemas, options)`

Generates a single migration for one schema.

### `generateDropMigration(tableName, options)`

Generates a DROP TABLE migration.

### `getMigrationPath(migration, basePath)`

Returns the file path for a migration.

## Plugin Usage

Use as an Omnify plugin:

```typescript
import sqlPlugin from '@famgia/omnify-sql/plugin';

const config = {
  plugins: [
    sqlPlugin({
      dialect: 'postgresql',
      outputDir: 'database/migrations',
    }),
  ],
};
```

## License

MIT
