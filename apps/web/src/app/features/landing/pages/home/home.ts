import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCheckCircle2,
  lucideClock,
  lucideCode2,
  lucideCreditCard,
  lucideKey,
  lucideNetwork,
  lucideRefreshCcw,
  lucideSend,
  lucideShieldCheck,
  lucideTestTubeDiagonal,
  lucideWebhook,
  lucideXCircle,
} from '@ng-icons/lucide';
import { HlmIconImports } from '@spartan-ng/helm/icon';

@Component({
  selector: 'app-home',
  imports: [RouterLink, HlmIconImports],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideCheckCircle2,
      lucideClock,
      lucideCode2,
      lucideCreditCard,
      lucideKey,
      lucideNetwork,
      lucideRefreshCcw,
      lucideSend,
      lucideShieldCheck,
      lucideTestTubeDiagonal,
      lucideWebhook,
      lucideXCircle,
    }),
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home { }
