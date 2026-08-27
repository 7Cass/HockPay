import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { HlmToaster } from '../../../../../libs/ui/sonner/src';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, NgIcon, HlmToaster],
  providers: [provideIcons({ lucideArrowLeft })],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {
  /** A sample of what a fresh sandbox delivers, shown beside the form. */
  protected readonly proof = [
    { event: 'payment.confirmed', note: '200 OK · 42ms', tone: 'ok' },
    { event: 'payment.failed', note: 'reentregue 1×', tone: 'bad' },
    { event: 'payment.expired', note: 'após 5 min', tone: 'warn' },
  ] as const;
}
