import { Request, Response } from 'express';
import * as otBookingService from './otBooking.service';

export async function createHandler(req: Request, res: Response): Promise<Response> {
  try {
    const booking = await otBookingService.bookOt(req.body ?? {});
    return res.status(201).json(booking);
  } catch (err) {
    if (
      err instanceof otBookingService.ValidationError ||
      err instanceof otBookingService.NotFoundError ||
      err instanceof otBookingService.ConflictError
    ) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
}
