/** Shared with apps/api/src/e2e/e2e-seed.service.ts for real-stack runs. */
export const e2eFixtures = {
  user: {
    email: 'e2e@lead-trace.test',
    password: 'E2eTestPass1!',
    name: 'E2E Tester',
  },
  workspace: {
    id: 'e2e-workspace-id',
    name: 'E2E Workspace',
    slug: 'e2e-workspace',
    role: 'owner',
  },
  citation: {
    url: 'https://en.wikipedia.org/wiki/Tim_Cook',
    title: 'Tim Cook - Wikipedia',
    publisher: 'Wikipedia',
    sourceType: 'profile',
    signalType: 'leadership',
    claim: 'Timothy Donald Cook is the chief executive officer of Apple Inc.',
  },
  prospect: {
    name: 'Tim Cook',
    companyName: 'Apple',
  },
  offer: {
    name: 'Lead Trace Platform',
    context: 'Evidence-backed deal briefs for every prospect conversation.',
    persona: 'Revenue leaders',
  },
}
