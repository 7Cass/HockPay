import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { OrganicBlob } from '../../../features/landing/components/organic-blob/organic-blob';
import { MOODS, MoodName, blobPath } from '../../../features/landing/motion/blob';
import { applyNightChrome } from '../../night-chrome';
import { AuthStage } from './auth-stage';

/** The page takes the color of how the request ended; bone while it hasn't. */
const ACCENTS: Partial<Record<MoodName, string>> = {
  confirmed: 'var(--color-ok-bright)',
  failed: 'var(--color-bad-bright)',
};

/**
 * The shell around login and register, in the landing's night: the organism
 * on one side acting out the request the form on the other side is building.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, OrganicBlob],
  providers: [AuthStage],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {
  protected readonly stage = inject(AuthStage);
  protected readonly accent = computed(() => ACCENTS[this.stage.mood()] ?? 'var(--color-bone)');

  /** The brand: a small organism, still, in the page's color. */
  protected readonly mark = blobPath(MOODS.confirmed, 0.8, 11);

  constructor() {
    applyNightChrome();
  }
}
