import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StatusChip } from './status-chip';
import { statusLabel, statusTone } from './status';

describe('statusTone', () => {
  it('reads a landed payment, receipt, withdrawal or link as ok', () => {
    for (const status of [
      'CONFIRMED',
      'RELEASED',
      'PAID',
      'APPROVED',
      'COMPLETED',
      'ISSUED',
      'ACTIVE',
    ]) {
      expect(statusTone(status)).toBe('ok');
    }
  });

  it('reads anything still in flight as warn', () => {
    for (const status of ['PENDING', 'PROCESSING', 'OPENED']) {
      expect(statusTone(status)).toBe('warn');
    }
  });

  it('reads a dead end as bad, spelling of "cancelled" aside', () => {
    for (const status of ['FAILED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'INACTIVE']) {
      expect(statusTone(status)).toBe('bad');
    }
  });

  it('never guesses a colour it does not know', () => {
    expect(statusTone('REFUNDED')).toBe('neutral');
    expect(statusTone('SOMETHING_NEW')).toBe('neutral');
    expect(statusTone('')).toBe('neutral');
  });

  it('is case insensitive', () => {
    expect(statusTone('confirmed')).toBe('ok');
    expect(statusLabel('confirmed')).toBe('Confirmado');
  });

  it('echoes an untranslated status rather than blanking the cell', () => {
    expect(statusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

@Component({
  standalone: true,
  imports: [StatusChip],
  template: '<app-status-chip [status]="status()" [label]="label()" />',
})
class Host {
  readonly status = signal('CONFIRMED');
  readonly label = signal<string | undefined>(undefined);
}

describe('StatusChip', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    return {
      host: fixture.componentInstance,
      chip: () => fixture.nativeElement.querySelector('app-status-chip') as HTMLElement,
      settle: async () => {
        await fixture.whenStable();
      },
    };
  }

  it('is the pill itself, with the tone on the host', async () => {
    const { chip } = await render();

    expect(chip().classList.contains('chip')).toBe(true);
    expect(chip().getAttribute('data-tone')).toBe('ok');
    expect(chip().textContent?.trim()).toBe('Confirmado');
  });

  it('retones and relabels when the status changes', async () => {
    const { host, chip, settle } = await render();

    host.status.set('FAILED');
    await settle();

    expect(chip().getAttribute('data-tone')).toBe('bad');
    expect(chip().textContent?.trim()).toBe('Falhou');
  });

  it('lets the screen override the label but not the tone', async () => {
    const { host, chip, settle } = await render();

    host.status.set('ACTIVE');
    host.label.set('Link ativo');
    await settle();

    expect(chip().textContent?.trim()).toBe('Link ativo');
    expect(chip().getAttribute('data-tone')).toBe('ok');
  });
});
