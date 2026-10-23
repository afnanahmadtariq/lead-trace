import { prismaAdapter } from '@better-auth/prisma-adapter'
import { db } from '@lead-trace/db'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api'
import { organization, twoFactor } from 'better-auth/plugins'
import { getAccountDeletionPolicy } from './account-deletion.policy'
import { sendAuthEmail } from './auth-email'

const isProduction = process.env.NODE_ENV === 'production'
const baseURL = process.env.BETTER_AUTH_URL?.trim() || 'http://localhost:3001'
const webOrigin = process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000'
const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || webOrigin)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
const cookieDomain = process.env.BETTER_AUTH_COOKIE_DOMAIN?.trim()

export const auth = betterAuth({
  appName: 'Lead Trace',
  baseURL,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET?.trim() || 'lead-trace-development-secret-change-before-production',
  database: prismaAdapter(db, {
    provider: 'postgresql',
    transaction: true,
  }),
  rateLimit: {
    enabled: true,
    customRules: {
      '/send-verification-email': { window: 60, max: 1 },
      '/two-factor/send-otp': { window: 60, max: 1 },
    },
  },
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => sendAuthEmail({
      to: user.email,
      kind: 'password-reset',
      title: 'Reset your Lead Trace password',
      message: 'Use the secure link below to choose a new password. The link expires in one hour.',
      actionUrl: url,
      actionLabel: 'Reset password',
    }),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => sendAuthEmail({
      to: user.email,
      kind: 'verification',
      title: 'Verify your email',
      message: 'Confirm this email address to secure your Lead Trace workspace.',
      actionUrl: url,
      actionLabel: 'Verify email',
    }),
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => sendAuthEmail({
        to: user.email,
        kind: 'email-change',
        title: 'Confirm your email change',
        message: `Confirm the request to change your Lead Trace sign-in email to ${newEmail}.`,
        actionUrl: url,
        actionLabel: 'Confirm email change',
      }),
    },
    deleteUser: {
      enabled: true,
      deleteTokenExpiresIn: 60 * 60,
      sendDeleteAccountVerification: async ({ user, url }) => sendAuthEmail({
        to: user.email,
        kind: 'account-deletion',
        title: 'Confirm account deletion',
        message: 'Confirm this request to permanently delete your Lead Trace account. This link expires in one hour.',
        actionUrl: url,
        actionLabel: 'Delete account',
      }),
      beforeDelete: async (user) => {
        const policy = await getAccountDeletionPolicy(user.id)
        await db.$transaction(async (tx) => {
          for (const successor of policy.sharedWorkspaceSuccessors) {
            await tx.invitation.updateMany({
              where: { organizationId: successor.organizationId, inviterId: user.id },
              data: { inviterId: successor.userId },
            })
          }
          for (const successor of policy.successorPromotions) {
            await tx.member.update({ where: { id: successor.memberId }, data: { role: successor.role } })
          }
          if (policy.soleWorkspaceIds.length) {
            await tx.organization.deleteMany({ where: { id: { in: policy.soleWorkspaceIds } } })
          }
        })
      },
    },
  },
  account: {
    identityStrategy: 'provider-id',
    accountLinking: { enabled: true },
  },
  socialProviders: googleClientId && googleClientSecret ? {
    google: { clientId: googleClientId, clientSecret: googleClientSecret },
  } : {},
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    additionalFields: {
      mfaVerifiedAt: { type: 'date', required: false, input: false },
    },
  },
  advanced: {
    database: { joins: true },
    cookiePrefix: 'lead-trace',
    useSecureCookies: isProduction,
    ...(cookieDomain ? {
      crossSubDomainCookies: { enabled: true, domain: cookieDomain },
    } : {}),
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      const action = context.path === '/two-factor/enable'
        ? 'enable-two-factor'
        : context.path === '/two-factor/disable'
          ? 'disable-two-factor'
          : null
      if (!action) return

      const session = await getSessionFromCtx(context, { disableCookieCache: true })
      if (!session) return
      const passwordAccount = await db.account.findFirst({
        where: { userId: session.user.id, providerId: 'credential', password: { not: null } },
        select: { id: true },
      })
      if (passwordAccount) return

      const identifier = `security-change-approved:${session.session.id}:${action}`
      const authorization = await db.verification.findFirst({
        where: { identifier, value: session.user.id, expiresAt: { gt: new Date() } },
        select: { id: true },
      })
      if (!authorization) {
        throw new APIError('FORBIDDEN', {
          message: 'Confirm this two-factor change with the security code sent to your email',
          code: 'SECURITY_CONFIRMATION_REQUIRED',
        })
      }
      await db.verification.delete({ where: { id: authorization.id } })
    }),
    after: createAuthMiddleware(async (context) => {
      if (!['/two-factor/verify-totp', '/two-factor/verify-otp', '/two-factor/verify-backup-code'].includes(context.path)) return
      const session = context.context.newSession?.session ?? context.context.session?.session
      if (session?.id) {
        await db.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } })
      }
    }),
  },
  plugins: [
    twoFactor({
      issuer: 'Lead Trace',
      allowPasswordless: true,
      otpOptions: {
        period: 5,
        digits: 6,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        sendOTP: async ({ user, otp }) => sendAuthEmail({
          to: user.email,
          kind: 'two-factor',
          title: 'Your Lead Trace security code',
          message: 'Enter this code to complete sign-in. It expires in five minutes.',
          code: otp,
        }),
      },
      accountLockout: { enabled: true, maxFailedAttempts: 8, durationSeconds: 15 * 60 },
    }),
    organization({
      allowUserToCreateOrganization: true,
      membershipLimit: 50,
      invitationLimit: 100,
      creatorRole: 'owner',
      disableOrganizationDeletion: true,
      requireEmailVerificationOnInvitation: true,
      sendInvitationEmail: async ({ id, email, organization: invitedOrganization, inviter }) => {
        const invitationUrl = new URL('/invitation', webOrigin)
        invitationUrl.searchParams.set('id', id)
        await sendAuthEmail({
          to: email,
          kind: 'workspace-invitation',
          title: `Join ${invitedOrganization.name} on Lead Trace`,
          message: `${inviter.user.name} invited you to collaborate in the ${invitedOrganization.name} workspace.`,
          actionUrl: invitationUrl.toString(),
          actionLabel: 'Review invitation',
        })
      },
    }),
  ],
})

export type LeadTraceAuthSession = typeof auth.$Infer.Session
