import { PostgreSqlContainer, type StartedPostgreSqlContainer } from 'testcontainers';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');

let container: StartedPostgreSqlContainer | null = null;

export async function setup() {
  container = await new PostgreSqlContainer('postgres:15-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.JWT_SECRET = 'test-secret';

  // Push schema directly — fast, and tests don't need migration history.
  execSync('npx drizzle-kit push --force', {
    env: { ...process.env },
    stdio: 'inherit',
    cwd: backendRoot,
  });
}

export async function teardown() {
  if (container) {
    await container.stop();
    container = null;
  }
}
