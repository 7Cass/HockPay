import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

import { MerchantService } from '../../../../core/services/merchant.service';
import { Reveal } from '../../../../shared/directives/reveal';
import { AuthStage } from '../../../../shared/layouts/auth-layout/auth-stage';

type FieldName = 'name' | 'email' | 'document' | 'password' | 'confirmPassword';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { noMatch: true } : null;
}

@Component({
  selector: 'app-register',
  imports: [RouterLink, ReactiveFormsModule, NgxMaskDirective, Reveal],
  providers: [provideNgxMask()],
  templateUrl: './register.html',
  styleUrl: '../../auth-form.css',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly merchantService = inject(MerchantService);
  private readonly router = inject(Router);
  private readonly stage = inject(AuthStage);

  protected readonly isLoading = signal(false);
  protected readonly showPassword = signal(false);
  /** What the server said when it refused, kept on screen until the form changes. */
  protected readonly failure = signal('');

  protected readonly registerForm = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      document: ['', [Validators.required, Validators.minLength(11)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  constructor() {
    this.stage.open('Sandbox', 'POST /merchants');

    this.registerForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(({ name, email, document, password }) => {
        if (this.isLoading()) return;
        this.failure.set('');
        this.stage.draft(name || email || (document || password ? '••••••' : ''));
      });
  }

  /** A field only turns red once the visitor has left it (or tried to submit). */
  protected showError(name: FieldName): boolean {
    const control = this.registerForm.get(name);
    return !!control && control.invalid && control.touched;
  }

  /** The mismatch lives on the group, so it is reported under the confirmation field. */
  protected showMismatch(): boolean {
    const control = this.registerForm.get('confirmPassword');
    return !!control && control.touched && this.registerForm.hasError('noMatch');
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.isLoading()) return;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.stage.settle({
        ok: false,
        status: 400,
        state: 'INVALID',
        event: 'merchant.invalid',
        note: 'revise os campos marcados',
      });
      return;
    }

    this.isLoading.set(true);
    this.failure.set('');
    this.stage.send('merchant.requested');
    const { name, email, document, password } = this.registerForm.getRawValue();

    this.merchantService
      .create({ name: name!, email: email!, document: document!, password: password! })
      .subscribe({
        next: () => {
          this.stage.settle({
            ok: true,
            status: 201,
            state: 'CREATED',
            event: 'merchant.created',
            note: 'chaves TEST emitidas',
          });
          // O login abre com o e-mail preenchido; pelo estado da navegação, não pela URL.
          setTimeout(
            () => this.router.navigate(['/login'], { state: { email } }),
            this.stage.linger(),
          );
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);
          const message =
            err.error?.error?.message ||
            (err.status === 0 ? 'o servidor não respondeu' : 'não foi possível criar a conta');
          this.failure.set(message);
          this.stage.settle({
            ok: false,
            status: err.status,
            state: 'REJECTED',
            event: 'merchant.rejected',
            note: message,
          });
        },
      });
  }
}
