import {
  LEDGER_QUERY,
  WITHDRAWAL_QUERY,
  ledgerLabel,
  ledgerParams,
  withdrawalsParams,
} from './money';

describe('parâmetros do dinheiro', () => {
  describe('extrato', () => {
    it('manda só página e limite sem filtro', () => {
      expect(ledgerParams(LEDGER_QUERY)).toEqual({ page: 1, limit: 20 });
    });

    it('leva tipo e período quando escolhidos', () => {
      const params = ledgerParams({
        ...LEDGER_QUERY,
        type: 'WITHDRAWAL_SENT',
        startDate: '2026-09-01',
        endDate: '2026-09-15',
        page: 2,
      });

      expect(params).toEqual({
        page: 2,
        limit: 20,
        type: 'WITHDRAWAL_SENT',
        startDate: '2026-09-01',
        endDate: '2026-09-15',
      });
    });

    it('traduz o tipo técnico para frase de dinheiro', () => {
      expect(ledgerLabel('WITHDRAWAL_RESERVED')).toBe('Saque reservado');
      expect(ledgerLabel('PAYMENT_RELEASED')).toBe('Saldo liberado');
    });

    it('devolve o próprio tipo quando não conhece', () => {
      expect(ledgerLabel('ALGO_NOVO')).toBe('ALGO_NOVO');
    });
  });

  describe('saques', () => {
    it('traduz "conta" da tela para `bankAccountId` da API', () => {
      const params = withdrawalsParams({ ...WITHDRAWAL_QUERY, account: 'bank_1' });

      expect(params).toEqual({ page: 1, limit: 20, bankAccountId: 'bank_1' });
    });

    it('leva status e busca, ignorando espaço em branco', () => {
      const params = withdrawalsParams({
        ...WITHDRAWAL_QUERY,
        status: 'FAILED',
        q: '  E2E123  ',
      });

      expect(params).toEqual({ page: 1, limit: 20, status: 'FAILED', q: 'E2E123' });
    });

    it('não manda filtro vazio', () => {
      expect(withdrawalsParams(WITHDRAWAL_QUERY)).toEqual({ page: 1, limit: 20 });
    });
  });
});
