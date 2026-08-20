import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import {
  DomainExceptionFilter,
  HttpExceptionFilter,
  PrismaExceptionFilter,
  TimeoutInterceptor,
} from './common';
import cookieParser from 'cookie-parser';
import {
  getOrCreateRequestId,
  RESPONSE_REQUEST_ID_HEADER,
} from './common/request-id';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logging
  app.useLogger(app.get(Logger));

  // Graceful shutdown
  app.enableShutdownHooks();

  // Security
  app.use(helmet());

  app.use((req, res, next) => {
    const requestId = getOrCreateRequestId(req);
    res.setHeader(RESPONSE_REQUEST_ID_HEADER, requestId);
    next();
  });

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
  app.useGlobalFilters(
    new PrismaExceptionFilter(),
    new DomainExceptionFilter(),
    new HttpExceptionFilter(),
  );

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
void bootstrap();
