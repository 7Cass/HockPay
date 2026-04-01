import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import {
  DomainExceptionFilter,
  HttpExceptionFilter,
  TimeoutInterceptor,
} from './common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logging
  app.useLogger(app.get(Logger));

  // Graceful shutdown
  app.enableShutdownHooks();

  // Security
  app.use(helmet());

  // Cookie parser middleware
  app.use(cookieParser());

  // API versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Exception filters
  app.useGlobalFilters(new DomainExceptionFilter(), new HttpExceptionFilter());

  // Interceptors
  app.useGlobalInterceptors(
    new TimeoutInterceptor(30000), // 30 segundos
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:4200',
      'http://localhost:3333',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
