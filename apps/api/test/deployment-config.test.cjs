const assert = require('node:assert/strict')
const { existsSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { test } = require('node:test')

const repositoryRoot = resolve(__dirname, '../../..')
const apiWorkflow = readFileSync(resolve(repositoryRoot, '.github/workflows/deploy-vps.yml'), 'utf8')
const webWorkflow = readFileSync(resolve(repositoryRoot, '.github/workflows/deploy-cloudflare.yml'), 'utf8')
const rootPackage = readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')
const compose = readFileSync(resolve(repositoryRoot, 'docker-compose.yml'), 'utf8')
const playwrightConfig = readFileSync(resolve(repositoryRoot, 'apps/web/playwright.config.ts'), 'utf8')
const researchJourney = readFileSync(resolve(repositoryRoot, 'apps/web/e2e/research-journey.spec.ts'), 'utf8')
const workerService = compose.slice(compose.indexOf('  worker:'), compose.indexOf('  nginx:'))

test('API and Cloudflare workflows own their required PR verification and tag releases', () => {
  assert.match(apiWorkflow, /^name: Deploy production API/m)
  assert.match(webWorkflow, /^name: Deploy Cloudflare \(Frontend\)/m)
  for (const workflow of [apiWorkflow, webWorkflow]) {
    assert.match(workflow, /pull_request:/)
    assert.match(workflow, /push:[\s\S]*tags:\s*\n\s*- ["']v\*["']/)
    assert.match(workflow, /jobs:\s*\n\s*verify:/)
  }
  assert.equal(existsSync(resolve(repositoryRoot, '.github/workflows/ci.yml')), false)
  assert.equal(existsSync(resolve(repositoryRoot, '.github/workflows/deploy-cloudflare.yml')), true)
})

test('API deployment migrates first and recreates nginx separately', () => {
  const migrate = apiWorkflow.indexOf('docker compose run --rm --no-deps api migrate')
  const backend = apiWorkflow.indexOf('docker compose up -d --no-build --no-deps --wait --wait-timeout 60 api')
  const nginx = apiWorkflow.indexOf('docker compose up -d --no-build --force-recreate --remove-orphans --wait --wait-timeout 60 nginx')
  const launchEmail = apiWorkflow.indexOf('docker compose run --rm --no-deps api notify-waitlist-launch --send')

  assert.ok(migrate > 0 && backend > migrate && nginx > backend && launchEmail > nginx)
  assert.doesNotMatch(apiWorkflow, /force-recreate[^\n]*api/)
  assert.match(apiWorkflow, /--force-recreate[^\n]*nginx/)
})

test('repository clean uses cross-platform rimraf through Turbo', () => {
  const parsed = JSON.parse(rootPackage)
  assert.match(parsed.scripts.clean, /turbo run clean/)
  assert.match(parsed.scripts.clean, /rimraf/)
})

test('deployment configuration contains no Kelvo paths or images', () => {
  assert.doesNotMatch(`${apiWorkflow}\n${webWorkflow}`, /kelvo/i)
})

test('API deployment passes Tavily discovery configuration to the container', () => {
  assert.match(compose, /TAVILY_API_KEY/)
  assert.match(compose, /TAVILY_SEARCH_DEPTH/)
  assert.match(compose, /TAVILY_MAX_RESULTS/)
})

test('API healthcheck matches the default dual-stack listener', () => {
  const apiService = compose.slice(compose.indexOf('  api:'), compose.indexOf('  worker:'))
  const apiMain = readFileSync(resolve(repositoryRoot, 'apps/api/src/main.ts'), 'utf8')
  assert.match(apiService, /http:\/\/localhost:3001\/health/)
  assert.match(apiMain, /app\.listen\(process\.env\.PORT \?\? 3001\)/)
  assert.doesNotMatch(apiMain, /app\.listen\([^\n]+0\.0\.0\.0/)
})

test('production deployment builds, pulls, and starts the worker service', () => {
  assert.match(compose, /WORKER_IMAGE/)
  assert.match(apiWorkflow, /WORKER_IMAGE_NAME/)
  assert.match(apiWorkflow, /Build and push worker image/)
  assert.match(apiWorkflow, /docker compose pull api worker/)
  assert.match(apiWorkflow, /docker compose up -d --no-build --no-deps --wait --wait-timeout 60 api worker/)
  assert.match(apiWorkflow, /docker compose ps -q --status running worker/)
})

test('worker receives brief-ready email configuration', () => {
  assert.match(workerService, /RESEND_API_KEY/)
  assert.match(workerService, /RESEND_FROM_EMAIL/)
  assert.match(workerService, /WEB_ORIGIN/)
})

test('production release verifies worker code and backend integration tests', () => {
  assert.match(apiWorkflow, /npm run worker:setup/)
  assert.match(apiWorkflow, /npm run test -- --filter=@lead-trace\/worker/)
  assert.match(apiWorkflow, /INTEGRATION_TESTS: ["']true["']/)
  assert.match(apiWorkflow, /node --test test\/\*\.integration\.test\.cjs/)
})

test('production deploy validates required provider settings before changing services', () => {
  const preflight = apiWorkflow.indexOf('for required in POSTGRES_PASSWORD')
  const pull = apiWorkflow.indexOf('docker compose pull api worker')
  assert.ok(preflight > 0 && pull > preflight)
  assert.match(apiWorkflow, /TAVILY_API_KEY DASHSCOPE_API_KEY/)
  assert.match(apiWorkflow, /docker compose config --quiet/)
})

test('production deploys cannot overlap', () => {
  for (const workflow of [apiWorkflow, webWorkflow]) {
    assert.match(workflow, /cancel-in-progress: false/)
  }
})

test('API image generates Prisma Client before compiling the database package', () => {
  const dockerfile = readFileSync(resolve(repositoryRoot, 'apps/api/Dockerfile'), 'utf8')
  const generate = dockerfile.indexOf('npm run generate --workspace=@lead-trace/db')
  const build = dockerfile.indexOf('npm run build --workspace=@lead-trace/db')
  assert.ok(generate > 0 && build > generate)
  assert.match(dockerfile, /ENTRYPOINT \["apps\/api\/docker-entrypoint\.sh"\]/)
  assert.match(dockerfile, /CMD \["serve"\]/)
})

test('Cloudflare release validates an OpenNext artifact before deploy', () => {
  assert.match(webWorkflow, /npm run cf:build --workspace=@lead-trace\/web/)
  assert.match(webWorkflow, /npx wrangler deploy --dry-run/)
  assert.match(webWorkflow, /NEXT_PUBLIC_API_URL must be a non-empty HTTPS URL/)
})

test('Cloudflare release builds once and deploys the validated artifact unchanged', () => {
  assert.equal((webWorkflow.match(/npm run cf:build --workspace=@lead-trace\/web/g) || []).length, 1)
  assert.match(webWorkflow, /actions\/upload-artifact@v4/)
  assert.match(webWorkflow, /actions\/download-artifact@v5/)
  assert.match(webWorkflow, /path: apps\/web\/\.open-next/)
  assert.match(webWorkflow, /run: npx wrangler deploy\s*$/m)
  assert.doesNotMatch(webWorkflow, /npm run cf:deploy/)
})

test('backend verification prepares the Python worker before quality gates', () => {
  const setupWorker = apiWorkflow.indexOf('npm run worker:setup')
  const lint = apiWorkflow.indexOf('npm run lint')
  const checkTypes = apiWorkflow.indexOf('npm run check-types')

  assert.ok(setupWorker > 0)
  assert.ok(lint > setupWorker)
  assert.ok(checkTypes > setupWorker)
})

test('real-stack browser tests isolate local auth trust and cookie settings', () => {
  assert.match(playwrightConfig, /BETTER_AUTH_TRUSTED_ORIGINS: `http:\/\/127\.0\.0\.1:\$\{webPort\}`/)
  assert.match(playwrightConfig, /BETTER_AUTH_COOKIE_DOMAIN: ''/)
})

test('required verification omits heavyweight browser setup', () => {
  for (const workflow of [apiWorkflow, webWorkflow]) {
    assert.doesNotMatch(workflow, /playwright install/)
    assert.doesNotMatch(workflow, /npx playwright test/)
  }
})

test('real-stack research journey follows the configured API port', () => {
  assert.match(researchJourney, /process\.env\.E2E_API_PORT/)
})
