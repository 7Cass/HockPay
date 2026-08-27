import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideEye, lucideEyeOff, lucideLoader2 } from '@ng-icons/lucide';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { toast } from 'ngx-sonner';

import { MerchantService } from '../../../../core/services/merchant.service';
import { Reveal } from '../../../../shared/directives/reveal';

type FieldName = 'name' | 'email' | 'document' | 'password' | 'confirmPassword';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { noMatch: true } : null;
}

@Component({
  selector: 'app-register',
  imports: [RouterLink, ReactiveFormsModule, NgIcon, NgxMaskDirective, Reveal],
  providers: [
    provideIcons({ lucideArrowRight, lucideEye, lucideEyeOff, lucideLoader2 }),
    provideNgxMask(),
  ],
  templateUrl: './register.html',
  styleUrl: '../../auth-form.css',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly merchantService = inject(MerchantService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal(false);
  protected readonly showPassword = signal(false);

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
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      toast.error('Preencha os campos corretamente.');
      return;
    }

    this.isLoading.set(true);
    const { name, email, document, password } = this.registerForm.getRawValue();

    this.merchantService
      .create({ name: name!, email: email!, document: document!, password: password! })
      .subscribe({
        next: () => {
          toast.success('Conta criada com sucesso!');
          this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);
          toast.error(
            err.error?.error?.message || 'Erro ao criar conta. Tente novamente mais tarde.',
          );
        },
      });
  }
}
