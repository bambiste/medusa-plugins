import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { SOCIAL_COMMERCE_MODULE } from '../modules/social-commerce/index'
import type { ISocialCommerceService } from '../modules/social-commerce/services/social-commerce.service'

export default async function socialEventsSubscriber({
  event: { name, data },
  container,
}: SubscriberArgs<any>) {
  const svc = container.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

  switch (name) {
    case 'social.account.connected': {
      console.log(`[SocialCommerce] account connected: ${(data as any).accountId}`)
      break
    }

    case 'social.video.synced': {
      const { videoId, accountId } = data as { videoId: string; accountId: string }
      console.log(`[SocialCommerce] video synced: ${videoId} for account ${accountId}`)
      break
    }

    case 'social.live.started': {
      const { sessionId } = data as { sessionId: string }
      console.log(`[SocialCommerce] live started: ${sessionId}`)
      break
    }

    case 'social.live.ended': {
      const { sessionId } = data as { sessionId: string }
      const expired = await svc.expireSessionReservations(sessionId)
      console.log(`[SocialCommerce] live ended: ${sessionId} — expired ${expired} reservation(s)`)
      break
    }

    default:
      break
  }
}

export const config: SubscriberConfig = {
  event: [
    'social.account.connected',
    'social.video.synced',
    'social.live.started',
    'social.live.ended',
  ],
}
