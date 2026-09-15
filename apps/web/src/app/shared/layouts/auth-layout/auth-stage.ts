import { Injectable, signal } from '@angular/core';
import type { MoodName } from '../../../features/landing/motion/blob';

export type StageTone = 'neutral' | 'ok' | 'bad';

export interface StageLine {
  readonly id: number;
  readonly name: string;
  readonly note: string;
  readonly tone: StageTone;
}

export interface StageFace {
  /** What the request is for: "Sessão", "Sandbox". */
  readonly label: string;
  /** The big line inside the organism: the HTTP status, once there is one. */
  readonly code: string;
  readonly state: string;
  /** What the request will carry, echoed as the visitor types. */
  readonly meta: string;
}

export interface StageEnding {
  readonly ok: boolean;
  /** The HTTP status; 0 when the server never answered. */
  readonly status: number;
  readonly state: string;
  readonly event: string;
  readonly note: string;
}

const LOG_SIZE = 4;
const LINGER_MS = 700;

/**
 * The auth screens' stage: the organism beside the form, told by the page in
 * front of it what its request is doing — drafted, sent, and how it ended.
 *
 * Provided by AuthLayout, so it outlives the switch between login and
 * register: the shape morphs into the next page instead of starting over.
 */
@Injectable()
export class AuthStage {
  readonly mood = signal<MoodName>('idle');
  readonly face = signal<StageFace>({ label: '', code: '—', state: 'IDLE', meta: '' });
  readonly lines = signal<readonly StageLine[]>([]);

  private label = '';
  private endpoint = '';
  private sequence = 0;

  /** A page takes the stage with its own request, still unsent. */
  open(label: string, endpoint: string): void {
    this.label = label;
    this.endpoint = endpoint;
    this.lines.set([]);
    this.show('idle', '—', 'IDLE', endpoint);
  }

  /** The form is being filled in; an empty summary means nothing to send yet. */
  draft(summary: string): void {
    if (summary) this.show('pending', '···', 'DRAFT', summary);
    else this.show('idle', '—', 'IDLE', this.endpoint);
  }

  send(event: string): void {
    this.show('pending', '…', 'PENDING', this.endpoint);
    this.push(event, this.endpoint, 'neutral');
  }

  settle(ending: StageEnding): void {
    const code = ending.status ? String(ending.status) : '—';
    this.show(ending.ok ? 'confirmed' : 'failed', code, ending.state, this.endpoint);
    this.push(`${ending.event} · ${code}`, ending.note, ending.ok ? 'ok' : 'bad');
  }

  /** How long an ending stays on stage before the page moves on: enough to see it bloom. */
  linger(): number {
    const still =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return still ? 0 : LINGER_MS;
  }

  private show(mood: MoodName, code: string, state: string, meta: string): void {
    this.mood.set(mood);
    this.face.set({ label: this.label, code, state, meta });
  }

  private push(name: string, note: string, tone: StageTone): void {
    this.lines.update((list) =>
      [...list, { id: ++this.sequence, name, note, tone }].slice(-LOG_SIZE),
    );
  }
}
