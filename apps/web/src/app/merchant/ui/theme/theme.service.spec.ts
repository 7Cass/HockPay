import { TestBed } from '@angular/core/testing';

import { MerThemeService } from './theme.service';

const KEY = 'hockpay.merchant.theme';

describe('MerThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  const service = () => TestBed.inject(MerThemeService);

  it('abre em carvão quando o lojista nunca escolheu', () => {
    expect(service().resolved()).toBe('night');
  });

  it('obedece à escolha guardada', () => {
    localStorage.setItem(KEY, 'paper');

    expect(service().resolved()).toBe('paper');
  });

  it('ignora valor estranho no armazenamento', () => {
    localStorage.setItem(KEY, 'neon');

    expect(service().theme()).toBe('night');
  });

  it('alterna entre as duas peles e grava a escolha', () => {
    const theme = service();

    theme.toggle();
    expect(theme.resolved()).toBe('paper');
    expect(localStorage.getItem(KEY)).toBe('paper');

    theme.toggle();
    expect(theme.resolved()).toBe('night');
    expect(localStorage.getItem(KEY)).toBe('night');
  });

  it('resolve `system` para carvão quando o aparelho não pede claro', () => {
    const theme = service();

    theme.set('system');

    // jsdom não tem `matchMedia`: o padrão declarado continua valendo.
    expect(theme.theme()).toBe('system');
    expect(theme.resolved()).toBe('night');
  });

  it('não explode quando o armazenamento é proibido', () => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new Error('bloqueado');
    };
    Storage.prototype.setItem = () => {
      throw new Error('bloqueado');
    };

    try {
      const theme = service();
      expect(theme.resolved()).toBe('night');
      expect(() => theme.toggle()).not.toThrow();
      expect(theme.resolved()).toBe('paper');
    } finally {
      Storage.prototype.getItem = getItem;
      Storage.prototype.setItem = setItem;
    }
  });
});
