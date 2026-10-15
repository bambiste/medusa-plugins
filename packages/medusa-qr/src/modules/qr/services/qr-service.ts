import { MedusaService } from "@medusajs/framework/utils"
import { generateCode, type CodePayloadOptions } from '../../../utils/generate-code'
import { buildFilesUpload, getFileName } from '../../../utils/upload'
import {
  uploadFiles as uploadFilesWorkflow,
  type File,
} from '../../../workflows/upload-file'
import { Qr } from "../models/qr"
import { MedusaContainer } from "@medusajs/types"

export interface CreateQrInput {
  resource_type: string
  resource_id:   string
  action?:       'view' | 'add_to_cart' | 'verify'
}

class QRService extends MedusaService({ Qr }) {
  constructor() {
    super(...arguments)
  }

  // ─── Generate ─────────────────────────────────────────────────────────────

  async generate(
    input: CreateQrInput,
    options: CodePayloadOptions & { container: MedusaContainer; upload: any }
  ) {
    const { container } = options
    let data = await generateCode(input, options)

    const prepared = buildFilesUpload(data) as any as File[]
    if (!prepared.length) {
      // Nothing to upload, save directly with data-URL values
      return await this.createQrs({ ...data })
    }

    const { result: uploaded } = await uploadFilesWorkflow(container).run({
      input: prepared,
    })

    if (uploaded?.length) {
      // Match each uploaded URL back to its field by checking if the URL contains
      // the deterministic filename we submitted (without extension).
      const qrName   = data.qr_code ? getFileName(data.qr_code,  'qr')   : null
      const codeName = data.code128  ? getFileName(data.code128,  'code') : null
      const eanName  = data.ean13    ? getFileName(data.ean13,    'ean')  : null

      for (const image of uploaded) {
        if (qrName   && image.url.includes(qrName))   { data.qr_code = image.url }
        else if (codeName && image.url.includes(codeName)) { data.code128  = image.url }
        else if (eanName  && image.url.includes(eanName))  { data.ean13   = image.url }
      }
    }

    return await this.createQrs({ ...data })
  }

  // ─── Bulk generate ────────────────────────────────────────────────────────

  async bulkGenerate(
    items: CreateQrInput[],
    options: CodePayloadOptions & { container: MedusaContainer; upload: any }
  ) {
    return Promise.all(items.map((item) => this.generate(item, options)))
  }

  // ─── Resolve by scanned code ──────────────────────────────────────────────

  /**
   * Look up a QR record by any of its code values:
   *   - `code` field       → Code128 barcode value / QR URL token
   *   - `ean13_value` field → 13-digit EAN-13 number
   */
  async resolve(scanned: string) {
    // 13 all-digit → try EAN-13 first, then fall back to `code`
    const isEAN13 = /^\d{13}$/.test(scanned)

    let results = await this.listQrs(
      isEAN13 ? { ean13_value: scanned } : { code: scanned }
    )

    // Fallback: if EAN-13 lookup missed, try `code` (edge case)
    if (!results.length && isEAN13) {
      results = await this.listQrs({ code: scanned })
    }

    const qr = results[0]
    if (!qr) throw new Error(`No QR/barcode record found for: ${scanned}`)

    await this.updateQrs({
      id:             qr.id,
      scan_count:     qr.scan_count + 1,
      last_scanned_at: new Date(),
    })

    return qr
  }

  // ─── List by resource ─────────────────────────────────────────────────────

  async listByResource(resource_type: string, resource_id: string) {
    return this.listQrs({ resource_type, resource_id })
  }

  // ─── Execute action ───────────────────────────────────────────────────────

  async execute(qr: any) {
    switch (qr.action) {
      case 'view': {
        const adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:3004').replace(/\/$/, '')
        const url = qr.resource_type === 'variant'
          ? `${adminUrl}/scan/${qr.code}`
          : `/products/${qr.resource_id}`
        return {
          type: 'redirect',
          url,
          resource_type: qr.resource_type,
          resource_id:   qr.resource_id,
        }
      }
      case 'add_to_cart':
        return {
          type:       'cart',
          variant_id: qr.resource_id,
        }
      case 'verify':
        return {
          type:  'verify',
          valid: true,
        }
      default:
        return { type: 'unknown' }
    }
  }
}

export type QrServiceType = typeof QRService
export type QrService = InstanceType<typeof QRService>

export default QRService
