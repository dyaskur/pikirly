import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { execSync } from 'node:child_process';

// Vitest runs with process.cwd() at the project root (backend/)
const backendRoot = process.cwd();

let container: StartedTestContainer | null = null;

export async function setup() {
  container = await new GenericContainer('postgres:15-alpine')
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: 'password',
      POSTGRES_DB: 'postgres',
    })
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .start();

  const port = container.getMappedPort(5432);
  const host = container.getHost();
  
  process.env.DATABASE_URL = `postgres://postgres:password@${host}:${port}/postgres`;
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
