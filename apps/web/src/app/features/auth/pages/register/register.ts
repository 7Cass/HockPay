import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
    ReactiveFormsModule,
    FormBuilder,
    Validators,
    AbstractControl,
    ValidationErrors,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

// Spartan UI
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { provideIcons } from '@ng-icons/core';
import { HlmFormFieldImports } from '@spartan-ng/helm/form-field';
import { lucideGithub, lucideLoader2 } from '@ng-icons/lucide';
import { toast } from 'ngx-sonner';

// Services & Directives
import { MerchantService } from '../../../../core/services/merchant.service';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

// Custom Validator for Passwords Match
function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
        return { noMatch: true };
    }
    return null;
}

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [
        RouterLink,
        ReactiveFormsModule,
        HlmInputImports,
        HlmLabelImports,
        HlmButtonImports,
        HlmIconImports,
        HlmFormFieldImports,
        NgxMaskDirective,
    ],
    providers: [provideIcons({ lucideGithub, lucideLoader2 }), provideNgxMask()],
    templateUrl: './register.html',
})
export class Register {
    private readonly fb = inject(FormBuilder);
    private readonly merchantService = inject(MerchantService);
    private readonly router = inject(Router);

    // State
    isLoading = signal(false);

    // Form
    registerForm = this.fb.group(
        {
            name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
            email: ['', [Validators.required, Validators.email]],
            document: ['', [Validators.required, Validators.minLength(11)]],
            password: ['', [Validators.required, Validators.minLength(8)]],
            confirmPassword: ['', [Validators.required]],
        },
        { validators: passwordsMatchValidator }
    );

    async onSubmit() {
        if (this.registerForm.invalid) {
            toast.error('Preencha os campos corretamente.');
            this.registerForm.markAllAsTouched();
            return;
        }

        this.isLoading.set(true);
        const formValue = this.registerForm.getRawValue();

        this.merchantService
            .create({
                name: formValue.name!,
                email: formValue.email!,
                document: formValue.document!,
                password: formValue.password!,
            })
            .subscribe({
                next: () => {
                    toast.success('Conta criada com sucesso!');
                    this.router.navigate(['/login']);
                },
                error: (err: HttpErrorResponse) => {
                    this.isLoading.set(false);
                    toast.error(
                        err.error?.error?.message || 'Erro ao criar conta. Tente novamente mais tarde.'
                    );
                },
            });
    }
}
