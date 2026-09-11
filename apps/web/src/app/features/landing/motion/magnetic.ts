import { Directive, ElementRef, inject, input } from '@angular/core';
import { hasFinePointer, prefersReducedMotion } from './motion';

/**
 * Pulls the host toward the pointer while hovered, then lets it spring back.
 *
 *   <a appMagnetic>…</a>            default pull (30% of the offset)
 *   <button appMagnetic="0.5">…</button>
 *
 * It writes the `translate` property, so it composes with any `transform` the
 * host already has; the spring-back is the host's own `translate` transition.
 */
@Directive({
  selector: '[appMagnetic]',
  host: { '(pointermove)': 'pull($event)', '(pointerleave)': 'release()' },
})
export class Magnetic {
  readonly strength = input(0.3, {
    alias: 'appMagnetic',
    transform: (value: unknown) => (value === '' || value == null ? 0.3 : Number(value) || 0.3),
  });

  private readonly host = inject(ElementRef).nativeElement as HTMLElement;
  private enabled: boolean | null = null;

  protected pull(event: PointerEvent): void {
    this.enabled ??= hasFinePointer() && !prefersReducedMotion();
    if (!this.enabled) return;

    const box = this.host.getBoundingClientRect();
    const x = (event.clientX - box.left - box.width / 2) * this.strength();
    const y = (event.clientY - box.top - box.height / 2) * this.strength();
    this.host.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  }

  protected release(): void {
    this.host.style.translate = '';
  }
}
