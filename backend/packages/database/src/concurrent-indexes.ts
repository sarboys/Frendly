import { Prisma } from '@prisma/client';

export type ConcurrentIndexStatement = {
  name: string;
  sql: string;
};

export type ConcurrentIndexProgressEvent = {
  action: 'drop-invalid' | 'create';
  statement: ConcurrentIndexStatement;
};

type ConcurrentIndexClient = {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray | Prisma.Sql,
    ...values: unknown[]
  ): Promise<T>;
  $executeRawUnsafe(sql: string): Promise<number>;
};

const DEFAULT_LOCK_TIMEOUT = '5s';

export async function prepareLongRunningDdlSession(
  client: Pick<ConcurrentIndexClient, '$executeRawUnsafe'>,
  options: { lockTimeout?: string } = {},
) {
  await client.$executeRawUnsafe('SET statement_timeout = 0');
  await client.$executeRawUnsafe(
    `SET lock_timeout = '${options.lockTimeout ?? DEFAULT_LOCK_TIMEOUT}'`,
  );
}

export async function createConcurrentIndexes(
  client: ConcurrentIndexClient,
  statements: ConcurrentIndexStatement[],
  options: {
    lockTimeout?: string;
    onProgress?: (event: ConcurrentIndexProgressEvent) => void;
  } = {},
) {
  await prepareLongRunningDdlSession(client, {
    lockTimeout: options.lockTimeout,
  });

  for (const statement of statements) {
    if (await isInvalidIndex(client, statement.name)) {
      options.onProgress?.({ action: 'drop-invalid', statement });
      await client.$executeRawUnsafe(
        `DROP INDEX CONCURRENTLY IF EXISTS ${quotePostgresIdentifier(statement.name)}`,
      );
    }

    options.onProgress?.({ action: 'create', statement });
    await client.$executeRawUnsafe(statement.sql);
  }
}

export function quotePostgresIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe PostgreSQL identifier: ${identifier}`);
  }

  return `"${identifier.replace(/"/g, '""')}"`;
}

async function isInvalidIndex(
  client: Pick<ConcurrentIndexClient, '$queryRaw'>,
  indexName: string,
) {
  const rows = await client.$queryRaw<Array<{ is_invalid: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_class idx
      JOIN pg_index i ON i.indexrelid = idx.oid
      JOIN pg_namespace ns ON ns.oid = idx.relnamespace
      WHERE idx.relname = ${indexName}
        AND ns.nspname = current_schema()
        AND i.indisvalid = false
    ) AS is_invalid
  `;

  return rows[0]?.is_invalid === true;
}
