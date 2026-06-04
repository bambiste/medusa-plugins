import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORIES_MODULE } from "../../../modules/story"
import type { IStoryService } from "../../../modules/story"

// GET /admin/stories
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<IStoryService>(STORIES_MODULE)
    const all = await svc.listStories({})
    const stories = all.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
    res.json({ stories })
  } catch (err: any) {
    console.log('stories error', err)
    res.status(500).json({ message: err?.message ?? 'Failed to list stories' })
  }
}

// POST /admin/stories
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<IStoryService>(STORIES_MODULE)
    const body = req.body as any
    const story = await svc.createStories({
      title:         body.title,
      media_type:    body.media_type ?? 'image',
      media_url:     body.media_url,
      thumbnail_url: body.thumbnail_url ?? null,
      link_url:      body.link_url ?? null,
      link_text:     body.link_text ?? null,
      is_active:     body.is_active ?? true,
      display_order: body.display_order ?? 0,
      expires_at:    body.expires_at ? new Date(body.expires_at) : null,
    })
    res.status(201).json({ story })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed to create story' })
  }
}
