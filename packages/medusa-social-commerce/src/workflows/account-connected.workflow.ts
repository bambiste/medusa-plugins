import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { SOCIAL_COMMERCE_MODULE } from '../modules/social-commerce/index'
import type { ISocialCommerceService } from '../modules/social-commerce/services/social-commerce.service'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AccountConnectedInput = {
  accountId: string
}

const REQUIRED_SCOPES = ['user.info.basic', 'video.list']

// ─── Step 1: validate-social-account-step ─────────────────────────────────────

type ValidateOutput = {
  account: any
  permissions: string[]
}

const validateSocialAccountStep = createStep<
  AccountConnectedInput,
  ValidateOutput,
  never
>(
  'validate-social-account-step',
  async (input, { container }) => {
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const accounts = await svc.listSocialAccounts({ id: input.accountId })
    if (!accounts.length) {
      throw new Error(`Social account not found: ${input.accountId}`)
    }
    const account = accounts[0]

    // Scopes are stored on the account from the OAuth token exchange response, 
    // no need to call TikTok's token info endpoint (which doesn't exist in v2).
    const grantedScopes = (account.token_scope ?? '').split(/[\s,]+/).filter(Boolean)
    const missing = REQUIRED_SCOPES.filter(s => !grantedScopes.includes(s))
    if (missing.length) {
      throw new Error(
        `TikTok account is missing required scopes: ${missing.join(', ')}. Granted: ${grantedScopes.join(', ')}`,
      )
    }

    return new StepResponse({ account, permissions: grantedScopes })
  },
)

// ─── Step 2: sync-tiktok-profile-step ─────────────────────────────────────────

type SyncProfileInput = {
  account: any
}

type SyncProfileOutput = {
  updated: any
}

type SyncProfileCompensation = {
  accountId: string
  prevMetadata: Record<string, unknown>
}

const syncTiktokProfileStep = createStep<
  SyncProfileInput,
  SyncProfileOutput,
  SyncProfileCompensation
>(
  'sync-tiktok-profile-step',
  async (input, { container }) => {
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)
    const { account } = input

    const accessToken = svc.decryptToken(account.encrypted_access_token)
    const profile = await svc.tiktokApi.getProfile(accessToken)

    const prevMetadata = (account.metadata as Record<string, unknown>) ?? {}

    const [updated] = await svc.updateSocialAccounts([{
      id: account.id,
      follower_count: profile.follower_count,
      avatar_url:     profile.avatar_url,
      username:       profile.display_name,
      metadata: {
        ...prevMetadata,
        follower_count: profile.follower_count,
        avatar_url:     profile.avatar_url,
        display_name:   profile.display_name,
      },
    }])

    return new StepResponse(
      { updated },
      { accountId: account.id, prevMetadata },
    )
  },
  async (compensate, { container }) => {
    if (!compensate) return
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)
    await svc.updateSocialAccounts([{
      id:       compensate.accountId,
      metadata: compensate.prevMetadata,
    }])
  },
)

// ─── Step 3: initial-video-sync-step ──────────────────────────────────────────

type InitialVideoSyncInput = {
  accountId: string
}

type InitialVideoSyncOutput = {
  synced: import('../modules/social-commerce/types/index').SyncVideosResult
}

const initialVideoSyncStep = createStep<
  InitialVideoSyncInput,
  InitialVideoSyncOutput,
  never
>(
  'initial-video-sync-step',
  async (input, { container }) => {
    const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)
    const synced = await svc.syncVideos(input.accountId)
    return new StepResponse({ synced })
  },
)

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const accountConnectedWorkflow = createWorkflow(
  'account-connected',
  (input: AccountConnectedInput) => {
    const { account, permissions } = validateSocialAccountStep(input)

    const { updated } = syncTiktokProfileStep({ account })

    const { synced } = initialVideoSyncStep({ accountId: input.accountId })

    return new WorkflowResponse({ account: updated, permissions, synced })
  },
)
