import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Lean, MOODS, Mood, MoodName, blobPath, mixMood } from '../../motion/blob';
import { clamp, damp, prefersReducedMotion } from '../../motion/motion';

const RADIUS = 150;

/**
 * The charge as an organism. It drifts toward the mood it is given, leans
 * toward the pointer, and reacts to every change of mood: a pop when it
 * confirms, a shudder when it fails, a slump when it expires.
 *
 * Paths are written straight to the DOM from a rAF loop that only runs while
 * the shape is on screen. Reduced motion draws each mood once, still.
 */
@Component({
  selector: 'app-organic-blob',
  template: `
    <div class="halo" aria-hidden="true"></div>
    <svg #shape class="shape" viewBox="-210 -210 420 420" aria-hidden="true">
      <path #body class="body" />
      <path #shine class="shine" />
      <path #rim class="rim" />
    </svg>
    <div class="core"><ng-content /></div>
  `,
  styleUrl: './organic-blob.css',
  host: { '[attr.data-mood]': 'mood()' },
})
export class OrganicBlob {
  readonly mood = input.required<MoodName>();

  private readonly shape = viewChild.required<ElementRef<SVGSVGElement>>('shape');
  private readonly body = viewChild.required<ElementRef<SVGPathElement>>('body');
  private readonly shine = viewChild.required<ElementRef<SVGPathElement>>('shine');
  private readonly rim = viewChild.required<ElementRef<SVGPathElement>>('rim');

  private current: Mood = MOODS.idle;
  private time = 0;
  private kick = 0;
  private lean: Lean = { angle: 0, amount: 0 };
  private leanGoal: Lean = { angle: 0, amount: 0 };
  private drift = { x: 0, y: 0 };
  private driftGoal = { x: 0, y: 0 };
  private still = false;
  private ready = false;

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    let frame = 0;
    let last = 0;
    let observer: IntersectionObserver | undefined;

    effect(() => {
      const mood = this.mood();
      this.kick = 1;
      if (this.ready && this.still) this.draw(MOODS[mood]);
    });

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;

      this.current = mixMood(this.current, MOODS[this.mood()], damp(3.2, dt));
      this.time += dt * this.current.speed;
      this.kick *= Math.exp(-3.5 * dt);

      const turn = Math.atan2(
        Math.sin(this.leanGoal.angle - this.lean.angle),
        Math.cos(this.leanGoal.angle - this.lean.angle),
      );
      this.lean = {
        angle: this.lean.angle + turn * damp(6, dt),
        amount: this.lean.amount + (this.leanGoal.amount - this.lean.amount) * damp(5, dt),
      };
      this.drift.x += (this.driftGoal.x - this.drift.x) * damp(4, dt);
      this.drift.y += (this.driftGoal.y - this.drift.y) * damp(4, dt);

      this.draw(this.current);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onPointer = (event: PointerEvent) => {
      const box = host.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const distance = Math.hypot(dx, dy);
      this.leanGoal = {
        angle: Math.atan2(dy, dx),
        amount: clamp(1 - distance / (box.width * 0.9), 0, 1),
      };
      this.driftGoal = { x: clamp(dx * 0.04, -18, 18), y: clamp(dy * 0.04, -18, 18) };
    };

    afterNextRender(() => {
      this.ready = true;
      this.still = prefersReducedMotion();
      this.current = MOODS[this.mood()];
      this.draw(this.current);
      if (this.still || typeof IntersectionObserver === 'undefined') return;

      window.addEventListener('pointermove', onPointer, { passive: true });
      observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
      observer.observe(host);
    });

    destroyRef.onDestroy(() => {
      stop();
      observer?.disconnect();
      window.removeEventListener('pointermove', onPointer);
    });
  }

  private draw(mood: Mood): void {
    const name = this.mood();
    const pop = name === 'confirmed' ? this.kick * 0.1 : name === 'expired' ? -this.kick * 0.06 : 0;
    const shudder = name === 'failed' ? Math.sin(this.time * 60) * this.kick * 10 : 0;
    const shaped = { ...mood, scale: mood.scale * (1 + pop) };
    const d = blobPath(shaped, this.time, RADIUS, this.lean);

    this.body().nativeElement.setAttribute('d', d);
    this.shine().nativeElement.setAttribute('d', d);
    this.rim().nativeElement.setAttribute(
      'd',
      blobPath({ ...shaped, scale: shaped.scale * 1.08 }, this.time * 0.8 + 2, RADIUS, this.lean),
    );
    this.shape().nativeElement.style.transform = `translate(${(this.drift.x + shudder).toFixed(1)}px, ${this.drift.y.toFixed(1)}px)`;
  }
}
