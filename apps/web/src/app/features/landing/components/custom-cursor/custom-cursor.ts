import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { damp, hasFinePointer, prefersReducedMotion } from '../../motion/motion';

/**
 * The landing's cursor: a dot that sits on the pointer and a ring that trails
 * it. Over anything clickable the ring swells; over an element with
 * `data-cursor="…"` it grows into a label.
 *
 * Only for a fine pointer without reduced motion; it hides the system cursor
 * through `html.lp-cursor` (see styles.css) and gives it back on destroy.
 */
@Component({
  selector: 'app-custom-cursor',
  template: `
    <div
      #ring
      class="trail"
      [class.is-hover]="hovering()"
      [class.is-down]="down()"
      [class.has-label]="!!label()"
    >
      <span class="label">{{ label() }}</span>
    </div>
    <div #dot class="dot"></div>
  `,
  styleUrl: './custom-cursor.css',
  host: { '[class.is-on]': 'on()', 'aria-hidden': 'true' },
})
export class CustomCursor {
  protected readonly on = signal(false);
  protected readonly hovering = signal(false);
  protected readonly down = signal(false);
  protected readonly label = signal('');

  private readonly ring = viewChild.required<ElementRef<HTMLElement>>('ring');
  private readonly dot = viewChild.required<ElementRef<HTMLElement>>('dot');

  constructor() {
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    const target = { x: 0, y: 0 };
    const trail = { x: 0, y: 0 };
    let frame = 0;
    let last = 0;
    let cleanup = () => {};

    afterNextRender(() => {
      if (!hasFinePointer() || prefersReducedMotion()) return;
      document.documentElement.classList.add('lp-cursor');

      // A posição vai na propriedade `translate`, não em `transform`: o `scale`
      // do clique (.is-down) é aplicado depois de `transform` e encolheria o
      // deslocamento junto, puxando o anel para o canto da tela.
      const move = (event: PointerEvent) => {
        target.x = event.clientX;
        target.y = event.clientY;
        this.dot().nativeElement.style.translate = `${target.x}px ${target.y}px`;
        if (!this.on()) {
          trail.x = target.x;
          trail.y = target.y;
          this.on.set(true);
        }
        wake();
      };
      const over = (event: PointerEvent) => {
        const hit = (event.target as Element | null)?.closest?.('[data-cursor], a, button');
        this.hovering.set(!!hit && !(hit as HTMLButtonElement).disabled);
        this.label.set(hit?.getAttribute('data-cursor') ?? '');
      };
      const out = (event: PointerEvent) => {
        if (!event.relatedTarget) this.on.set(false);
      };
      const press = () => this.down.set(true);
      const lift = () => this.down.set(false);

      const tick = (now: number) => {
        const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
        last = now;
        const t = damp(14, dt);
        trail.x += (target.x - trail.x) * t;
        trail.y += (target.y - trail.y) * t;
        // Alcançou o ponteiro: encosta e dorme até o próximo movimento.
        const resting = Math.abs(target.x - trail.x) < 0.1 && Math.abs(target.y - trail.y) < 0.1;
        if (resting) {
          trail.x = target.x;
          trail.y = target.y;
        }
        this.ring().nativeElement.style.translate = `${trail.x}px ${trail.y}px`;
        frame = resting ? 0 : requestAnimationFrame(tick);
      };
      const wake = () => {
        if (frame) return;
        last = 0;
        frame = requestAnimationFrame(tick);
      };

      window.addEventListener('pointermove', move, { passive: true });
      document.addEventListener('pointerover', over, { passive: true });
      document.addEventListener('pointerout', out, { passive: true });
      window.addEventListener('pointerdown', press, { passive: true });
      window.addEventListener('pointerup', lift, { passive: true });

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', move);
        document.removeEventListener('pointerover', over);
        document.removeEventListener('pointerout', out);
        window.removeEventListener('pointerdown', press);
        window.removeEventListener('pointerup', lift);
        document.documentElement.classList.remove('lp-cursor');
      };
    });

    destroyRef.onDestroy(() => cleanup());
  }
}
