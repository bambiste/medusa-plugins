import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { STORIES_MODULE } from "../../../../modules/story"
import type { IStoryService } from "../../../../modules/story"

// GET /admin/stories/:id
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<IStoryService>(STORIES_MODULE)
    const [story] = await svc.listStories({ id: req.params.id })
    if (!story) return res.status(404).json({ message: 'Story not found' })
    res.json({ story })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed to fetch story' })
  }
}

// PUT /admin/stories/:id
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<IStoryService>(STORIES_MODULE)
    const body = req.body as any

    const updateData: Record<string, any> = { id: req.params.id }
    if (body.title         !== undefined) updateData.title         = body.title
    if (body.media_type    !== undefined) updateData.media_type    = body.media_type
    if (body.media_url     !== undefined) updateData.media_url     = body.media_url
    if (body.thumbnail_url !== undefined) updateData.thumbnail_url = body.thumbnail_url
    if (body.link_url      !== undefined) updateData.link_url      = body.link_url
    if (body.link_text     !== undefined) updateData.link_text     = body.link_text
    if (body.is_active     !== undefined) updateData.is_active     = body.is_active
    if (body.display_order !== undefined) updateData.display_order = Number(body.display_order)
    if (body.expires_at    !== undefined) {
      updateData.expires_at = body.expires_at ? new Date(body.expires_at) : null
    }

    const story = await svc.updateStories(updateData)
    res.json({ story })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed to update story' })
  }
}

// DELETE /admin/stories/:id
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<IStoryService>(STORIES_MODULE)
    await svc.deleteStories(req.params.id)
    res.json({ id: req.params.id, deleted: true })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed to delete story' })
  }
}
