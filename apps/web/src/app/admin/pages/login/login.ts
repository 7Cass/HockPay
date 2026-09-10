import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff, lucideShieldCheck } from '@ng-icons/lucide';

import { OperatorAuthService } from '../../services/operator-auth.service';
import {
  AdmBrandMark,
  AdmButton,
  AdmField,
  AdmThemeService,
  AdmToastService,
  AdmToaster,
} from '../../ui';

/**
 * A porta do admin.
 *
 * É uma tela inteira, fora do `auth-layout` do lojista: a entrada do admin não
 * oferece "criar sandbox" nem volta para o site, e emprestar a casca do lojista
 * faria as duas parecerem a mesma porta com dois cadeados.
 *
 * O desenho segue a mesma regra: não é o cartão de marca do lojista com as
 * cores trocadas, é a superfície do admin — o mesmo cinza, a mesma borda e o
 * mesmo campo que o operador vai ver do outro lado da porta. Inclusive o tema:
 * quem escolheu escuro na mesa entra por uma porta escura, porque o
 * `adm-root` aqui é o mesmo do shell.
 */
@Component({
  selector: 'app-operator-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIcon, AdmBrandMark, AdmButton, AdmField, AdmToaster],
  providers: [provideIcons({ lucideEye, lucideEyeOff, lucideShieldCheck })],
  templateUrl: './login.html',
  styleUrl: './login.css',
  host: {
    class: 'adm-root',
    '[attr.data-adm-theme]': 'theme.theme()',
    '[attr.data-adm-density]': 'theme.density()',
  },
})
export class OperatorLogin {
  protected readonly theme = inject(AdmThemeService);
  private readonly fb = inject(FormBuilder);
  private readonly operatorAuth = inject(OperatorAuthService);
  private readonly toast = inject(AdmToastService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected error(name: 'email' | 'password'): string {
    const control = this.loginForm.get(name);
    if (!control || control.valid || !control.touched) return '';

    return name === 'email' ? 'Informe um e-mail válido.' : 'A senha é obrigatória.';
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.toast.bad('Preencha os campos corretamente.');
      return;
    }

    this.isLoading.set(true);
    const { email, password } = this.loginForm.getRawValue();

    this.operatorAuth.login({ email: email!, password: password! }).subscribe({
      next: () => {
        void this.router.navigate(['/operator']);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.toast.bad(err.error?.error?.message || 'Credenciais inválidas.');
      },
    });
  }
}
