import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { parseRedisEnv } from '@hockpay/infrastructure';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino Logger
  app.useLogger(app.get(Logger));

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Worker is running on port ${port}`);
  logger.log(`Redis: ${parseRedisEnv(process.env).displayName}`);
}

void bootstrap();
