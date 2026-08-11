import { env } from './config/env';
import { createApp } from './app';

const app = createApp();

app.listen(env.port, () => {
  console.log(`HMS backend listening on port ${env.port} [${env.nodeEnv}]`);
});
