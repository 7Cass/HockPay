import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert } from '@ng-icons/lucide';
import { ApiKeys } from '../api-keys/api-keys';

@Component({
  selector: 'app-api',
  standalone: true,
  imports: [ApiKeys, NgIcon],
  providers: [provideIcons({ lucideCircleAlert })],
  templateUrl: './api.html',
  styleUrl: './api.css',
})
export class Api {}
