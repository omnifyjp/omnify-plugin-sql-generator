"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }


var _chunkSGXQQITCcjs = require('./chunk-SGXQQITC.cjs');

// src/plugin.ts
function resolveOptions(options) {
  return {
    dialect: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _ => _.dialect]), () => ( "mysql")),
    migrationsPath: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _2 => _2.migrationsPath]), () => ( "migrations")),
    ifNotExists: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _3 => _3.ifNotExists]), () => ( true)),
    generateDown: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _4 => _4.generateDown]), () => ( true)),
    startVersion: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _5 => _5.startVersion]), () => ( 1)),
    versionPadding: _nullishCoalesce(_optionalChain([options, 'optionalAccess', _6 => _6.versionPadding]), () => ( 4))
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
          const migrations = _chunkSGXQQITCcjs.generateMigrations.call(void 0, ctx.schemas, generatorOptions);
          return migrations.map((migration) => ({
            path: _chunkSGXQQITCcjs.getMigrationPath.call(void 0, migration, resolved.migrationsPath),
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



exports.default = sqlPlugin; exports.sqlPlugin = sqlPlugin;
//# sourceMappingURL=plugin.cjs.map