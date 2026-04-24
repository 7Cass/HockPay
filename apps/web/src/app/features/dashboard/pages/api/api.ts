import { Component } from '@angular/core';
import { ApiKeys } from '../api-keys/api-keys';

@Component({
  selector: 'app-api',
  standalone: true,
  imports: [ApiKeys],
  templateUrl: './api.html',
})
export class Api {}
