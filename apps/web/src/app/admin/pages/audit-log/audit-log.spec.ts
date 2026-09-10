import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { OperatorAuditLog } from '../../services/operator-audit.service';
import { OperatorAuthService } from '../../services/operator-auth.service';
import { OperatorAuditLogPage } from './audit-log';

const API = 'http://localhost:3000/api/v1';

function log(overrides: Partial<OperatorAuditLog> = {}): OperatorAuditLog {
  return {
    id: 'log-1',
    operatorId: 'operator-1',
    action: 'store.live_approved',
    targetType: 'store',
    targetId: 'store-1',
    before: { liveStatus: 'PENDING' },
    after: { liveStatus: 'APPROVED' },
    reason: 'Documentos conferem.',
    requestId: 'req-1',
    createdAt: '2026-09-07T10:00:00.000Z',
    ...overrides,
  };
}

describe('OperatorAuditLogPage', () => {
  let httpMock: HttpTestingController;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  async function open(url = '/operator/audit-logs', data: OperatorAuditLog[] = [log()]) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'operator/audit-logs', component: OperatorAuditLogPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(OperatorAuthService).currentOperator.set({
      id: 'operator-1',
      name: 'Ana Mesa',
      email: 'ana@hockpay.dev',
    });

    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, OperatorAuditLogPage);

    const request = httpMock.expectOne((req) => req.url === `${API}/operator/audit-logs`);
    request.flush({ data, limit: 50, offset: Number(request.request.params.get('offset') ?? 0) });

    el = harness.routeNativeElement as HTMLElement;
    await settle();

    return request;
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  afterEach(() => httpMock.verify());

  it('reads a LIVE decision as a sentence, with the reason it carried', async () => {
    await open();

    const row = el.querySelector('.trail-row')!;
    expect(row.querySelector('.adm-chip')?.textContent?.trim()).toBe('Aprovou LIVE');
    expect(row.querySelector('.adm-chip')?.getAttribute('data-tone')).toBe('ok');
    expect(row.querySelector('.trail-field')?.textContent?.trim()).toBe('Habilitação LIVE');
    expect(row.querySelector('.trail-before')?.textContent?.trim()).toBe('Pendente');
    expect(row.querySelector('.trail-after')?.textContent?.trim()).toBe('Aprovada');
    expect(row.querySelector('.trail-reason')?.textContent).toContain('Documentos conferem.');
  });

  it('never shows raw JSON, even for a condition change with three fields', async () => {
    await open('/operator/audit-logs', [
      log({
        action: 'store.commercial_terms_changed',
        before: { feePercent: 1.5, feeFixed: 15, settlementDays: 30 },
        after: { feePercent: 2.9, feeFixed: 39, settlementDays: 2 },
      }),
    ]);

    const changes = Array.from(el.querySelectorAll('.trail-changes li')).map((li) =>
      Array.from(li.querySelectorAll('.trail-field, .trail-before, .trail-after')).map((span) =>
        span.textContent!.trim(),
      ),
    );

    expect(changes).toEqual([
      ['Taxa variável', '1.5%', '2.9%'],
      ['Taxa fixa', 'R$ 0,15', 'R$ 0,39'],
      ['Prazo de liquidação', '30 dias', '2 dias'],
    ]);
    expect(el.textContent).not.toContain('{');
  });

  it('links a store target to its own screen, and leaves other targets as text', async () => {
    await open('/operator/audit-logs', [
      log({ id: 'a', targetType: 'store', targetId: 'store-1' }),
      log({ id: 'b', action: 'operator.login', targetType: 'operator', targetId: 'operator-1' }),
    ]);

    const rows = el.querySelectorAll('.trail-row');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/operator/stores/store-1');
    expect(rows[1].querySelector('a')).toBeNull();
    expect(rows[1].querySelector('.trail-target')?.textContent).toContain('operator operator-1');
  });

  it('shows an investigation as a line with no before and after', async () => {
    await open('/operator/audit-logs', [
      log({ action: 'store.investigated', before: null, after: null, reason: null }),
    ]);

    expect(el.querySelector('.adm-chip')?.textContent?.trim()).toBe('Abriu para investigar');
    expect(el.querySelector('.trail-changes')).toBeNull();
    expect(el.querySelector('.trail-reason')).toBeNull();
  });

  it('narrows the trail to the operator asking for it', async () => {
    await open();

    el.querySelector<HTMLButtonElement>('[aria-pressed]')!.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/operator/audit-logs?mine=1');
    const request = httpMock.expectOne((req) => req.url === `${API}/operator/audit-logs`);
    expect(request.request.params.get('operatorId')).toBe('operator-1');
    request.flush({ data: [], limit: 50, offset: 0 });
    await settle();

    expect(el.querySelector('adm-page-state')?.textContent).toContain('Você ainda não decidiu');
  });

  it('walks by offset, like the queue, because there is no total to page against', async () => {
    await open(
      '/operator/audit-logs',
      Array.from({ length: 50 }, (_, i) => log({ id: `l${i}` })),
    );

    const [previous, next] = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.adm-listfoot-actions button'),
    );
    expect(previous.disabled).toBe(true);

    next.click();
    await settle();

    const request = httpMock.expectOne((req) => req.url === `${API}/operator/audit-logs`);
    expect(request.request.params.get('offset')).toBe('50');
    request.flush({ data: [log()], limit: 50, offset: 50 });
    await settle();

    expect(el.querySelectorAll<HTMLButtonElement>('.adm-listfoot-actions button')[1].disabled).toBe(
      true,
    );
  });
});
