import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideEye, lucideEyeOff, lucideLoader2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

import { AuthService } from '../../../../core/services/auth.service';
import { Reveal } from '../../../../shared/directives/reveal';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule, NgIcon, Reveal],
  providers: [provideIcons({ lucideArrowRight, lucideEye, lucideEyeOff, lucideLoader2 })],
  templateUrl: './login.html',
  styleUrl: '../../auth-form.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** A field only turns red once the visitor has left it (or tried to submit). */
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

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: () => {
        toast.success('Login efetuado com sucesso!');
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        toast.error(err.error?.error?.message || 'Erro ao conectar com o servidor.');
      },
    });
  }
}
