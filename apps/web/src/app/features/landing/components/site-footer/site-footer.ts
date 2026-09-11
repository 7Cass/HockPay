import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../../../../shared/directives/reveal';

/** The landing's footer: the fine print, the links, and the name rising in giant letters. */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, Reveal],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.css',
})
export class SiteFooter {
  readonly links = input.required<readonly { readonly href: string; readonly label: string }[]>();
  readonly clock = input.required<string>();

  protected readonly wordmark = Array.from('hockpay');
}
