import { actionLabel, actionTone, readableChanges } from './audit-vocabulary';

describe('audit vocabulary', () => {
  it('names every action the backend can record', () => {
    expect(actionLabel('store.live_approved')).toBe('Aprovou LIVE');
    expect(actionLabel('store.commercial_terms_changed')).toBe('Mudou condição comercial');
    expect(actionLabel('store.investigated')).toBe('Abriu para investigar');
    expect(actionTone('store.live_suspended')).toBe('bad');
    expect(actionTone('store.investigated')).toBe('neutral');
  });

  it('echoes an action it does not know instead of blanking the row', () => {
    expect(actionLabel('store.something_new')).toBe('store.something_new');
    expect(actionTone('store.something_new')).toBe('neutral');
  });

  it('reads a commercial condition change in words, not in cents and floats', () => {
    expect(
      readableChanges(
        { feePercent: 1.5, feeFixed: 15, settlementDays: 30 },
        { feePercent: 2.9, feeFixed: 39, settlementDays: 2 },
      ),
    ).toEqual([
      { field: 'Taxa variável', before: '1.5%', after: '2.9%' },
      { field: 'Taxa fixa', before: 'R$ 0,15', after: 'R$ 0,39' },
      { field: 'Prazo de liquidação', before: '30 dias', after: '2 dias' },
    ]);
  });

  it('leaves out what did not move, so what moved stays visible', () => {
    expect(
      readableChanges(
        { feePercent: 1.5, feeFixed: 15, settlementDays: 30 },
        { feePercent: 1.5, feeFixed: 15, settlementDays: 2 },
      ),
    ).toEqual([{ field: 'Prazo de liquidação', before: '30 dias', after: '2 dias' }]);
  });

  it('reads a LIVE decision with the desk vocabulary', () => {
    expect(readableChanges({ liveStatus: 'PENDING' }, { liveStatus: 'APPROVED' })).toEqual([
      { field: 'Habilitação LIVE', before: 'Pendente', after: 'Aprovada' },
    ]);
  });

  it('says nothing for a line that changed no state, like an investigation', () => {
    expect(readableChanges(null, null)).toEqual([]);
  });

  it('shows a field that only exists on one side as a change, not as silence', () => {
    expect(readableChanges({}, { liveStatus: 'APPROVED' })).toEqual([
      { field: 'Habilitação LIVE', before: '—', after: 'Aprovada' },
    ]);
  });

  it('degrades to key and value for a field it has no words for', () => {
    expect(readableChanges({ riskScore: 12 }, { riskScore: 87 })).toEqual([
      { field: 'riskScore', before: '12', after: '87' },
    ]);
  });

  it('says one day in the singular, because the trail is read by people', () => {
    expect(readableChanges({ settlementDays: 30 }, { settlementDays: 1 })[0].after).toBe('1 dia');
  });
});
