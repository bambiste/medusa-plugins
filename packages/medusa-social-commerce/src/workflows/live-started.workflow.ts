import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { SOCIAL_COMMERCE_MODULE } from '../modules/social-commerce/index'
import type { ISocialCommerceService } from '../modules/social-commerce/services/social-commerce.service'
import type { TikTokLiveSession, LiveMetrics } from '../modules/social-commerce/types/index'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LiveStartedInput = {
  accountId:         string
  externalSessionId: string
}

// ─── Step 1: fetch-live-session-step ──────────────────────────────────────────

type FetchLiveSessionOutput = {
  account: any
  session: TikTokLiveSession
  metrics: LiveMetrics
}

const fetchLiveSessionStep = createStep<
  LiveStartedInput,
  FetchLiveSessionOutput,
  never
>(
  'fetch-live-session-step',
  async (input, { container }) => {
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const accounts = await svc.listSocialAccounts({ id: input.accountId })
    if (!accounts.length) {
      throw new Error(`Social account not found: ${input.accountId}`)
    }
    const account = accounts[0]

    const accessToken = svc.decryptToken(account.encrypted_access_token)

    const [session, metrics] = await Promise.all([
      svc.tiktokApi.getLiveSession(accessToken, input.externalSessionId),
      svc.tiktokApi.getLiveMetrics(accessToken, input.externalSessionId),
    ])

    return new StepResponse({ account, session, metrics })
  },
)

// ─── Step 2: upsert-live-session-step ─────────────────────────────────────────

type UpsertLiveSessionInput = {
  accountId: string
  session:   TikTokLiveSession
  metrics:   LiveMetrics
}

type UpsertLiveSessionOutput = {
  liveSession: any
}

const upsertLiveSessionStep = createStep<
  UpsertLiveSessionInput,
  UpsertLiveSessionOutput,
  never
>(
  'upsert-live-session-step',
  async (input, { container }) => {
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)
    const { accountId, session, metrics } = input

    const liveSession = await svc.upsertLiveSession(accountId, {
      external_id:  session.room_id,
      title:        session.title ?? null,
      status:       'live',
      started_at:   session.start_time ? new Date(session.start_time * 1000) : new Date(),
      viewer_count: metrics.viewer_count,
      metrics: {
        like_count:    session.like_count,
        total_viewers: metrics.total_viewers,
      },
    })

    return new StepResponse({ liveSession })
  },
)

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const liveStartedWorkflow = createWorkflow(
  'live-started',
  (input: LiveStartedInput) => {
    const { account, session, metrics } = fetchLiveSessionStep(input)

    const { liveSession } = upsertLiveSessionStep({
      accountId: input.accountId,
      session,
      metrics,
    })

    return new WorkflowResponse({ liveSession })
  },
)
