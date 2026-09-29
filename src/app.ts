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

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Health check - used by Docker, CI, and staging deploy verification
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'hms-backend',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/auth', authRoutes);
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
