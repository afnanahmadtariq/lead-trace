import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common'
import { db } from '@lead-trace/db'
import type { UserSession } from '@thallesp/nestjs-better-auth'
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { auth } from './auth'
import { getAccountDeletionPolicy } from './account-deletion.policy'
import { sendAuthEmail } from './auth-email'

export type AuthenticatedSession = UserSession<typeof auth>
type SecurityChangeAction = 'enable-two-factor' | 'disable-two-factor'

const securityConfirmationLifetimeMs = 10 * 60 * 1000
const securityAuthorizationLifetimeMs = 5 * 60 * 1000

function securityConfirmationAction(value: string | undefined): SecurityChangeAction {
  if (value === 'enable-two-factor' || value === 'disable-two-factor') return value
  throw new BadRequestException('Choose a valid two-factor security action')
}

function securityConfirmationIdentifier(sessionId: string, action: SecurityChangeAction) {
  return `security-change:${sessionId}:${action}`
}

function securityAuthorizationIdentifier(sessionId: string, action: SecurityChangeAction) {
  return `security-change-approved:${sessionId}:${action}`
}

function hashSecurityConfirmationCode(code: string) {
  return createHmac('sha256', process.env.BETTER_AUTH_SECRET || 'lead-trace-development-secret-change-before-production').update(code).digest('hex')
}

@Injectable()
export class AccountContextService {
  async sendSecurityConfirmation(session: AuthenticatedSession, actionValue?: string) {
    const action = securityConfirmationAction(actionValue)
    const passwordAccount = await db.account.findFirst({
      where: { userId: session.user.id, providerId: 'credential', password: { not: null } },
      select: { id: true },
    })
    if (passwordAccount) throw new BadRequestException('Confirm this change with your current password')

    const identifier = securityConfirmationIdentifier(session.session.id, action)
    const existing = await db.verification.findFirst({ where: { identifier }, orderBy: { createdAt: 'desc' } })
    if (existing && Date.now() - existing.createdAt.getTime() < 60_000) {
      throw new HttpException('Wait one minute before requesting another confirmation code', HttpStatus.TOO_MANY_REQUESTS)
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await db.$transaction(async (tx) => {
      await tx.verification.deleteMany({ where: { identifier } })
      await tx.verification.create({
        data: {
          id: randomUUID(),
          identifier,
          value: hashSecurityConfirmationCode(code),
          expiresAt: new Date(Date.now() + securityConfirmationLifetimeMs),
        },
      })
    })
    await sendAuthEmail({
      to: session.user.email,
      kind: 'security-change',
      title: 'Confirm your two-factor security change',
      message: 'Enter this code to continue changing two-factor authentication. It expires in ten minutes.',
      code,
    })
    return { sent: true, expiresInSeconds: securityConfirmationLifetimeMs / 1000 }
  }

  async verifySecurityConfirmation(session: AuthenticatedSession, actionValue?: string, code?: string) {
    const action = securityConfirmationAction(actionValue)
    const enteredCode = code || ''
    if (!/^\d{6}$/.test(enteredCode)) throw new BadRequestException('Enter the six-digit confirmation code')

    const identifier = securityConfirmationIdentifier(session.session.id, action)
    const confirmation = await db.verification.findFirst({
      where: { identifier, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    const expected = confirmation?.value ? Buffer.from(confirmation.value, 'hex') : null
    const received = Buffer.from(hashSecurityConfirmationCode(enteredCode), 'hex')
    if (!expected || expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new BadRequestException('That confirmation code is not valid')
    }

    const authorizationIdentifier = securityAuthorizationIdentifier(session.session.id, action)
    await db.$transaction(async (tx) => {
      await tx.verification.deleteMany({ where: { identifier } })
      await tx.verification.deleteMany({ where: { identifier: authorizationIdentifier } })
      await tx.verification.create({
        data: {
          id: randomUUID(),
          identifier: authorizationIdentifier,
          value: session.user.id,
          expiresAt: new Date(Date.now() + securityAuthorizationLifetimeMs),
        },
      })
    })
    return { verified: true }
  }

  async getContext(session: AuthenticatedSession) {
    const [memberships, passwordAccount, authenticator, accountDeletion] = await Promise.all([
      db.member.findMany({
        where: { userId: session.user.id },
        include: { organization: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.account.findFirst({
        where: { userId: session.user.id, providerId: 'credential' },
        select: { id: true },
      }),
      db.twoFactor.findFirst({
        where: { userId: session.user.id },
        select: { verified: true },
      }),
      getAccountDeletionPolicy(session.user.id),
    ])
    const workspaces = memberships.map(({ organization, role }) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      role,
    }))
    const activeWorkspace = workspaces.find((workspace) => workspace.id === session.session.activeOrganizationId) ?? null
    const requiresTwoFactorChallenge = Boolean(session.user.twoFactorEnabled && !session.session.mfaVerifiedAt)

    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        twoFactorEnabled: Boolean(session.user.twoFactorEnabled),
        authenticatorAppEnabled: Boolean(authenticator?.verified),
        hasPassword: Boolean(passwordAccount),
      },
      workspaces,
      activeWorkspace,
      accountDeletion: {
        soleWorkspaceNames: accountDeletion.soleWorkspaceNames,
      },
      requirements: {
        requiresOnboarding: !workspaces.length,
        requiresWorkspaceSelection: workspaces.length > 0 && !activeWorkspace,
        requiresTwoFactorChallenge,
      },
      destination: requiresTwoFactorChallenge
        ? '/two-factor'
        : activeWorkspace
          ? '/dashboard'
          : '/onboarding',
    }
  }

  async assertActiveWorkspace(session: AuthenticatedSession) {
    const organizationId = session.session.activeOrganizationId
    if (!organizationId) throw new NotFoundException('Select a workspace before continuing')

    const membership = await db.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: session.user.id } },
      include: { organization: true },
    })
    if (!membership) throw new ForbiddenException('The selected workspace is not available to this identity')
    if (session.user.twoFactorEnabled && !session.session.mfaVerifiedAt) {
      throw new ForbiddenException('Complete two-factor verification before continuing')
    }
    return membership
  }

}
