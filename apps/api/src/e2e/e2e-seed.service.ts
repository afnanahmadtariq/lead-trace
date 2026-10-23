import { Injectable, NotFoundException } from '@nestjs/common'
import { createLocalAccountIssuer } from '@better-auth/core/db'
import { db } from '@lead-trace/db'
import { hashPassword } from 'better-auth/crypto'
import { randomBytes } from 'node:crypto'

const E2E_EMAIL = 'e2e@lead-trace.test'
const E2E_PASSWORD = 'E2eTestPass1!'
const SOURCE_URL = 'https://en.wikipedia.org/wiki/Tim_Cook'

function createId() {
  return randomBytes(12).toString('hex')
}

@Injectable()
export class E2eSeedService {
  async seed() {
    await db.user.deleteMany({ where: { email: E2E_EMAIL } })

    const userId = createId()
    const organizationId = createId()
    const memberId = createId()
    const accountId = createId()
    const now = new Date()
    const passwordHash = await hashPassword(E2E_PASSWORD)

    const prospect = {
      name: 'Tim Cook',
      email: null as string | null,
      companyName: 'Apple',
      companyDomain: 'apple.com',
      linkedinUrl: null as string | null,
      xHandle: null as string | null,
    }
    const offer = {
      name: 'Lead Trace Platform',
      valueProposition: 'Evidence-backed deal briefs for every prospect conversation.',
      targetPersona: 'Revenue leaders',
    }

    const result = await db.$transaction(async (transaction) => {
      await transaction.user.create({
        data: {
          id: userId,
          name: 'E2E Tester',
          email: E2E_EMAIL,
          emailVerified: true,
          twoFactorEnabled: false,
        },
      })
      await transaction.account.create({
        data: {
          id: accountId,
          issuer: createLocalAccountIssuer('credential'),
          accountId: userId,
          providerId: 'credential',
          userId,
          password: passwordHash,
        },
      })
      await transaction.organization.create({
        data: {
          id: organizationId,
          name: 'E2E Workspace',
          slug: `e2e-${createId()}`,
          createdAt: now,
        },
      })
      await transaction.member.create({
        data: {
          id: memberId,
          organizationId,
          userId,
          role: 'owner',
          createdAt: now,
        },
      })
      const createdProspect = await transaction.prospect.create({
        data: { organizationId, createdById: userId, ...prospect },
      })
      const createdOffer = await transaction.offer.create({
        data: { organizationId, createdById: userId, ...offer },
      })
      const run = await transaction.researchRun.create({
        data: {
          organizationId,
          createdById: userId,
          prospectId: createdProspect.id,
          offerId: createdOffer.id,
          goal: 'meeting',
          status: 'completed',
          requestedAt: now,
          startedAt: now,
          completedAt: now,
          inputSnapshot: { prospect, offer, goal: 'meeting' },
        },
      })
      const source = await transaction.evidenceSource.create({
        data: {
          organizationId,
          researchRunId: run.id,
          url: SOURCE_URL,
          title: 'Tim Cook - Wikipedia',
          publisher: 'Wikipedia',
          sourceType: 'profile',
          excerpt: 'Timothy Donald Cook is the chief executive officer of Apple Inc.',
        },
      })
      const evidence = await transaction.evidence.create({
        data: {
          organizationId,
          researchRunId: run.id,
          sourceId: source.id,
          claim: 'Timothy Donald Cook is the chief executive officer of Apple Inc.',
          signalType: 'leadership',
          confidence: 0.92,
        },
      })
      const brief = await transaction.dealBrief.create({
        data: {
          organizationId,
          researchRunId: run.id,
          title: 'Deal brief · Tim Cook',
          status: 'ready',
          sections: {
            summary: 'Tim Cook leads Apple as chief executive. Use that verified leadership context to test which strategic operating priorities matter most before positioning Lead Trace.',
            key_signals: [{ evidence_id: evidence.id, claim: evidence.claim, source_url: SOURCE_URL, signal_type: 'leadership' }],
            personalized_opener: 'Tim, I saw the latest leadership context around Apple. Which operating priority is getting the most attention from your team right now?',
            talking_points: [
              'Lead with the verified leadership signal instead of a generic company compliment.',
              'Connect the conversation to evidence-backed preparation only after confirming the priority.',
            ],
            questions_to_ask: [
              'Which operating priority is most important for Apple this quarter?',
              'Where does your team lose the most time preparing for high-value conversations?',
            ],
            objection_handling: [
              'If the current process works: ask where research quality or consistency still varies across the team.',
              'If timing is tight: offer a 15-minute review tied to one live account.',
            ],
            next_steps: ['Choose one active account and compare the current preparation workflow with an evidence-backed brief.'],
            gaps: ['Only one verified public signal is included in this seeded example. Validate priorities in the conversation.'],
          },
        },
      })
      await transaction.notification.create({
        data: {
          organizationId,
          userId,
          researchRunId: run.id,
          type: 'brief-ready',
          title: 'Brief ready for Tim Cook',
          body: '1 cited claim(s) are ready to review.',
        },
      })

      const leadSearch = await transaction.leadSearch.create({ data: {
        organizationId, createdById: userId, title: 'Seeded SaaS buyers', industry: 'SaaS', role: 'Head of Sales', location: 'London', status: 'completed', attemptCount: 1, startedAt: now, completedAt: now,
      } })
      const leadSource = await transaction.leadSource.create({ data: {
        organizationId, searchId: leadSearch.id, url: 'https://northstar.example.com/team', title: 'Northstar leadership', publisher: 'northstar.example.com', excerpt: 'Maya Chen is Head of Sales at Northstar, a SaaS company in London.', queries: ['Head of Sales SaaS London'],
      } })
      const lead = await transaction.leadCandidate.create({ data: {
        organizationId, searchId: leadSearch.id, sourceId: leadSource.id, identityKey: 'seeded-maya-northstar', name: 'Maya Chen', companyName: 'Northstar', jobTitle: 'Head of Sales', quote: leadSource.excerpt, matchedCriteria: ['industry', 'role', 'location'], missingCriteria: [],
        qualification: { version: 2, checkedAt: now.toISOString(), issues: [], evidence: Object.fromEntries(['industry', 'role', 'location'].map((key) => [key, { sourceId: leadSource.id, quote: leadSource.excerpt }])) },
      } })

      return {
        email: E2E_EMAIL,
        password: E2E_PASSWORD,
        leadSearchId: leadSearch.id,
        leadCandidateId: lead.id,
        runId: run.id,
        briefId: brief.id,
        prospectName: prospect.name,
        citationUrl: SOURCE_URL,
      }
    })

    return result
  }

  assertEnabled() {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException()
    if (process.env.E2E_ENABLED !== 'true') throw new NotFoundException()
    const secret = process.env.E2E_SEED_SECRET?.trim()
    if (!secret || secret.length < 16) throw new NotFoundException()
    return secret
  }
}
