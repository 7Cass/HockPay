import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToaster } from '../../../../../libs/ui/sonner/src';

@Component({
    selector: 'app-auth-layout',
    imports: [RouterOutlet, HlmToaster],
    templateUrl: './auth-layout.html',
})
export class AuthLayout { }
