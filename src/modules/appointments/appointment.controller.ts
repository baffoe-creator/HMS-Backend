import { Request, Response } from 'express';
import * as appointmentService from './appointment.service';

function handleError(err: unknown, res: Response): Response {
  if (err instanceof appointmentService.ValidationError || err instanceof appointmentService.ConflictError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  throw err;
}

export async function bookHandler(req: Request, res: Response): Promise<Response> {
  try {
    const appointment = await appointmentService.bookAppointment(req.body ?? {});
    return res.status(201).json(appointment);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function availabilityHandler(req: Request, res: Response): Promise<Response> {
  try {
    const doctorId = parseInt(String(req.query.doctorId), 10);
    const date = String(req.query.date ?? '');
    const slots = await appointmentService.getAvailability(doctorId, date);
    return res.status(200).json({ doctorId, date, availableSlots: slots });
  } catch (err) {
    return handleError(err, res);
  }
}
