import { model } from "@medusajs/framework/utils"

export const Story = model.define("story", {
  id:            model.id().primaryKey(),
  title:         model.text(),
  media_type:    model.enum(["image", "video"]).default("image"),
  media_url:     model.text(),
  thumbnail_url: model.text().nullable(),
  link_url:      model.text().nullable(),
  link_text:     model.text().nullable(),
  is_active:     model.boolean().default(true),
  display_order: model.number().default(0),
  expires_at:    model.dateTime().nullable(),
})

export default Story
