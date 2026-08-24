import { Global, Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getWebhookUrlPolicyOptionsForNodeEnv } from '@hockpay/core';
import {
  AccountRepository,
  AlertConfigRepository,
  AlertDeliveryLogRepository,
  ApiKeyRepository,
  BankAccountRepository,
  CheckoutSessionRepository,
  CustomerRepository,
  DashboardOverviewRepository,
  DiscordAlertSenderService,
  EncryptionService,
  ExpirationQueue,
  getRequiredEnv,
  HmacSignerService,
  IdempotencyKeyRepository,
  MerchantRepository,
  OutboxRepository,
  parseRedisEnv,
  PaymentLinkRepository,
  PaymentRepository,
  PixChargeRepository,
  ProductRepository,
  ReceiptRepository,
  RefreshTokenRepository,
  RefundRepository,
  StoreRepository,
  TransactionRepository,
  UnitOfWork,
  WebhookConfigRepository,
  WebhookHttpClientService,
  WebhookInboxEventRepository,
  WebhookLogRepository,
  WithdrawalRepository,
} from '@hockpay/infrastructure';
import { PrismaService } from './database/prisma.service';
import { JwtService } from './services/jwt.service';
import { PixQrCodeGeneratorService } from './services/pix-qr-code-generator.service';
import { TokenGeneratorService } from './services/token-generator.service';

/**
 * Repositorios que so dependem do Prisma, indexados pelo token de porta que o
 * core injeta. Antes cada feature module repetia o mesmo `useFactory`, o que
 * fazia `ITransactionRepository` e `IAccountRepository` existirem em tres
 * instancias diferentes e `IUnitOfWork` em nove.
 */
const PRISMA_REPOSITORIES = {
  IAccountRepository: AccountRepository,
  IAlertConfigRepository: AlertConfigRepository,
  IAlertDeliveryLogRepository: AlertDeliveryLogRepository,
  IBankAccountRepository: BankAccountRepository,
  ICheckoutSessionRepository: CheckoutSessionRepository,
  IDashboardOverviewRepository: DashboardOverviewRepository,
  IIdempotencyKeyRepository: IdempotencyKeyRepository,
  IOutboxRepository: OutboxRepository,
  IPaymentRepository: PaymentRepository,
  IPixChargeRepository: PixChargeRepository,
  IReceiptRepository: ReceiptRepository,
  IRefundRepository: RefundRepository,
  ITransactionRepository: TransactionRepository,
  IUnitOfWork: UnitOfWork,
  IWebhookConfigRepository: WebhookConfigRepository,
  IWebhookInboxEventRepository: WebhookInboxEventRepository,
  IWebhookLogRepository: WebhookLogRepository,
  IWithdrawalRepository: WithdrawalRepository,
} as const;

/**
 * Repositorios injetados pela propria classe (sem porta no core).
 */
const CLASS_REPOSITORIES = [
  ApiKeyRepository,
  CustomerRepository,
  MerchantRepository,
  ProductRepository,
  RefreshTokenRepository,
  StoreRepository,
] as const;

const repositoryProviders: Provider[] = [
  ...Object.entries(PRISMA_REPOSITORIES).map(([token, Repository]) => ({
    provide: token,
    useFactory: (prisma: PrismaService) => new Repository(prisma),
    inject: [PrismaService],
  })),
  ...CLASS_REPOSITORIES.map((Repository) => ({
    provide: Repository,
    useFactory: (prisma: PrismaService) => new Repository(prisma),
    inject: [PrismaService],
  })),
  {
    // Unico repositorio com dependencia alem do Prisma: monta a URL publica
    // do link a partir da base do checkout.
    provide: 'IPaymentLinkRepository',
    useFactory: (prisma: PrismaService) =>
      new PaymentLinkRepository(
        prisma,
        process.env.CHECKOUT_BASE_URL ?? 'http://localhost:3333',
      ),
    inject: [PrismaService],
  },
];

const adapterProviders: Provider[] = [
  JwtService,
  PixQrCodeGeneratorService,
  TokenGeneratorService,
  DiscordAlertSenderService,
  {
    provide: EncryptionService,
    useFactory: () => new EncryptionService(getRequiredEnv('ENCRYPTION_KEY')),
  },
  {
    provide: HmacSignerService,
    useFactory: () => new HmacSignerService(),
  },
  {
    provide: WebhookHttpClientService,
    useFactory: () =>
      new WebhookHttpClientService({
        logger: new Logger(WebhookHttpClientService.name),
        webhookUrlPolicyOptions: getWebhookUrlPolicyOptionsForNodeEnv(
          process.env.NODE_ENV,
        ),
      }),
  },
  {
    provide: ExpirationQueue,
    useFactory: (config: ConfigService) =>
      new ExpirationQueue(
        parseRedisEnv({
          REDIS_URL: config.get<string>('REDIS_URL'),
          REDIS_HOST: config.get<string>('REDIS_HOST'),
          REDIS_PORT: config.get<string>('REDIS_PORT'),
        }).connection,
      ),
    inject: [ConfigService],
  },
];

/**
 * Infrastructure Module
 *
 * Registra uma unica vez toda a camada de adapters: repositorios Prisma,
 * servicos de cripto/HMAC/HTTP de webhook e a fila de expiracao.
 *
 * E `@Global()` de proposito: os tokens de repositorio sao string
 * (`'IPaymentRepository'`), entao sem escopo global cada feature module
 * precisaria reimportar e reexportar a lista inteira — que e exatamente a
 * duplicacao que este modulo elimina. Feature modules seguem declarando os
 * proprios use cases; so a camada de infraestrutura e compartilhada.
 */
@Global()
@Module({
  providers: [...repositoryProviders, ...adapterProviders],
  exports: [
    ...Object.keys(PRISMA_REPOSITORIES),
    'IPaymentLinkRepository',
    ...CLASS_REPOSITORIES,
    JwtService,
    PixQrCodeGeneratorService,
    TokenGeneratorService,
    DiscordAlertSenderService,
    EncryptionService,
    HmacSignerService,
    WebhookHttpClientService,
    ExpirationQueue,
  ],
})
export class InfrastructureModule {}
