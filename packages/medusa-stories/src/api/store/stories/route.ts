import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORIES_MODULE } from "../../../modules/story"
import type { IStoryService } from "../../../modules/story"

// GET /store/stories
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<IStoryService>(STORIES_MODULE)
    const stories = await svc.listActive()
    res.json({ stories })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed to fetch stories' })
  }
}
