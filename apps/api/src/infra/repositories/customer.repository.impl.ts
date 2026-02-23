import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ICustomerRepository,
  ListCustomersParams,
  ListCustomersResult,
} from '@hockpay/core';
import { Customer as DomainCustomer, CustomerProps } from '@hockpay/core';
import { Document } from '@hockpay/core';
import { Customer as PrismaCustomer } from '@hockpay/database';

/**
 * Infrastructure implementation of ICustomerRepository.
 *
 * This repository bridges between the domain layer (which uses domain entities)
 * and the infrastructure layer (which uses Prisma ORM).
 */
@Injectable()
export class CustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(customer: DomainCustomer): Promise<void> {
    await this.prisma.customer.create({
      data: {
        id: customer.id,
        storeId: customer.storeId,
        externalId: customer.externalId,
        name: customer.name,
        email: customer.email,
        document: customer.document.value,
        phone: customer.phone,
        street: customer.street,
        number: customer.number,
        complement: customer.complement,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
        country: customer.country,
        metadata: customer.metadata as any,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<DomainCustomer | null> {
    const prismaCustomer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!prismaCustomer) {
      return null;
    }

    return this.toDomain(prismaCustomer);
  }

  async findByExternalId(
    storeId: string,
    externalId: string,
  ): Promise<DomainCustomer | null> {
    const prismaCustomer = await this.prisma.customer.findFirst({
      where: {
        storeId,
        externalId,
      },
    });

    if (!prismaCustomer) {
      return null;
    }

    return this.toDomain(prismaCustomer);
  }

  async findByDocument(
    storeId: string,
    document: string,
  ): Promise<DomainCustomer | null> {
    // Normalize document (remove non-digits)
    const normalizedDocument = document.replace(/\D/g, '');

    const prismaCustomer = await this.prisma.customer.findFirst({
      where: {
        storeId,
        document: normalizedDocument,
      },
    });

    if (!prismaCustomer) {
      return null;
    }

    return this.toDomain(prismaCustomer);
  }

  async update(customer: DomainCustomer): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        externalId: customer.externalId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        street: customer.street,
        number: customer.number,
        complement: customer.complement,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
        country: customer.country,
        updatedAt: customer.updatedAt,
      },
    });
  }

  async list(
    storeId: string,
    params: ListCustomersParams,
  ): Promise<ListCustomersResult> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const where = {
      storeId,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { email: { contains: params.search, mode: 'insensitive' as const } },
          { document: { contains: params.search } },
          {
            externalId: {
              contains: params.search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),
    };

    const [prismaCustomers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const customers = prismaCustomers.map((c) => this.toDomain(c));

    return {
      customers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customer.delete({
      where: { id },
    });
  }

  /**
   * Convert a Prisma Customer to a Domain Customer.
   */
  private toDomain(prismaCustomer: PrismaCustomer): DomainCustomer {
    const props: CustomerProps = {
      id: prismaCustomer.id,
      storeId: prismaCustomer.storeId,
      externalId: prismaCustomer.externalId ?? undefined,
      name: prismaCustomer.name ?? undefined,
      email: prismaCustomer.email ?? undefined,
      document: new Document(prismaCustomer.document),
      phone: prismaCustomer.phone ?? undefined,
      street: prismaCustomer.street ?? undefined,
      number: prismaCustomer.number ?? undefined,
      complement: prismaCustomer.complement ?? undefined,
      city: prismaCustomer.city ?? undefined,
      state: prismaCustomer.state ?? undefined,
      zipCode: prismaCustomer.zipCode ?? undefined,
      country: prismaCustomer.country ?? undefined,
      metadata:
        (prismaCustomer.metadata as Record<string, unknown>) ?? undefined,
      createdAt: prismaCustomer.createdAt,
      updatedAt: prismaCustomer.updatedAt,
    };

    return DomainCustomer.reconstitute(props);
  }
}
