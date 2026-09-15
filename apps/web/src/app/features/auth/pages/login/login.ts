import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../../core/services/auth.service';
import { Reveal } from '../../../../shared/directives/reveal';
import { AuthStage } from '../../../../shared/layouts/auth-layout/auth-stage';

type FieldName = 'email' | 'password';

@Component({
  selector: 'app-login',
  imports: [RouterLink, ReactiveFormsModule, Reveal],
  templateUrl: './login.html',
  styleUrl: '../../auth-form.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly stage = inject(AuthStage);

  protected readonly isLoading = signal(false);
  protected readonly showPassword = signal(false);
  /** What the server said when it refused, kept on screen until the form changes. */
  protected readonly failure = signal('');
  /** Arrived straight from register: the e-mail is already filled in, and the page says so. */
  protected readonly justCreated = signal(false);

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.stage.open('Sessão', 'POST /auth/login');

    const created = this.router.currentNavigation()?.extras.state?.['email'];
    if (typeof created === 'string' && created) {
      this.loginForm.patchValue({ email: created });
      this.justCreated.set(true);
      this.stage.draft(created);
    }

    this.loginForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ email, password }) => {
      if (this.isLoading()) return;
      this.failure.set('');
      this.stage.draft(email || (password ? '••••••' : ''));
    });
  }

  /** A field only turns red once the visitor has left it (or tried to submit). */
  protected showError(name: FieldName): boolean {
    const control = this.loginForm.get(name);
    return !!control && control.invalid && control.touched;
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.isLoading()) return;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.stage.settle({
        ok: false,
        status: 400,
        state: 'INVALID',
        event: 'session.invalid',
        note: 'revise os campos marcados',
      });
      return;
    }

    this.isLoading.set(true);
    this.failure.set('');
    this.stage.send('session.requested');
    const { email, password } = this.loginForm.getRawValue();

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: () => {
        this.stage.settle({
          ok: true,
          status: 200,
          state: 'AUTHORIZED',
          event: 'session.created',
          note: 'abrindo o dashboard',
        });
        setTimeout(() => this.router.navigate(['/dashboard']), this.stage.linger());
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const raw: string | undefined = err.error?.error?.message;
        // A API responde em inglês; quem está entrando lê em português. O
        // texto cru do servidor fica no log do palco, que é para devs.
        const message =
          err.status === 401
            ? 'e-mail ou senha incorretos'
            : raw || (err.status === 0 ? 'o servidor não respondeu' : 'não foi possível entrar');
        this.failure.set(message);
        this.stage.settle({
          ok: false,
          status: err.status,
          state: 'DENIED',
          event: 'session.denied',
          note: raw || message,
        });
      },
    });
  }
}
