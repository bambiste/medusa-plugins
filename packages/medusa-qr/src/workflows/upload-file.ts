import { Modules } from '@medusajs/framework/utils';
import { CreateFileDTO } from '@medusajs/framework/types';
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';


export interface File extends CreateFileDTO{
    id?: string
}

export const uploadFilesStep = createStep(
  'upload-files-code',
  async (files: File[], { container }) => {
    const fileModuleService = container.resolve(Modules.FILE);
    // console.log('uploading files', input)
    const uploaded = await fileModuleService.createFiles(files);

    return new StepResponse(uploaded, files.map(a=>a.id!));
  },

  async (filesId, { container }) => {
    if (!filesId) return;

    const fileModuleService = container.resolve(Modules.FILE);
    await fileModuleService.deleteFiles(filesId);
  }
);


export const uploadFiles = createWorkflow(
  'upload-files-code',
  (files: File[]) => {
    const result = uploadFilesStep(files);
    return new WorkflowResponse(result);
  }
);
