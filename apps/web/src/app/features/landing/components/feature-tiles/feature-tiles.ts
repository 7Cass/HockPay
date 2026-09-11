import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBoxes,
  lucideLink2,
  lucideReceipt,
  lucideRepeat2,
  lucideWallet,
  lucideWebhook,
} from '@ng-icons/lucide';
import { Reveal } from '../../../../shared/directives/reveal';
import { Tilt } from '../../motion/tilt';

export interface Feature {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
}

/** The feature grid: each tile leans toward the pointer and lights up in the page's color. */
@Component({
  selector: 'app-feature-tiles',
  imports: [NgIcon, Reveal, Tilt],
  providers: [
    provideIcons({
      lucideBoxes,
      lucideLink2,
      lucideReceipt,
      lucideRepeat2,
      lucideWallet,
      lucideWebhook,
    }),
  ],
  templateUrl: './feature-tiles.html',
  styleUrl: './feature-tiles.css',
})
export class FeatureTiles {
  readonly features = input.required<readonly Feature[]>();
}
