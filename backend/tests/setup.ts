import { PostgreSqlContainer, StartedPostgreSqlContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { afterAll, beforeAll } from 'vitest';
import path from 'path';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  // Start the Postgres container
  container = await new PostgreSqlContainer('postgres:15-alpine').start();
  
  // Set the environment variables for the test
  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.JWT_SECRET = 'test-secret';

  // Push the schema directly since migrations might not exist
  execSync('npx drizzle-kit push', { 
    env: { ...process.env }, 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
});

afterAll(async () => {
  if (container) {
    await container.stop();
  }
});
