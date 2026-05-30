import { defineConfig, devices } from '@playwright/test';

const BACKEND_PORT = 3001;
const FRONTEND_PORT = 4173;

// Screenshot suite: captures Meet stage + Meet side surfaces in known game
// states. The backend is started with E2E_TEST_MODE=1 so /test/* routes are
// mounted. The frontend is served via `vite preview` (static build) so the
// app behaves exactly as in production.
export default defineConfig({
  testDir: './tests/screenshots',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results',

  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'off',
    video: 'off',
  },

  webServer: [
    {
      command: 'pnpm --filter backend run dev',
      cwd: '../',
      url: `http://localhost:${BACKEND_PORT}/test/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        E2E_TEST_MODE: '1',
        NODE_ENV: 'test',
        CORS_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `pnpm exec vite dev --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  projects: [
    {
      name: 'meet-stage',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      testMatch: /meet-stage\.spec\.ts/,
    },
    {
      name: 'meet-side',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 } },
      testMatch: /meet-side\.spec\.ts/,
    },
  ],
});
