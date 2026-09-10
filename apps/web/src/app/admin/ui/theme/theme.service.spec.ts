import { TestBed } from '@angular/core/testing';

import { AdmThemeService } from './theme.service';

describe('AdmThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts compact and light when nothing was chosen and the system says nothing', () => {
    const theme = TestBed.inject(AdmThemeService);

    expect(theme.theme()).toBe('light');
    expect(theme.density()).toBe('compact');
  });

  it('remembers the choice for the next session', () => {
    const theme = TestBed.inject(AdmThemeService);

    theme.toggleTheme();
    theme.toggleDensity();
    /* Os `effect` que gravam a escolha rodam na próxima passada. */
    TestBed.tick();

    expect(localStorage.getItem('hockpay.admin.theme')).toBe('dark');
    expect(localStorage.getItem('hockpay.admin.density')).toBe('cozy');

    TestBed.resetTestingModule();
    expect(TestBed.inject(AdmThemeService).theme()).toBe('dark');
  });

  /*
   * jsdom não tem `matchMedia`, e uma preferência que não persiste (aba
   * anônima, cota estourada) não é motivo para a mesa não abrir.
   */
  it('opens even where the browser refuses to store or to answer about the system', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    const theme = TestBed.inject(AdmThemeService);
    theme.toggleTheme();
    TestBed.tick();

    expect(theme.theme()).toBe('dark');

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
