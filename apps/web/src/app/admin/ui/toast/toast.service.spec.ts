import { TestBed } from '@angular/core/testing';

import { AdmToastService } from './toast.service';

describe('AdmToastService', () => {
  let toasts: AdmToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    toasts = TestBed.inject(AdmToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carries the tone and the detail of what just happened', () => {
    toasts.ok('Ateliê Corvo: aprovada.', 'A linha já está na trilha.');

    expect(toasts.toasts()).toHaveLength(1);
    expect(toasts.toasts()[0].tone).toBe('ok');
    expect(toasts.toasts()[0].detail).toBe('A linha já está na trilha.');
  });

  /* Uma pilha maior que três cobre a tabela que o operador está lendo. */
  it('keeps at most three, dropping the oldest', () => {
    toasts.ok('um');
    toasts.ok('dois');
    toasts.ok('três');
    toasts.ok('quatro');

    expect(toasts.toasts().map((toast) => toast.message)).toEqual(['dois', 'três', 'quatro']);
  });

  it('lets an error stay longer than a success', () => {
    toasts.ok('gravado');
    toasts.bad('não deu');

    vi.advanceTimersByTime(4000);
    expect(toasts.toasts().map((toast) => toast.message)).toEqual(['não deu']);

    vi.advanceTimersByTime(5000);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('closes by hand before the clock', () => {
    toasts.info('lendo LIVE');
    const [toast] = toasts.toasts();

    toasts.dismiss(toast.id);

    expect(toasts.toasts()).toHaveLength(0);
  });
});
