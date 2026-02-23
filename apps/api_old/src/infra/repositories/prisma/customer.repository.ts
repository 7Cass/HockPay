import { Injectable } from '@nestjs/common';
import { Customer as CustomerEntity, Prisma } from '@hockpay/database';
import { Customer } from '../../../domain/entities/customer.entity';
import { PrismaService } from '../../database/prisma.service';

/**
 * Implementação do CustomerRepository usando Prisma
 */
@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return null;
    }

    return this.toDomain(customer);
  }

  async findByExternalId(storeId: string, externalId: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findUnique({
      where: {
        storeId_externalId: {
          storeId,
          externalId,
        },
      },
    });

    if (!customer) {
      return null;
    }

    return this.toDomain(customer);
  }

  async findByDocument(storeId: string, document: string): Promise<Customer | null> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        storeId,
        document,
      },
    });

    if (!customer) {
      return null;
    }

    return this.toDomain(customer);
  }

  async findByStoreId(
    storeId: string,
    options: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Customer[]> {
    const customers = await this.prisma.customer.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });

    return customers.map(c => this.toDomain(c));
  }

  async save(customer: Customer): Promise<Customer> {
    const data = customer.toPersistence();

    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        metadata: (data.metadata ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return this.toDomain(updated);
  }

  async create(customer: Customer): Promise<Customer> {
    const data = customer.toPersistence();

    const created = await this.prisma.customer.create({
      data: {
        ...data,
        metadata: (data.metadata ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toDomain(created);
  }

  async findOrCreate(storeId: string, data: {
    externalId?: string;
    document: string;
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<Customer> {
    // Primeiro tenta buscar por externalId
    if (data.externalId) {
      const existing = await this.findByExternalId(storeId, data.externalId);
      if (existing) {
        return existing;
      }
    }

    // Depois tenta buscar por documento
    const byDocument = await this.findByDocument(storeId, data.document);
    if (byDocument) {
      return byDocument;
    }

    // Se não encontrou, cria um novo
    const newCustomer = Customer.create({
      id: crypto.randomUUID(),
      storeId,
      externalId: data.externalId ?? null,
      name: data.name ?? null,
      email: data.email ?? null,
      document: data.document,
      phone: data.phone ?? null,
    });

    return this.create(newCustomer);
  }

  private toDomain(prismaCustomer: CustomerEntity): Customer {
    return Customer.fromPersistence({
      id: prismaCustomer.id,
      storeId: prismaCustomer.storeId,
      externalId: prismaCustomer.externalId,
      name: prismaCustomer.name,
      email: prismaCustomer.email,
      document: prismaCustomer.document,
      phone: prismaCustomer.phone,
      metadata: prismaCustomer.metadata as Record<string, unknown> | null,
      createdAt: prismaCustomer.createdAt,
      updatedAt: prismaCustomer.updatedAt,
    });
  }
}
