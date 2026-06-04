import QrService from './services/qr-service.js';
import { Module } from '@medusajs/framework/utils';

export const QR_MODULE = 'Qr';

export default Module(QR_MODULE, {
  service: QrService,
});

export { type CreateQrInput, type QrServiceType, type QrService } from './services/qr-service.js';
