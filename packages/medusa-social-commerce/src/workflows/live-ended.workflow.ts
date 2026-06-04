import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { SOCIAL_COMMERCE_MODULE } from '../modules/social-commerce/index'
import type { ISocialCommerceService } from '../modules/social-commerce/services/social-commerce.service'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LiveEndedInput = {
  accountId:         string
  externalSessionId: string
}

// ─── Step 1: finalize-live-session-step ───────────────────────────────────────

type FinalizeOutput = {
  liveSession: any
}

const finalizeLiveSessionStep = createStep<
  LiveEndedInput,
  FinalizeOutput,
  never
>(
  'finalize-live-session-step',
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

    const liveSession = await svc.upsertLiveSession(input.accountId, {
      external_id:  session.room_id,
      title:        session.title ?? null,
      status:       'ended',
      started_at:   session.start_time ? new Date(session.start_time * 1000) : null,
      ended_at:     new Date(),
      viewer_count: metrics.viewer_count,
      metrics: {
        like_count:    session.like_count,
        total_viewers: metrics.total_viewers,
      },
    })

    return new StepResponse({ liveSession })
  },
)

// ─── Step 2: expire-live-reservations-step ────────────────────────────────────

type ExpireReservationsInput = {
  sessionId: string
}

type ExpireReservationsOutput = {
  expired: number
}

const expireLiveReservationsStep = createStep<
  ExpireReservationsInput,
  ExpireReservationsOutput,
  never
>(
  'expire-live-reservations-step',
  async (input, { container }) => {
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)
    const expired = await svc.expireSessionReservations(input.sessionId)
    return new StepResponse({ expired })
  },
)

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const liveEndedWorkflow = createWorkflow(
  'live-ended',
  (input: LiveEndedInput) => {
    const { liveSession } = finalizeLiveSessionStep(input)

    const { expired } = expireLiveReservationsStep({
      sessionId: liveSession.id,
    })

    return new WorkflowResponse({ liveSession, expired })
  },
)
