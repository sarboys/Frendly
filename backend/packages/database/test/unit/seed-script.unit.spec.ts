import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Prisma seed script', () => {
  it('does not load demo data into the database', () => {
    const seedPath = join(__dirname, '../../prisma/seed.ts');
    const seedSource = readFileSync(seedPath, 'utf8');

    expect(seedSource).not.toContain('seed-data');
    expect(seedSource).not.toContain('seededUsers');
    expect(seedSource).not.toContain('seededEvents');
    expect(seedSource).not.toContain('seededPosters');
    expect(seedSource).not.toContain('seededEveningRoutes');
  });
});
