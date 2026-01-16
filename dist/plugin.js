import {
  generateMigrations,
  getMigrationPath
} from "./chunk-OOIPCQ7I.js";

// src/plugin.ts
function resolveOptions(options) {
  return {
    dialect: options?.dialect ?? "mysql",
    migrationsPath: options?.migrationsPath ?? "migrations",
    ifNotExists: options?.ifNotExists ?? true,
    generateDown: options?.generateDown ?? true,
    startVersion: options?.startVersion ?? 1,
    versionPadding: options?.versionPadding ?? 4
  };
}
function sqlPlugin(options) {
  const resolved = resolveOptions(options);
  return {
    name: "@famgia/omnify-sql",
    version: "0.0.1",
    generators: [
      {
        name: "sql-migrations",
        description: `Generate ${resolved.dialect.toUpperCase()} SQL migration files`,
        generate: async (ctx) => {
          const generatorOptions = {
            dialect: resolved.dialect,
            ifNotExists: resolved.ifNotExists,
            generateDown: resolved.generateDown,
            startVersion: resolved.startVersion,
            versionPadding: resolved.versionPadding
          };
          const migrations = generateMigrations(ctx.schemas, generatorOptions);
          return migrations.map((migration) => ({
            path: getMigrationPath(migration, resolved.migrationsPath),
            content: migration.content,
            type: "migration",
            metadata: {
              version: migration.version,
              tables: migration.tables,
              migrationType: migration.type,
              dialect: resolved.dialect
            }
          }));
        }
      }
    ]
  };
}
export {
  sqlPlugin as default,
  sqlPlugin
};
//# sourceMappingURL=plugin.js.map