import { Module } from '@medusajs/framework/utils'
import SocialCommerceService from './services/social-commerce.service'

export const SOCIAL_COMMERCE_MODULE = 'SocialCommerce'

export default Module(SOCIAL_COMMERCE_MODULE, {
  service: SocialCommerceService,
})

export type { ISocialCommerceService } from './services/social-commerce.service'
export * from './types/index'
