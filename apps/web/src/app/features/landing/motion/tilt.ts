import { Directive, ElementRef, inject, input } from '@angular/core';
import { hasFinePointer, prefersReducedMotion } from './motion';

/**
 * Tilts the host in 3D toward the pointer and exposes the pointer position as
 * `--x`/`--y` (px) for a sheen. Flat again on leave.
 *
 *   <article appTilt>…</article>      6° at the edges
 *   <article appTilt="10">…</article>
 */
@Directive({
  selector: '[appTilt]',
  host: { '(pointermove)': 'tilt($event)', '(pointerleave)': 'flatten()' },
})
export class Tilt {
  readonly degrees = input(6, {
    alias: 'appTilt',
    transform: (value: unknown) => (value === '' || value == null ? 6 : Number(value) || 6),
  });

  private readonly host = inject(ElementRef).nativeElement as HTMLElement;
  private enabled: boolean | null = null;

  protected tilt(event: PointerEvent): void {
    this.enabled ??= hasFinePointer() && !prefersReducedMotion();
    if (!this.enabled) return;

    const box = this.host.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const rx = (0.5 - y / box.height) * this.degrees();
    const ry = (x / box.width - 0.5) * this.degrees();

    this.host.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    this.host.style.setProperty('--x', `${x.toFixed(0)}px`);
    this.host.style.setProperty('--y', `${y.toFixed(0)}px`);
  }

  protected flatten(): void {
    this.host.style.transform = '';
  }
}
