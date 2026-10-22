import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api-error';
import { LanguageService } from '../../../core/i18n/language.service';
import { ToastService } from '../../../core/toast/toast.service';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../shared/components/input/input';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const matchesNewPassword = (group: AbstractControl): ValidationErrors | null => {
  const { newPassword, confirmPassword } = (group as FormGroup).controls;
  return newPassword.value && confirmPassword.value && newPassword.value !== confirmPassword.value ? { mismatch: true } : null;
};

// Mismas reglas que PasswordValidator y ChangePasswordRequestValidator del backend:
// de 8 a 100 caracteres y distinta de la actual.
@Component({
  selector: 'app-change-password-dialog',
  imports: [ReactiveFormsModule, Dialog, AppInput, TranslatePipe],
  template: `
    <app-dialog
      [title]="'account.changePassword' | translate"
      [saveDisabled]="saveDisabled()"
      (save)="onSave()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <app-input formControlName="currentPassword" type="password" [label]="'account.currentPassword' | translate" [required]="true" />
        <app-input formControlName="newPassword" type="password" [label]="'account.newPassword' | translate" [required]="true" [minLength]="8" [maxLength]="100" />
        <app-input
          formControlName="confirmPassword"
          type="password"
          [label]="'account.confirmPassword' | translate"
          [required]="true"
          [externalError]="mismatch() ? ('account.mismatch' | translate) : null"
        />
      </form>
    </app-dialog>
  `,
})
export class ChangePasswordDialog {
  protected readonly dialogRef = inject(DialogRef<boolean, ChangePasswordDialog>);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup(
    {
      currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
      newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(100)] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    },
    { validators: matchesNewPassword }
  );

  private readonly status = toSignal(this.form.statusChanges.pipe(startWith(this.form.status), map(() => this.form.errors), takeUntilDestroyed()), {
    initialValue: null,
  });
  protected readonly mismatch = computed(() => !!this.status()?.['mismatch']);
  private readonly invalid = toSignal(this.form.statusChanges.pipe(startWith(this.form.status), map((s) => s !== 'VALID'), takeUntilDestroyed()), {
    initialValue: true,
  });
  protected readonly saveDisabled = computed(() => this.invalid() || this.saving());

  protected async onSave(): Promise<void> {
    if (this.saveDisabled()) {
      return;
    }
    this.saving.set(true);
    const { currentPassword, newPassword } = this.form.getRawValue();
    try {
      await this.authService.changePassword({ currentPassword, newPassword });
      this.toastService.show(this.languageService.t('account.changed'));
      this.dialogRef.close(true);
    } catch (error) {
      this.toastService.show(this.languageService.t('common.saveError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.saving.set(false);
    }
  }
}
