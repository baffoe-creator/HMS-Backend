import 'express-async-errors';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/middleware/errorHandler';

describe('errorHandler', () => {
  it('turns a rejected async handler into a JSON 500 instead of crashing', async () => {
    const app = express();
    app.get('/boom', async () => {
      throw new Error('boom');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});