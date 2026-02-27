import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

// Spartan UI
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmFormFieldImports } from '@spartan-ng/helm/form-field';
import { provideIcons } from '@ng-icons/core';
import { lucideGithub, lucideLoader2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

// Services
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    HlmInputImports,
    HlmLabelImports,
    HlmButtonImports,
    HlmIconImports,
    HlmFormFieldImports,
  ],
  providers: [provideIcons({ lucideGithub, lucideLoader2 })],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // State
  isLoading = signal(false);

  // Form
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async onSubmit() {
    if (this.loginForm.invalid) {
      toast.error('Preencha os campos corretamente.');
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const { email, password } = this.loginForm.getRawValue();

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: () => {
        toast.success('Login efetuado com sucesso!');
        this.router.navigate(['/dashboard']); // Redirect to dashboard
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const errorMessage =
          err.status === 401
            ? 'Credenciais inválidas'
            : 'Erro ao conectar com o servidor.';
        toast.error(errorMessage);
      },
    });
  }
}
