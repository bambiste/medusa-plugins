import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk'
import { QR_MODULE, type CreateQrInput } from '../modules/qr'
import type { QrService } from '../modules/qr/services/qr-service'
import type { CodePayloadOptions } from '../utils/generate-code'

interface GenerateQrInput {
  input:   CreateQrInput
  upload:  any
  options?: CodePayloadOptions
}

const createQrStep = createStep(
  'generate-qr-step',
  async ({ input, upload, options }: GenerateQrInput, { container }) => {
    const qrService = container.resolve<QrService>(QR_MODULE)
    const qr = await qrService.generate(input, { container, upload, ...options })
    return new StepResponse(qr, qr?.id)
  },
  // Compensation: nothing to roll back (uploads are handled by their own step)
  async (_qrId, _ctx) => {}
)

export const generateQRWorkflow = createWorkflow(
  'generate-qr',
  (data: GenerateQrInput) => {
    const qr = createQrStep(data)
    return new WorkflowResponse(qr)
  }
)
