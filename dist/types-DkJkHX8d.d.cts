/**
 * @famgia/omnify-sql - Types
 *
 * Type definitions for SQL migration generator.
 */
/**
 * Supported SQL dialects.
 */
type SqlDialect = 'mysql' | 'postgresql' | 'sqlite';
/**
 * SQL migration file.
 */
interface SqlMigration {
    /** Migration version number (e.g., 1, 2, 3) */
    readonly version: number;
    /** Migration name (e.g., 'create_users') */
    readonly name: string;
    /** Full file name (e.g., '0001_create_users.sql') */
    readonly fileName: string;
    /** SQL content */
    readonly content: string;
    /** Tables affected */
    readonly tables: readonly string[];
    /** Migration type */
    readonly type: 'create' | 'alter' | 'drop' | 'pivot';
}
/**
 * SQL column definition.
 */
interface SqlColumn {
    /** Column name */
    readonly name: string;
    /** SQL type (e.g., 'VARCHAR(255)', 'BIGINT') */
    readonly type: string;
    /** Is nullable */
    readonly nullable: boolean;
    /** Default value */
    readonly defaultValue?: string | undefined;
    /** Is primary key */
    readonly primaryKey: boolean;
    /** Is auto increment */
    readonly autoIncrement: boolean;
    /** Is unique */
    readonly unique: boolean;
    /** Is unsigned (MySQL) */
    readonly unsigned: boolean;
    /** Column comment */
    readonly comment?: string | undefined;
}
/**
 * SQL foreign key definition.
 */
interface SqlForeignKey {
    /** Constraint name */
    readonly name: string;
    /** Local column(s) */
    readonly columns: readonly string[];
    /** Referenced table */
    readonly referencesTable: string;
    /** Referenced column(s) */
    readonly referencesColumns: readonly string[];
    /** ON DELETE action */
    readonly onDelete: string;
    /** ON UPDATE action */
    readonly onUpdate: string;
}
/**
 * SQL index type.
 */
type SqlIndexType = 'btree' | 'hash' | 'fulltext' | 'spatial' | 'gin' | 'gist';
/**
 * SQL index definition.
 */
interface SqlIndex {
    /** Index name */
    readonly name: string;
    /** Columns in the index */
    readonly columns: readonly string[];
    /** Is unique index */
    readonly unique: boolean;
    /** Index type (fulltext, spatial, etc.) */
    readonly type?: SqlIndexType | undefined;
}
/**
 * SQL table definition.
 */
interface SqlTable {
    /** Table name */
    readonly name: string;
    /** Columns */
    readonly columns: readonly SqlColumn[];
    /** Foreign keys */
    readonly foreignKeys: readonly SqlForeignKey[];
    /** Indexes */
    readonly indexes: readonly SqlIndex[];
    /** Table comment */
    readonly comment?: string | undefined;
}
/**
 * Options for SQL generation.
 */
interface SqlGeneratorOptions {
    /** SQL dialect */
    readonly dialect?: SqlDialect;
    /** Use IF NOT EXISTS for CREATE TABLE */
    readonly ifNotExists?: boolean;
    /** Add DROP TABLE statements in down migration */
    readonly generateDown?: boolean;
    /** Starting version number */
    readonly startVersion?: number;
    /** Version number padding (e.g., 4 for 0001) */
    readonly versionPadding?: number;
    /** Custom timestamp for file names */
    readonly timestamp?: string;
}
/**
 * Resolved options with defaults.
 */
interface ResolvedSqlOptions {
    readonly dialect: SqlDialect;
    readonly ifNotExists: boolean;
    readonly generateDown: boolean;
    readonly startVersion: number;
    readonly versionPadding: number;
}

export type { ResolvedSqlOptions as R, SqlGeneratorOptions as S, SqlMigration as a, SqlTable as b, SqlDialect as c, SqlColumn as d, SqlForeignKey as e, SqlIndex as f, SqlIndexType as g };
