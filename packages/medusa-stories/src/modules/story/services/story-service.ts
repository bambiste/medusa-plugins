import { MedusaService } from "@medusajs/framework/utils"
import { Story } from "../models/story"

class StoriesService extends MedusaService({ Story }) {
  constructor() {
    super(...arguments)
  }

  async listActive() {
    const now = new Date()
    const all = await this.listStories({ is_active: true })
    return all
      .filter((s: any) => !s.expires_at || new Date(s.expires_at) > now)
      .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
  }
}

export type StoryServiceType = typeof StoriesService
export type IStoryService = InstanceType<typeof StoriesService>
export default StoriesService
