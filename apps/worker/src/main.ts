import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
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
  logger.log(`Redis: ${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? 6379}`);
}

bootstrap();
