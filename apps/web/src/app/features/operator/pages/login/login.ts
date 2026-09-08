import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideEye, lucideEyeOff, lucideLoader2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

import { HlmToaster } from '../../../../../../libs/ui/sonner/src';
import { OperatorAuthService } from '../../../../core/services/operator-auth.service';

/**
 * A porta da mesa.
 *
 * É uma tela inteira, fora do `auth-layout` do lojista: a entrada da mesa não
 * oferece "criar sandbox" nem volta para o site, e emprestar a casca do
 * lojista faria as duas parecerem a mesma porta com dois cadeados.
 */
@Component({
  selector: 'app-operator-login',
  standalone: true,
  imports: [ReactiveFormsModule, NgIcon, HlmToaster],
  providers: [provideIcons({ lucideArrowRight, lucideEye, lucideEyeOff, lucideLoader2 })],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class OperatorLogin {
  private readonly fb = inject(FormBuilder);
  private readonly operatorAuth = inject(OperatorAuthService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected showError(name: 'email' | 'password'): boolean {
    const control = this.loginForm.get(name);
    return !!control && control.invalid && control.touched;
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      toast.error('Preencha os campos corretamente.');
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
        toast.error(err.error?.error?.message || 'Credenciais inválidas.');
      },
    });
  }
}
