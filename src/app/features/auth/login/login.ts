import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { map, startWith } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { Input as AppInput } from '../../../shared/components/input/input';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, AppInput, TranslatePipe],
  templateUrl: './login.html',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);

  // Se entra con el usuario nombre.apellido.
  protected readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: Validators.required }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected readonly formInvalid = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: true }
  );

  protected onSubmit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);

    const { username, password } = this.form.getRawValue();
    this.authService.login({ username: username.trim().toLowerCase(), password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.toastService.show(this.languageService.t('login.error'), apiErrorMessage(error) ?? undefined);
      },
    });
  }
}
