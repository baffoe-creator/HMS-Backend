import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import patientRoutes from './modules/patients/patient.routes';
import appointmentRoutes from './modules/appointments/appointment.routes';
import icdRoutes from './modules/icd/icd.routes';
import clinicalRecordRoutes from './modules/clinicalRecords/clinicalRecord.routes';
import labOrderRoutes from './modules/labOrders/labOrder.routes';
import prescriptionRoutes from './modules/prescriptions/prescription.routes';
import roomBedRoutes from './modules/roomsBeds/roomBed.routes';
import otBookingRoutes from './modules/otBookings/otBooking.routes';
import pharmacyInventoryRoutes from './modules/pharmacyInventory/pharmacyInventory.routes';
import dispenseRoutes from './modules/dispenses/dispense.routes';
import billingRoutes from './modules/billing/billing.routes';
import nhiaRoutes from './modules/nhia/nhia.routes';
import {
  globalLimiter,
  authLimiter,
  requestValidationMiddleware,
} from './middleware/rateLimiter';
import { env } from './config/env';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', env.trustProxyHops);

  app.use(helmet());
  app.use(cors());
  app.use(globalLimiter);
  app.use(requestValidationMiddleware);
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'hms-backend',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/auth', authLimiter, authRoutes);
  app.use('/users', userRoutes);
  app.use('/patients', patientRoutes);
  app.use('/appointments', appointmentRoutes);
  app.use('/icd-codes', icdRoutes);
  app.use('/clinical-records', clinicalRecordRoutes);
  app.use('/lab-orders', labOrderRoutes);
  app.use('/prescriptions', prescriptionRoutes);
  app.use('/rooms-beds', roomBedRoutes);
  app.use('/ot-bookings', otBookingRoutes);
  app.use('/pharmacy-inventory', pharmacyInventoryRoutes);
  app.use('/dispenses', dispenseRoutes);
  app.use('/bills', billingRoutes);
  app.use('/nhia', nhiaRoutes);

  return app;
}