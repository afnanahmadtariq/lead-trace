import { defineConfig, devices } from '@playwright/test'

const webPort = Number(process.env.E2E_WEB_PORT || 3000)
const apiPort = Number(process.env.E2E_API_PORT || 3001)
const useRealStack = process.env.E2E_USE_REAL_STACK === 'true'
const hostEnv = { HOSTNAME: '127.0.0.1', LISTEN_HOST: '127.0.0.1' }

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${webPort}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: useRealStack ? [
    {
      command: 'npm run dev --workspace=@lead-trace/api',
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...hostEnv,
        NODE_ENV: 'development',
        PORT: String(apiPort),
        E2E_ENABLED: 'true',
        E2E_SEED_SECRET: process.env.E2E_SEED_SECRET || 'e2e-local-secret-ok',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/lead-trace?schema=public',
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'local-better-auth-secret-minimum-32-chars',
        BETTER_AUTH_URL: `http://127.0.0.1:${apiPort}`,
        BETTER_AUTH_TRUSTED_ORIGINS: `http://127.0.0.1:${webPort}`,
        BETTER_AUTH_COOKIE_DOMAIN: '',
        WEB_ORIGIN: `http://127.0.0.1:${webPort}`,
      },
    },
    {
      command: `npm run dev -- --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...hostEnv,
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
        NEXT_DIST_DIR: `.next-e2e-${webPort}`,
        PORT: String(webPort),
      },
    },
  ] : [
    {
      command: 'node e2e/mock-api-server.mjs',
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...hostEnv, E2E_API_PORT: String(apiPort) },
    },
    {
      command: `npm run dev -- --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...hostEnv,
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
        NEXT_DIST_DIR: `.next-e2e-${webPort}`,
        PORT: String(webPort),
      },
    },
  ],
})
