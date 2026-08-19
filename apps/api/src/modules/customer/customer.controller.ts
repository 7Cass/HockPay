import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  CreateCustomerUseCase,
  GetCustomerByIdUseCase,
  ListCustomersUseCase,
  GetCustomerUseCase,
  UpdateCustomerUseCase,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
import { CurrentStore } from '../auth/decorators/current-store.decorator';
import {
  CreateCustomerDto,
  CreateCustomerResponseDto,
} from './dtos/create-customer.dto';
import {
  UpdateCustomerDto,
  UpdateCustomerResponseDto,
} from './dtos/update-customer.dto';
import {
  ListCustomersQueryDto,
  ListCustomersResponseDto,
} from './dtos/list-customers.dto';
import { GetCustomerResponseDto } from './dtos/customer-response.dto';

/**
 * Controller for Customer endpoints.
 *
 * This controller handles customer CRUD operations.
 * Business logic is delegated to the use cases from the core layer.
 *
 * Authentication:
 * - All routes use CombinedAuthGuard (API Key OR JWT Cookie)
 * - @Public() bypasses the global JWT guard, CombinedAuthGuard handles auth
 */
@Controller('customers')
@Public()
@UseGuards(CombinedAuthGuard)
export class CustomerController {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly listCustomersUseCase: ListCustomersUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly getCustomerByIdUseCase: GetCustomerByIdUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
  ) {}

  /**
   * POST /api/v1/customers
   *
   * Creates a new customer or updates an existing one (if update_existing=true).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @Query('update_existing') updateExisting?: string,
    @CurrentStore() storeId: string,
  ): Promise<CreateCustomerResponseDto> {
    const result = await this.createCustomerUseCase.execute({
      storeId,
      externalId: dto.externalId,
      name: dto.name,
      email: dto.email,
      document: dto.document,
      phone: dto.phone,
      street: dto.street,
      number: dto.number,
      complement: dto.complement,
      city: dto.city,
      state: dto.state,
      zipCode: dto.zipCode,
      country: dto.country,
      metadata: dto.metadata,
      updateExisting: updateExisting === 'true',
    });

    return {
      customer: result.customer,
      created: result.created,
    };
  }

  /**
   * GET /api/v1/customers
   *
   * Lists customers with pagination.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listCustomers(
    @Query() query: ListCustomersQueryDto,
    @CurrentStore() storeId: string,
  ): Promise<ListCustomersResponseDto> {
    const result = await this.listCustomersUseCase.execute({
      storeId,
      page: query.page,
      limit: query.limit,
      search: query.search,
    });

    return result;
  }

  /**
   * GET /api/v1/customers/id/:id
   *
   * Gets a customer by internal ID for dashboard navigation.
   */
  @Get('id/:id')
  @HttpCode(HttpStatus.OK)
  async getCustomerById(
    @Param('id') id: string,
    @CurrentStore() storeId: string,
  ): Promise<GetCustomerResponseDto> {
    const result = await this.getCustomerByIdUseCase.execute({
      storeId,
      customerId: id,
    });

    return {
      customer: result.customer,
    };
  }

  /**
   * GET /api/v1/customers/:externalId
   *
   * Gets a customer by externalId.
   */
  @Get(':externalId')
  @HttpCode(HttpStatus.OK)
  async getCustomer(
    @Param('externalId') externalId: string,
    @CurrentStore() storeId: string,
  ): Promise<GetCustomerResponseDto> {
    const result = await this.getCustomerUseCase.execute({
      storeId,
      externalId,
    });

    return {
      customer: result.customer,
    };
  }

  /**
   * PATCH /api/v1/customers/:externalId
   *
   * Updates a customer by externalId.
   */
  @Patch(':externalId')
  @HttpCode(HttpStatus.OK)
  async updateCustomer(
    @Param('externalId') externalId: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentStore() storeId: string,
  ): Promise<UpdateCustomerResponseDto> {
    const result = await this.updateCustomerUseCase.execute({
      storeId,
      externalId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      street: dto.street,
      number: dto.number,
      complement: dto.complement,
      city: dto.city,
      state: dto.state,
      zipCode: dto.zipCode,
      country: dto.country,
    });

    return {
      customer: result.customer,
    };
  }
}
