import { CUSTOMER_QUERY, customerName, customersParams } from './customers';
import { RECEIPT_QUERY, receiptsParams } from './receipts';

describe('parâmetros das listas', () => {
  describe('comprovantes', () => {
    it('manda só página e limite sem busca', () => {
      expect(receiptsParams(RECEIPT_QUERY)).toEqual({ page: 1, limit: 20 });
    });

    it('busca por número do comprovante, que é o que o lojista tem em mãos', () => {
      const params = receiptsParams({ ...RECEIPT_QUERY, q: ' RCP-20260901-0003 ' });

      expect(params).toEqual({ page: 1, limit: 20, receiptNumber: 'RCP-20260901-0003' });
    });
  });

  describe('clientes', () => {
    it('manda uma busca só, que a API aplica em todos os campos', () => {
      expect(customersParams({ ...CUSTOMER_QUERY, q: 'ana', page: 2 })).toEqual({
        page: 2,
        limit: 20,
        search: 'ana',
      });
    });

    it('ignora busca em branco', () => {
      expect(customersParams({ ...CUSTOMER_QUERY, q: '  ' })).toEqual({ page: 1, limit: 20 });
    });
  });

  describe('nome do cliente', () => {
    const base = {
      id: 'c1',
      document: '50621302554',
      formattedDocument: '506.213.025-54',
      documentType: 'CPF' as const,
      createdAt: '2026-09-01T10:00:00.000Z',
    };

    it('usa o primeiro campo que identifica a pessoa', () => {
      expect(customerName({ ...base, name: 'Ana', email: 'a@x.com' })).toBe('Ana');
      expect(customerName({ ...base, email: 'a@x.com' })).toBe('a@x.com');
      expect(customerName({ ...base, externalId: 'cli_1' })).toBe('cli_1');
    });

    it('cai no documento quando não há mais nada', () => {
      expect(customerName(base)).toBe('506.213.025-54');
    });
  });
});
