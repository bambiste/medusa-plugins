import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { SOCIAL_COMMERCE_MODULE } from '../modules/social-commerce/index'
import type { ISocialCommerceService } from '../modules/social-commerce/services/social-commerce.service'
import type { TikTokVideo, VideoMetrics } from '../modules/social-commerce/types/index'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type VideoSyncedInput = {
  accountId:       string
  externalVideoId: string
}

// ─── Step 1: fetch-tiktok-video-step ──────────────────────────────────────────

type FetchVideoOutput = {
  account: any
  video:   TikTokVideo
  metrics: VideoMetrics
}

const fetchTiktokVideoStep = createStep<
  VideoSyncedInput,
  FetchVideoOutput,
  never
>(
  'fetch-tiktok-video-step',
  async (input, { container }) => {
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const accounts = await svc.listSocialAccounts({ id: input.accountId })
    if (!accounts.length) {
      throw new Error(`Social account not found: ${input.accountId}`)
    }
    const account = accounts[0]

    const accessToken = svc.decryptToken(account.encrypted_access_token)

    const [video, metrics] = await Promise.all([
      svc.tiktokApi.getVideo(accessToken, input.externalVideoId),
      svc.tiktokApi.getVideoMetrics(accessToken, input.externalVideoId),
    ])

    return new StepResponse({ account, video, metrics })
  },
)

// ─── Step 2: upsert-synced-video-step ─────────────────────────────────────────

type UpsertVideoInput = {
  accountId: string
  video:     TikTokVideo
  metrics:   VideoMetrics
}

type UpsertVideoOutput = {
  videoRecord: any
}

const upsertSyncedVideoStep = createStep<
  UpsertVideoInput,
  UpsertVideoOutput,
  never
>(
  'upsert-synced-video-step',
  async (input, { container }) => {
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)
    const { accountId, video, metrics } = input

    const existing = await (svc as any).listSocialVideos({
      social_account_id: accountId,
      external_id:       video.id,
    })

    const videoData = {
      social_account_id: accountId,
      external_id:       video.id,
      caption:           video.video_description ?? video.title ?? null,
      thumbnail_url:     video.cover_image_url ?? null,
      video_url:         video.share_url ?? null,
      embed_link:        video.embed_link ?? null,
      cover_image_url:   video.cover_image_url ?? null,
      duration_seconds:  video.duration ?? 0,
      metrics: {
        like_count:    metrics.like_count,
        comment_count: metrics.comment_count,
        share_count:   metrics.share_count,
        view_count:    metrics.view_count,
      },
      status:       'active' as const,
      published_at: video.create_time ? new Date(video.create_time * 1000) : null,
    }

    let videoRecord: any
    if (existing.length) {
      ;[videoRecord] = await (svc as any).updateSocialVideos([{ id: existing[0].id, ...videoData }])
    } else {
      ;[videoRecord] = await (svc as any).createSocialVideos([videoData])
    }

    return new StepResponse({ videoRecord })
  },
)

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const videoSyncedWorkflow = createWorkflow(
  'video-synced',
  (input: VideoSyncedInput) => {
    const { account, video, metrics } = fetchTiktokVideoStep(input)

    const { videoRecord } = upsertSyncedVideoStep({
      accountId: input.accountId,
      video,
      metrics,
    })

    return new WorkflowResponse({ videoRecord })
  },
)
