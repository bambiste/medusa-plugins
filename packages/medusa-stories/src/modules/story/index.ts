import StoryService from './services/story-service'
import { Module } from '@medusajs/framework/utils'

export const STORIES_MODULE = 'Story'

export default Module(STORIES_MODULE, {
  service: StoryService,
})

export { type StoryServiceType, type IStoryService } from './services/story-service'
