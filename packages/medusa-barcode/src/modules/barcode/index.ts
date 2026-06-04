import BarcodeService from "./service"
import { Module }      from "@medusajs/framework/utils"

export const BARCODE_MODULE = "barcode" as const

export default Module(BARCODE_MODULE, {
  service: BarcodeService,
})

export { default as BarcodeService, type BarcodeServiceType } from "./service"
export * from "./types"
export * from "./constants"
