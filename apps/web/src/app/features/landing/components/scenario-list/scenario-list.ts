import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { clamp, damp, hasFinePointer, prefersReducedMotion } from '../../motion/motion';

export interface Scenario {
  readonly action: string;
  readonly state: string;
  readonly tone: 'ok' | 'bad' | 'warn' | 'neutral';
  readonly event: string;
  readonly validates: string;
  /** What your application receives, shown in the card that follows the pointer. */
  readonly payload: string;
}

/**
 * The endings as an editorial list. Hovering a row floods it with that
 * ending's color, and a card with the event's payload trails the pointer,
 * swinging a little with its speed.
 */
@Component({
  selector: 'app-scenario-list',
  templateUrl: './scenario-list.html',
  styleUrl: './scenario-list.css',
})
export class ScenarioList {
  readonly scenarios = input.required<readonly Scenario[]>();

  protected readonly active = signal(-1);
  protected readonly current = computed(() => this.scenarios()[this.active()] ?? null);

  private readonly peek = viewChild.required<ElementRef<HTMLElement>>('peek');
  private readonly host = inject(ElementRef).nativeElement as HTMLElement;
  private readonly target = { x: 0, y: 0 };
  private readonly pos = { x: 0, y: 0 };
  private enabled = false;
  private shown = false;
  private frame = 0;
  private last = 0;

  constructor() {
    afterNextRender(() => (this.enabled = hasFinePointer() && !prefersReducedMotion()));
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  protected follow(event: PointerEvent): void {
    if (!this.enabled) return;
    const box = this.host.getBoundingClientRect();
    this.target.x = event.clientX - box.left;
    this.target.y = event.clientY - box.top;
    if (!this.shown) {
      this.pos.x = this.target.x;
      this.pos.y = this.target.y;
      this.shown = true;
    }
    if (!this.frame) {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (now: number) => {
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 1 / 60;
    this.last = now;
    const t = damp(9, dt);
    const dx = (this.target.x - this.pos.x) * t;
    this.pos.x += dx;
    this.pos.y += (this.target.y - this.pos.y) * t;

    const swing = clamp(dx * 0.8, -12, 12);
    this.peek().nativeElement.style.transform = `translate3d(${this.pos.x.toFixed(1)}px, ${this.pos.y.toFixed(1)}px, 0) rotate(${swing.toFixed(2)}deg)`;

    const resting =
      Math.abs(this.target.x - this.pos.x) < 0.5 && Math.abs(this.target.y - this.pos.y) < 0.5;
    if (this.active() < 0) this.shown = false;
    if (resting && this.active() < 0) {
      this.frame = 0;
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };
}
