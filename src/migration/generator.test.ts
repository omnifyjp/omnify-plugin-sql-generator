/**
 * @famgia/omnify-sql - Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { generateMigrations, generateMigrationFromSchema, generateDropMigration, getMigrationPath } from './generator.js';
import type { LoadedSchema, SchemaCollection } from '@famgia/omnify-types';

describe('SQL Generator', () => {
  const createSchema = (name: string, overrides: Partial<LoadedSchema> = {}): LoadedSchema => ({
    name,
    filePath: `/schemas/${name}.yaml`,
    relativePath: `${name}.yaml`,
    ...overrides,
  });

  describe('generateMigrations', () => {
    it('generates CREATE TABLE migrations', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', {
          kind: 'object',
          properties: {
            email: { type: 'Email', unique: true },
            name: { type: 'String' },
          },
          options: { timestamps: true },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations).toHaveLength(1);
      expect(migrations[0].fileName).toBe('0001_create_users.sql');
      expect(migrations[0].content).toContain('CREATE TABLE');
      expect(migrations[0].content).toContain('`users`');
      expect(migrations[0].content).toContain('`email`');
      expect(migrations[0].content).toContain('`name`');
      expect(migrations[0].tables).toEqual(['users']);
    });

    it('generates versioned file names', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', { kind: 'object', properties: {} }),
        Post: createSchema('Post', { kind: 'object', properties: {} }),
        Comment: createSchema('Comment', { kind: 'object', properties: {} }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].fileName).toBe('0001_create_users.sql');
      expect(migrations[1].fileName).toBe('0002_create_posts.sql');
      expect(migrations[2].fileName).toBe('0003_create_comments.sql');
    });

    it('respects startVersion option', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', { kind: 'object', properties: {} }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql', startVersion: 10 });

      expect(migrations[0].fileName).toBe('0010_create_users.sql');
      expect(migrations[0].version).toBe(10);
    });

    it('respects versionPadding option', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', { kind: 'object', properties: {} }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql', versionPadding: 6 });

      expect(migrations[0].fileName).toBe('000001_create_users.sql');
    });

    it('generates pivot tables for ManyToMany', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', {
          kind: 'object',
          properties: {
            roles: { type: 'Association', relation: 'ManyToMany', target: 'Role' } as any,
          },
        }),
        Role: createSchema('Role', {
          kind: 'object',
          properties: {
            name: { type: 'String' },
          },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      // User, Role, and pivot table
      expect(migrations.length).toBeGreaterThanOrEqual(3);
      expect(migrations.some(m => m.name.includes('roles_users') || m.name.includes('users_roles'))).toBe(true);
    });

    it('generates polymorphic pivot tables for MorphToMany', () => {
      const schemas: SchemaCollection = {
        Post: createSchema('Post', {
          kind: 'object',
          properties: {
            tags: { type: 'Association', relation: 'MorphToMany', target: 'Tag' } as any,
          },
        }),
        Tag: createSchema('Tag', {
          kind: 'object',
          properties: {
            name: { type: 'String' },
          },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations.some(m => m.name.includes('tagables'))).toBe(true);
    });

    it('skips enum schemas', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', { kind: 'object', properties: {} }),
        Status: createSchema('Status', {
          kind: 'enum',
          values: ['active', 'inactive'],
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations).toHaveLength(1);
      expect(migrations[0].name).toBe('create_users');
    });

    it('orders schemas by dependency', () => {
      const schemas: SchemaCollection = {
        Comment: createSchema('Comment', {
          kind: 'object',
          properties: {
            post: { type: 'Association', relation: 'ManyToOne', target: 'Post' } as any,
          },
        }),
        Post: createSchema('Post', {
          kind: 'object',
          properties: {
            author: { type: 'Association', relation: 'ManyToOne', target: 'User' } as any,
          },
        }),
        User: createSchema('User', {
          kind: 'object',
          properties: {},
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      const userIndex = migrations.findIndex(m => m.name === 'create_users');
      const postIndex = migrations.findIndex(m => m.name === 'create_posts');
      const commentIndex = migrations.findIndex(m => m.name === 'create_comments');

      // User should come before Post, Post before Comment
      expect(userIndex).toBeLessThan(postIndex);
      expect(postIndex).toBeLessThan(commentIndex);
    });
  });

  describe('Dialect support', () => {
    const schemas: SchemaCollection = {
      User: createSchema('User', {
        kind: 'object',
        properties: {
          email: { type: 'Email' },
          isActive: { type: 'Boolean', default: true },
        },
        options: { idType: 'BigInt' },
      }),
    };

    it('generates MySQL syntax', () => {
      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain('BIGINT UNSIGNED');
      expect(migrations[0].content).toContain('AUTO_INCREMENT');
      expect(migrations[0].content).toContain('ENGINE=InnoDB');
      expect(migrations[0].content).toContain('`');
    });

    it('generates PostgreSQL syntax', () => {
      const migrations = generateMigrations(schemas, { dialect: 'postgresql' });

      expect(migrations[0].content).toContain('BIGSERIAL');
      expect(migrations[0].content).toContain('"');
      expect(migrations[0].content).not.toContain('ENGINE=');
    });

    it('generates SQLite syntax', () => {
      const migrations = generateMigrations(schemas, { dialect: 'sqlite' });

      expect(migrations[0].content).toContain('INTEGER');
      expect(migrations[0].content).toContain('AUTOINCREMENT');
      expect(migrations[0].content).not.toContain('ENGINE=');
    });
  });

  describe('generateMigrationFromSchema', () => {
    it('generates migration for a single schema', () => {
      const schema = createSchema('User', {
        kind: 'object',
        properties: {
          email: { type: 'Email' },
        },
      });

      const migration = generateMigrationFromSchema(schema, { User: schema }, { dialect: 'mysql', version: 5 });

      expect(migration.version).toBe(5);
      expect(migration.fileName).toBe('0005_create_users.sql');
      expect(migration.type).toBe('create');
    });
  });

  describe('generateDropMigration', () => {
    it('generates DROP TABLE migration', () => {
      const migration = generateDropMigration('users', { dialect: 'mysql', version: 10 });

      expect(migration.version).toBe(10);
      expect(migration.fileName).toBe('0010_drop_users.sql');
      expect(migration.content).toContain('DROP TABLE');
      expect(migration.content).toContain('IF EXISTS');
      expect(migration.type).toBe('drop');
    });

    it('converts schema name to table name', () => {
      const migration = generateDropMigration('User', { dialect: 'mysql' });

      expect(migration.name).toBe('drop_users');
      expect(migration.content).toContain('`users`');
    });

    it('adds CASCADE for PostgreSQL', () => {
      const migration = generateDropMigration('users', { dialect: 'postgresql' });

      expect(migration.content).toContain('CASCADE');
    });
  });

  describe('getMigrationPath', () => {
    it('returns correct path', () => {
      const migration = {
        version: 1,
        name: 'create_users',
        fileName: '0001_create_users.sql',
        content: '',
        tables: ['users'],
        type: 'create' as const,
      };

      expect(getMigrationPath(migration)).toBe('migrations/0001_create_users.sql');
      expect(getMigrationPath(migration, 'db/sql')).toBe('db/sql/0001_create_users.sql');
    });
  });
});

describe('SQL Column Types', () => {
  const createSchema = (name: string, overrides: Partial<LoadedSchema> = {}): LoadedSchema => ({
    name,
    filePath: `/schemas/${name}.yaml`,
    relativePath: `${name}.yaml`,
    ...overrides,
  });

  describe('Primary key types', () => {
    it('generates Int primary key', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', {
          kind: 'object',
          options: { idType: 'Int' },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });
      expect(migrations[0].content).toContain('INT UNSIGNED');
    });

    it('generates UUID primary key', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', {
          kind: 'object',
          options: { idType: 'Uuid' },
        }),
      };

      const mysqlMigrations = generateMigrations(schemas, { dialect: 'mysql' });
      expect(mysqlMigrations[0].content).toContain('CHAR(36)');

      const pgMigrations = generateMigrations(schemas, { dialect: 'postgresql' });
      expect(pgMigrations[0].content).toContain('UUID');
    });

    it('skips id when id: false', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', {
          kind: 'object',
          properties: { email: { type: 'Email' } },
          options: { id: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });
      expect(migrations[0].content).not.toContain('PRIMARY KEY');
    });
  });

  describe('Property types', () => {
    it('maps all basic types', () => {
      const schemas: SchemaCollection = {
        Test: createSchema('Test', {
          kind: 'object',
          properties: {
            stringField: { type: 'String' },
            intField: { type: 'Int' },
            boolField: { type: 'Boolean' },
            textField: { type: 'Text' },
            jsonField: { type: 'Json' },
            dateField: { type: 'Date' },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain('VARCHAR(255)');
      expect(migrations[0].content).toContain('INT');
      expect(migrations[0].content).toContain('TINYINT(1)');
      expect(migrations[0].content).toContain('TEXT');
      expect(migrations[0].content).toContain('JSON');
      expect(migrations[0].content).toContain('DATE');
    });

    it('handles nullable fields', () => {
      const schemas: SchemaCollection = {
        Test: createSchema('Test', {
          kind: 'object',
          properties: {
            required: { type: 'String' },
            optional: { type: 'String', nullable: true },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain('`required` VARCHAR(255) NOT NULL');
      expect(migrations[0].content).toContain('`optional` VARCHAR(255) NULL');
    });

    it('handles default values', () => {
      const schemas: SchemaCollection = {
        Test: createSchema('Test', {
          kind: 'object',
          properties: {
            status: { type: 'String', default: 'active' },
            count: { type: 'Int', default: 0 },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain("DEFAULT 'active'");
      expect(migrations[0].content).toContain('DEFAULT 0');
    });

    it('handles Enum types', () => {
      const schemas: SchemaCollection = {
        Test: createSchema('Test', {
          kind: 'object',
          properties: {
            status: { type: 'Enum', enum: ['draft', 'published', 'archived'] },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain("ENUM('draft', 'published', 'archived')");
    });
  });

  describe('Timestamps and soft delete', () => {
    it('generates timestamp columns by default', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', {
          kind: 'object',
          options: { timestamps: true },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain('`created_at`');
      expect(migrations[0].content).toContain('`updated_at`');
    });

    it('skips timestamps when disabled', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', {
          kind: 'object',
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).not.toContain('created_at');
      expect(migrations[0].content).not.toContain('updated_at');
    });

    it('generates soft delete column', () => {
      const schemas: SchemaCollection = {
        User: createSchema('User', {
          kind: 'object',
          options: { softDelete: true },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain('`deleted_at`');
    });
  });
});

describe('SQL Foreign Keys', () => {
  const createSchema = (name: string, overrides: Partial<LoadedSchema> = {}): LoadedSchema => ({
    name,
    filePath: `/schemas/${name}.yaml`,
    relativePath: `${name}.yaml`,
    ...overrides,
  });

  it('generates foreign key for ManyToOne', () => {
    const schemas: SchemaCollection = {
      Post: createSchema('Post', {
        kind: 'object',
        properties: {
          author: { type: 'Association', relation: 'ManyToOne', target: 'User' } as any,
        },
      }),
      User: createSchema('User', { kind: 'object' }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'mysql' });
    const postMigration = migrations.find(m => m.name === 'create_posts');

    expect(postMigration?.content).toContain('`author_id`');
    expect(postMigration?.content).toContain('FOREIGN KEY');
    expect(postMigration?.content).toContain('REFERENCES `users`');
    expect(postMigration?.content).toContain('ON DELETE CASCADE');
  });

  it('respects onDelete and onUpdate options', () => {
    const schemas: SchemaCollection = {
      Post: createSchema('Post', {
        kind: 'object',
        properties: {
          author: {
            type: 'Association',
            relation: 'ManyToOne',
            target: 'User',
            onDelete: 'SET NULL',
            onUpdate: 'RESTRICT',
          } as any,
        },
      }),
      User: createSchema('User', { kind: 'object' }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'mysql' });
    const postMigration = migrations.find(m => m.name === 'create_posts');

    expect(postMigration?.content).toContain('ON DELETE SET NULL');
    expect(postMigration?.content).toContain('ON UPDATE RESTRICT');
  });

  it('generates index for foreign key column', () => {
    const schemas: SchemaCollection = {
      Post: createSchema('Post', {
        kind: 'object',
        properties: {
          author: { type: 'Association', relation: 'ManyToOne', target: 'User' } as any,
        },
      }),
      User: createSchema('User', { kind: 'object' }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'mysql' });
    const postMigration = migrations.find(m => m.name === 'create_posts');

    expect(postMigration?.content).toContain('CREATE INDEX');
    expect(postMigration?.content).toContain('`author_id`');
  });
});

describe('SQL Polymorphic Relations', () => {
  const createSchema = (name: string, overrides: Partial<LoadedSchema> = {}): LoadedSchema => ({
    name,
    filePath: `/schemas/${name}.yaml`,
    relativePath: `${name}.yaml`,
    ...overrides,
  });

  it('generates polymorphic columns for MorphTo', () => {
    const schemas: SchemaCollection = {
      Comment: createSchema('Comment', {
        kind: 'object',
        properties: {
          commentable: {
            type: 'Association',
            relation: 'MorphTo',
            targets: ['Post', 'Video'],
          } as any,
        },
      }),
      Post: createSchema('Post', { kind: 'object' }),
      Video: createSchema('Video', { kind: 'object' }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'mysql' });
    const commentMigration = migrations.find(m => m.name === 'create_comments');

    expect(commentMigration?.content).toContain('`commentable_type`');
    expect(commentMigration?.content).toContain('`commentable_id`');
    expect(commentMigration?.content).toContain("ENUM('Post', 'Video')");
    expect(commentMigration?.content).toContain('CREATE INDEX');
  });
});

describe('SQL Index Types', () => {
  const createSchema = (name: string, overrides: Partial<LoadedSchema> = {}): LoadedSchema => ({
    name,
    filePath: `/schemas/${name}.yaml`,
    relativePath: `${name}.yaml`,
    ...overrides,
  });

  it('generates fulltext index for MySQL', () => {
    const schemas: SchemaCollection = {
      Article: createSchema('Article', {
        kind: 'object',
        properties: {
          title: { type: 'String' },
          content: { type: 'Text' },
        },
        options: {
          indexes: [
            { columns: ['title', 'content'], type: 'fulltext', name: 'articles_fulltext' },
          ],
        },
      }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'mysql' });

    expect(migrations[0].content).toContain('CREATE FULLTEXT INDEX');
    expect(migrations[0].content).toContain('`articles_fulltext`');
  });

  it('generates GIN fulltext index for PostgreSQL', () => {
    const schemas: SchemaCollection = {
      Article: createSchema('Article', {
        kind: 'object',
        properties: {
          title: { type: 'String' },
          content: { type: 'Text' },
        },
        options: {
          indexes: [
            { columns: ['title', 'content'], type: 'fulltext', name: 'articles_fulltext' },
          ],
        },
      }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'postgresql' });

    expect(migrations[0].content).toContain('USING GIN');
    expect(migrations[0].content).toContain('to_tsvector');
  });

  it('generates spatial index for MySQL', () => {
    const schemas: SchemaCollection = {
      Location: createSchema('Location', {
        kind: 'object',
        properties: {
          coordinates: { type: 'Json' },
        },
        options: {
          indexes: [
            { columns: ['coordinates'], type: 'spatial', name: 'locations_spatial' },
          ],
        },
      }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'mysql' });

    expect(migrations[0].content).toContain('CREATE SPATIAL INDEX');
  });

  it('generates GIST spatial index for PostgreSQL', () => {
    const schemas: SchemaCollection = {
      Location: createSchema('Location', {
        kind: 'object',
        properties: {
          coordinates: { type: 'Json' },
        },
        options: {
          indexes: [
            { columns: ['coordinates'], type: 'spatial', name: 'locations_spatial' },
          ],
        },
      }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'postgresql' });

    expect(migrations[0].content).toContain('USING GIST');
  });

  it('generates hash index', () => {
    const schemas: SchemaCollection = {
      User: createSchema('User', {
        kind: 'object',
        properties: {
          email: { type: 'Email' },
        },
        options: {
          indexes: [
            { columns: ['email'], type: 'hash', name: 'users_email_hash' },
          ],
        },
      }),
    };

    const mysqlMigrations = generateMigrations(schemas, { dialect: 'mysql' });
    expect(mysqlMigrations[0].content).toContain('USING HASH');

    const pgMigrations = generateMigrations(schemas, { dialect: 'postgresql' });
    expect(pgMigrations[0].content).toContain('USING HASH');
  });

  it('generates GIN index for PostgreSQL', () => {
    const schemas: SchemaCollection = {
      Document: createSchema('Document', {
        kind: 'object',
        properties: {
          data: { type: 'Json' },
        },
        options: {
          indexes: [
            { columns: ['data'], type: 'gin', name: 'documents_data_gin' },
          ],
        },
      }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'postgresql' });

    expect(migrations[0].content).toContain('USING GIN');
  });

  it('generates unique index', () => {
    const schemas: SchemaCollection = {
      User: createSchema('User', {
        kind: 'object',
        properties: {
          email: { type: 'Email' },
        },
        options: {
          indexes: [
            { columns: ['email'], unique: true, name: 'users_email_unique' },
          ],
        },
      }),
    };

    const migrations = generateMigrations(schemas, { dialect: 'mysql' });

    expect(migrations[0].content).toContain('CREATE UNIQUE INDEX');
  });

  describe('Index type compatibility validation', () => {
    it('throws error for GIN index with MySQL', () => {
      const schemas: SchemaCollection = {
        Document: createSchema('Document', {
          kind: 'object',
          properties: { data: { type: 'Json' } },
          options: {
            indexes: [{ columns: ['data'], type: 'gin', name: 'docs_data_gin' }],
          },
        }),
      };

      expect(() => generateMigrations(schemas, { dialect: 'mysql' })).toThrow(
        /gin.*is not supported in mysql/i
      );
    });

    it('throws error for GIN index with SQLite', () => {
      const schemas: SchemaCollection = {
        Document: createSchema('Document', {
          kind: 'object',
          properties: { data: { type: 'Json' } },
          options: {
            indexes: [{ columns: ['data'], type: 'gin', name: 'docs_data_gin' }],
          },
        }),
      };

      expect(() => generateMigrations(schemas, { dialect: 'sqlite' })).toThrow(
        /gin.*is not supported in sqlite/i
      );
    });

    it('throws error for GIST index with MySQL', () => {
      const schemas: SchemaCollection = {
        Location: createSchema('Location', {
          kind: 'object',
          properties: { coords: { type: 'Json' } },
          options: {
            indexes: [{ columns: ['coords'], type: 'gist', name: 'loc_coords_gist' }],
          },
        }),
      };

      expect(() => generateMigrations(schemas, { dialect: 'mysql' })).toThrow(
        /gist.*is not supported in mysql/i
      );
    });

    it('throws error for fulltext index with SQLite', () => {
      const schemas: SchemaCollection = {
        Article: createSchema('Article', {
          kind: 'object',
          properties: { content: { type: 'Text' } },
          options: {
            indexes: [{ columns: ['content'], type: 'fulltext', name: 'articles_ft' }],
          },
        }),
      };

      expect(() => generateMigrations(schemas, { dialect: 'sqlite' })).toThrow(
        /fulltext.*is not supported in sqlite/
      );
    });

    it('throws error for spatial index with SQLite', () => {
      const schemas: SchemaCollection = {
        Location: createSchema('Location', {
          kind: 'object',
          properties: { coords: { type: 'Json' } },
          options: {
            indexes: [{ columns: ['coords'], type: 'spatial', name: 'loc_spatial' }],
          },
        }),
      };

      expect(() => generateMigrations(schemas, { dialect: 'sqlite' })).toThrow(
        /spatial.*is not supported in sqlite/
      );
    });

    it('allows GIN index with PostgreSQL', () => {
      const schemas: SchemaCollection = {
        Document: createSchema('Document', {
          kind: 'object',
          properties: { data: { type: 'Json' } },
          options: {
            timestamps: false,
            indexes: [{ columns: ['data'], type: 'gin', name: 'docs_data_gin' }],
          },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'postgresql' });
      expect(migrations[0].content).toContain('USING GIN');
    });

    it('allows fulltext index with MySQL', () => {
      const schemas: SchemaCollection = {
        Article: createSchema('Article', {
          kind: 'object',
          properties: { content: { type: 'Text' } },
          options: {
            timestamps: false,
            indexes: [{ columns: ['content'], type: 'fulltext', name: 'articles_ft' }],
          },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });
      expect(migrations[0].content).toContain('CREATE FULLTEXT INDEX');
    });
  });
});

describe('Spatial/Geographic Types', () => {
  const createSchema = (name: string, overrides: Partial<LoadedSchema> = {}): LoadedSchema => ({
    name,
    filePath: `/schemas/${name}.yaml`,
    relativePath: `${name}.yaml`,
    ...overrides,
  });

  describe('Point type', () => {
    it('generates POINT column for MySQL', () => {
      const schemas: SchemaCollection = {
        Store: createSchema('Store', {
          kind: 'object',
          properties: {
            location: { type: 'Point' },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain('POINT');
    });

    it('generates geometry(Point) column for PostgreSQL', () => {
      const schemas: SchemaCollection = {
        Store: createSchema('Store', {
          kind: 'object',
          properties: {
            location: { type: 'Point' },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'postgresql' });

      expect(migrations[0].content).toContain('geometry(Point, 4326)');
    });

    it('throws error for Point type with SQLite (incompatible)', () => {
      const schemas: SchemaCollection = {
        Store: createSchema('Store', {
          kind: 'object',
          properties: {
            location: { type: 'Point' },
          },
          options: { timestamps: false },
        }),
      };

      expect(() => generateMigrations(schemas, { dialect: 'sqlite' })).toThrow(
        /Point.*is not supported in sqlite/i
      );
    });
  });

  describe('Coordinates type', () => {
    it('generates latitude/longitude DECIMAL columns for MySQL', () => {
      const schemas: SchemaCollection = {
        Store: createSchema('Store', {
          kind: 'object',
          properties: {
            location: { type: 'Coordinates' },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain('`location_latitude` DECIMAL(10, 8)');
      expect(migrations[0].content).toContain('`location_longitude` DECIMAL(11, 8)');
    });

    it('generates latitude/longitude DECIMAL columns for PostgreSQL', () => {
      const schemas: SchemaCollection = {
        Store: createSchema('Store', {
          kind: 'object',
          properties: {
            location: { type: 'Coordinates' },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'postgresql' });

      expect(migrations[0].content).toContain('"location_latitude" DECIMAL(10, 8)');
      expect(migrations[0].content).toContain('"location_longitude" DECIMAL(11, 8)');
    });

    it('generates latitude/longitude REAL columns for SQLite', () => {
      const schemas: SchemaCollection = {
        Store: createSchema('Store', {
          kind: 'object',
          properties: {
            location: { type: 'Coordinates' },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'sqlite' });

      expect(migrations[0].content).toContain('"location_latitude" REAL');
      expect(migrations[0].content).toContain('"location_longitude" REAL');
    });

    it('respects nullable option for Coordinates', () => {
      const schemas: SchemaCollection = {
        Store: createSchema('Store', {
          kind: 'object',
          properties: {
            location: { type: 'Coordinates', nullable: true },
          },
          options: { timestamps: false },
        }),
      };

      const migrations = generateMigrations(schemas, { dialect: 'mysql' });

      expect(migrations[0].content).toContain('`location_latitude` DECIMAL(10, 8) NULL');
      expect(migrations[0].content).toContain('`location_longitude` DECIMAL(11, 8) NULL');
    });
  });
});
