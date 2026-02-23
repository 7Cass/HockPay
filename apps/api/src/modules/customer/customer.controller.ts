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
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateCustomerUseCase,
  ListCustomersUseCase,
  GetCustomerUseCase,
  UpdateCustomerUseCase,
  CustomerAlreadyExistsError,
  CustomerNotFoundError,
  DocumentAlreadyInUseError,
} from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard';
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
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
  ) {}

  /**
   * POST /v1/customers
   *
   * Creates a new customer or updates an existing one (if update_existing=true).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @Query('update_existing') updateExisting?: string,
    @Req() req?: Request,
  ): Promise<CreateCustomerResponseDto> {
    try {
      // Get storeId from request (set by CombinedAuthGuard)
      const storeId = (req as any)?.store?.id;

      if (!storeId) {
        throw new Error('Store ID not found in request');
      }

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
    } catch (error) {
      if (error instanceof CustomerAlreadyExistsError) {
        throw new ConflictException({
          error: {
            code: error.code,
            message: error.message,
            internalId: error.internalId,
          },
        });
      }
      if (error instanceof DocumentAlreadyInUseError) {
        throw new UnprocessableEntityException({
          error: {
            code: error.code,
            message: error.message,
            conflictingExternalId: error.conflictingExternalId,
          },
        });
      }
      throw error;
    }
  }

  /**
   * GET /v1/customers
   *
   * Lists customers with pagination.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listCustomers(
    @Query() query: ListCustomersQueryDto,
    @Req() req?: Request,
  ): Promise<ListCustomersResponseDto> {
    const storeId = (req as any)?.store?.id;

    if (!storeId) {
      throw new Error('Store ID not found in request');
    }

    const result = await this.listCustomersUseCase.execute({
      storeId,
      page: query.page,
      limit: query.limit,
      search: query.search,
    });

    return result;
  }

  /**
   * GET /v1/customers/:externalId
   *
   * Gets a customer by externalId.
   */
  @Get(':externalId')
  @HttpCode(HttpStatus.OK)
  async getCustomer(
    @Param('externalId') externalId: string,
    @Req() req?: Request,
  ): Promise<GetCustomerResponseDto> {
    try {
      const storeId = (req as any)?.store?.id;

      if (!storeId) {
        throw new Error('Store ID not found in request');
      }

      const result = await this.getCustomerUseCase.execute({
        storeId,
        externalId,
      });

      return {
        customer: result.customer,
      };
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw new NotFoundException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      throw error;
    }
  }

  /**
   * PATCH /v1/customers/:externalId
   *
   * Updates a customer by externalId.
   */
  @Patch(':externalId')
  @HttpCode(HttpStatus.OK)
  async updateCustomer(
    @Param('externalId') externalId: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req?: Request,
  ): Promise<UpdateCustomerResponseDto> {
    try {
      const storeId = (req as any)?.store?.id;

      if (!storeId) {
        throw new Error('Store ID not found in request');
      }

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
    } catch (error) {
      if (error instanceof CustomerNotFoundError) {
        throw new NotFoundException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      throw error;
    }
  }
}
