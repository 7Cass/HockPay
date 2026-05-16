import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {
  CreateStoreUseCase,
  ListStoresUseCase,
  LoginUseCase,
  LogoutUseCase,
  RefreshTokenUseCase,
  SwitchStoreUseCase,
} from '@hockpay/core';
import {
  DomainExceptionFilter,
  HttpExceptionFilter,
  TimeoutInterceptor,
} from '../src/common';
import {
  getOrCreateRequestId,
  RESPONSE_REQUEST_ID_HEADER,
} from '../src/common/request-id';
import { IS_PUBLIC_KEY } from '../src/modules/auth/decorators/public.decorator';
import { AuthController } from '../src/modules/auth/auth.controller';
import { PrismaService } from '../src/infra/database/prisma.service';
import { HealthController } from '../src/modules/health/health.controller';
import { StoreController } from '../src/modules/store/store.controller';

export type ApiE2eMocks = {
  loginUseCase: { execute: jest.Mock };
  refreshTokenUseCase: { execute: jest.Mock };
  logoutUseCase: { execute: jest.Mock };
  switchStoreUseCase: { execute: jest.Mock };
  createStoreUseCase: { execute: jest.Mock };
  listStoresUseCase: { execute: jest.Mock };
};

@Injectable()
class TestJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const accessToken = request.cookies?.hockpay_at;

    if (!accessToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = {
      sub: 'merchant-1',
      storeId: 'store-1',
      iat: 1,
      exp: 9999999999,
    };

    return true;
  }
}

export async function createApiE2eTestApp(): Promise<{
  app: INestApplication;
  mocks: ApiE2eMocks;
}> {
  const mocks: ApiE2eMocks = {
    loginUseCase: { execute: jest.fn() },
    refreshTokenUseCase: { execute: jest.fn() },
    logoutUseCase: { execute: jest.fn() },
    switchStoreUseCase: { execute: jest.fn() },
    createStoreUseCase: { execute: jest.fn() },
    listStoresUseCase: { execute: jest.fn() },
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController, AuthController, StoreController],
    providers: [
      {
        provide: APP_GUARD,
        useClass: TestJwtGuard,
      },
      {
        provide: HealthCheckService,
        useValue: {
          check: jest.fn().mockResolvedValue({ status: 'ok' }),
        },
      },
      {
        provide: MemoryHealthIndicator,
        useValue: {
          checkHeap: jest.fn(),
          checkRSS: jest.fn(),
        },
      },
      {
        provide: PrismaHealthIndicator,
        useValue: {
          pingCheck: jest.fn(),
        },
      },
      {
        provide: PrismaService,
        useValue: {},
      },
      {
        provide: LoginUseCase,
        useValue: mocks.loginUseCase,
      },
      {
        provide: RefreshTokenUseCase,
        useValue: mocks.refreshTokenUseCase,
      },
      {
        provide: LogoutUseCase,
        useValue: mocks.logoutUseCase,
      },
      {
        provide: SwitchStoreUseCase,
        useValue: mocks.switchStoreUseCase,
      },
      {
        provide: CreateStoreUseCase,
        useValue: mocks.createStoreUseCase,
      },
      {
        provide: ListStoresUseCase,
        useValue: mocks.listStoresUseCase,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useLogger(false);
  app.use(helmet());
  app.use((req, res, next) => {
    const requestId = getOrCreateRequestId(req);
    res.setHeader(RESPONSE_REQUEST_ID_HEADER, requestId);
    next();
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(new TimeoutInterceptor(30000));

  await app.init();

  return { app, mocks };
}
