import { PrismaClient } from '@prisma/client';
import {
  formatHotQueryPlanSummary,
  runHotQueryExplain,
  summarizeHotQueryPlan,
} from '../src/hot-query-explain';

const prisma = new PrismaClient();

async function main() {
  const userId = readRequiredEnv('PERF_CHECK_USER_ID');
  const hostId = process.env.PERF_CHECK_HOST_ID?.trim() || userId;
  const analyze = readBooleanEnv('PERF_CHECK_RUN_ANALYZE', false);

  if (analyze) {
    console.warn(
      '[hot-query-explain] PERF_CHECK_RUN_ANALYZE=true executes the SELECT queries',
    );
  }

  const reports = await runHotQueryExplain(prisma, {
    userId,
    hostId,
    latitude: readNumberEnv('PERF_CHECK_LATITUDE', 55.75),
    longitude: readNumberEnv('PERF_CHECK_LONGITUDE', 37.61),
    radiusKm: readNumberEnv('PERF_CHECK_RADIUS_KM', 25),
    limit: readIntegerEnv('PERF_CHECK_LIMIT', 100),
    includePostgis: readBooleanEnv('PERF_CHECK_INCLUDE_POSTGIS', false),
    analyze,
  });

  for (const report of reports) {
    console.log(`[hot-query-explain] ${report.label}`);
    console.log(
      `[hot-query-explain] summary ${formatHotQueryPlanSummary(
        summarizeHotQueryPlan(report.plan),
      )}`,
    );
    console.log(JSON.stringify(report.plan, null, 2));
  }
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value);
}

function readNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];

  if (raw == null || raw.trim() === '') {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }

  return value;
}

function readIntegerEnv(name: string, fallback: number) {
  return Math.max(1, Math.trunc(readNumberEnv(name, fallback)));
}

main()
  .catch((error) => {
    console.error('[hot-query-explain] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
