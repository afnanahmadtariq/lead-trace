const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { validateEnvironment } = require('../dist/config/env.validation.js')
const { renderAuthEmail } = require('../dist/auth/auth-email.template.js')
const { renderLaunchEmail } = require('../dist/launch/launch-email.template.js')

const repositoryRoot = resolve(__dirname, '../../..')

test('development auth uses safe local defaults', () => {
  const environment = validateEnvironment({ NODE_ENV: 'development' })
  assert.equal(environment.BETTER_AUTH_URL, 'http://localhost:3001')
  assert.equal(environment.WEB_ORIGIN, 'http://localhost:3000')
})

test('production auth requires strong secrets and transactional email', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production' }),
    /BETTER_AUTH_SECRET/,
  )
  assert.throws(
    () => validateEnvironment({
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'a-secure-production-secret-with-more-than-32-characters',
    }),
    /RESEND_API_KEY/,
  )
})

test('Google credentials must be configured as a pair', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'development', GOOGLE_CLIENT_ID: 'client-id' }),
    /configured together/,
  )
})

test('Better Auth account identity matches the 1.7 database contract', () => {
  const authSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/auth.ts'), 'utf8')
  const e2eSeedSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/e2e/e2e-seed.service.ts'), 'utf8')
  const prismaSchema = readFileSync(resolve(repositoryRoot, 'packages/db/prisma/schema.prisma'), 'utf8')

  assert.match(authSource, /identityStrategy: 'provider-id'/)
  assert.match(prismaSchema, /model Account \{[\s\S]*?issuer\s+String/)
  assert.match(prismaSchema, /@@unique\(\[issuer, accountId\]\)/)
  assert.doesNotMatch(prismaSchema, /@@unique\(\[providerId, accountId\]\)/)
  assert.match(e2eSeedSource, /issuer: createLocalAccountIssuer\('credential'\)/)
  assert.match(e2eSeedSource, /accountId: userId/)
})

test('profile email changes require a confirmation flow', () => {
  const authSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/auth.ts'), 'utf8')

  assert.match(authSource, /changeEmail:\s*\{\s*enabled:\s*true/)
  assert.match(authSource, /updateEmailWithoutVerification:\s*false/)
  assert.match(authSource, /sendChangeEmailConfirmation/)
  assert.match(authSource, /kind:\s*'email-change'/)
  const profileSource = readFileSync(resolve(repositoryRoot, 'apps/web/components/profile-details.tsx'), 'utf8')
  assert.match(profileSource, /setEmail\(user\.email\)/)
  assert.match(profileSource, /Your sign-in email remains/)
})

test('account deletion requires email confirmation and preserves shared workspace ownership', () => {
  const authSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/auth.ts'), 'utf8')
  const policySource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/account-deletion.policy.ts'), 'utf8')
  const settingsSource = readFileSync(resolve(repositoryRoot, 'apps/web/components/security-settings.tsx'), 'utf8')

  assert.match(authSource, /deleteUser:\s*\{\s*enabled:\s*true/)
  assert.match(authSource, /sendDeleteAccountVerification/)
  assert.match(authSource, /beforeDelete/)
  assert.match(authSource, /tx\.organization\.deleteMany/)
  assert.match(authSource, /successorPromotions/)
  assert.match(authSource, /sharedWorkspaceSuccessors/)
  assert.match(authSource, /tx\.invitation\.updateMany/)
  assert.match(authSource, /role: 'admin'/)
  assert.match(policySource, /successorPromotions/)
  assert.match(policySource, /soleWorkspaceIds/)
  assert.match(settingsSource, /authClient\.deleteUser/)
  assert.match(settingsSource, /Type ' \+ user\.email \+ ' to confirm/)
})

test('social sign-in must confirm two-factor changes with a short-lived email code', () => {
  const authSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/auth.ts'), 'utf8')
  const contextSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/account-context.service.ts'), 'utf8')
  const controllerSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/account-context.controller.ts'), 'utf8')
  const settingsSource = readFileSync(resolve(repositoryRoot, 'apps/web/components/security-settings.tsx'), 'utf8')

  assert.match(authSource, /security-change-approved:/)
  assert.match(authSource, /SECURITY_CONFIRMATION_REQUIRED/)
  assert.match(authSource, /two-factor\/enable/)
  assert.match(authSource, /two-factor\/disable/)
  assert.match(contextSource, /securityConfirmationLifetimeMs = 10 \* 60 \* 1000/)
  assert.match(contextSource, /HttpStatus\.TOO_MANY_REQUESTS/)
  assert.match(contextSource, /timingSafeEqual/)
  assert.match(contextSource, /kind:\s*'security-change'/)
  assert.match(controllerSource, /@Post\('security-confirmations'\)/)
  assert.match(controllerSource, /@Post\('security-confirmations\/verify'\)/)
  assert.match(readFileSync(resolve(repositoryRoot, 'apps/web/lib/use-resend-cooldown.ts'), 'utf8'), /RESEND_COOLDOWN_MS = 60_000/)
  assert.match(settingsSource, /Resend available in \{/)
})

test('email resend endpoints enforce a sixty-second rate limit without sending on page load', () => {
  const authSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/auth.ts'), 'utf8')
  const challengeSource = readFileSync(resolve(repositoryRoot, 'apps/web/components/two-factor-challenge.tsx'), 'utf8')
  const cooldownSource = readFileSync(resolve(repositoryRoot, 'apps/web/lib/use-resend-cooldown.ts'), 'utf8')

  assert.match(authSource, /'\/send-verification-email': \{ window: 60, max: 1 \}/)
  assert.match(authSource, /'\/two-factor\/send-otp': \{ window: 60, max: 1 \}/)
  assert.doesNotMatch(challengeSource, /useEffect/)
  assert.doesNotMatch(challengeSource, /initialSendStarted/)
  assert.match(challengeSource, /methods\.length > 1/)
  assert.match(challengeSource, /Resend available in/)
  assert.match(challengeSource, /'Send email code'/)
  assert.match(cooldownSource, /window\.localStorage\.setItem/)
})

test('workspace deletion controls require admin confirmation and a transaction for a full wipe', () => {
  const contextSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/workspace-settings.service.ts'), 'utf8')
  const controllerSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/workspace-settings.controller.ts'), 'utf8')

  assert.match(contextSource, /private async assertAdmin/)
  assert.match(contextSource, /role === 'owner' \|\| role === 'admin'/)
  assert.match(contextSource, /confirmation !== 'DELETE BRIEFS'/)
  assert.match(contextSource, /db\.\$transaction/)
  assert.match(contextSource, /confirmation !== membership\.organization\.name/)
  assert.match(controllerSource, /@Delete\('briefs'\)/)
  assert.match(controllerSource, /@Delete\('research-data'\)/)
  assert.match(controllerSource, /@Delete\(\)/)
})

test('workspace invitations send users through a real acceptance flow', () => {
  const authSource = readFileSync(resolve(repositoryRoot, 'apps/api/src/auth/auth.ts'), 'utf8')
  const invitationPage = readFileSync(resolve(repositoryRoot, 'apps/web/components/invitation-acceptance.tsx'), 'utf8')

  assert.match(authSource, /sendInvitationEmail/)
  assert.match(authSource, /kind: 'workspace-invitation'/)
  assert.match(authSource, /new URL\('\/invitation'/)
  assert.match(invitationPage, /acceptInvitation/)
})

test('Tavily discovery settings are bounded and have useful defaults', () => {
  const environment = validateEnvironment({ NODE_ENV: 'development' })
  assert.equal(environment.TAVILY_SEARCH_DEPTH, 'advanced')
  assert.equal(environment.TAVILY_MAX_RESULTS, 6)
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'development', TAVILY_MAX_RESULTS: '21' }),
    /between 1 and 20/,
  )
})

test('authentication email is branded and escapes untrusted content', () => {
  const message = renderAuthEmail({
    kind: 'verification',
    title: 'Verify <Lead Trace>',
    message: 'Hello <script>alert(1)</script>',
    actionUrl: 'http://localhost:3000/auth/continue?next=<unsafe>',
  })

  assert.match(message.subject, /^\[Lead Trace\]/)
  assert.doesNotMatch(message.html, /<script>/)
  assert.match(message.html, /&lt;script&gt;/)
  assert.match(message.text, /http:\/\/localhost:3000/)

  const launch = renderLaunchEmail({ name: '<Alex>', actionUrl: 'https://lead-trace.example/sign-up?from=<launch>' })
  assert.match(launch.subject, /Lead Trace is live/)
  assert.doesNotMatch(launch.html, /<Alex>/)
  assert.match(launch.html, /&lt;Alex&gt;/)
})
