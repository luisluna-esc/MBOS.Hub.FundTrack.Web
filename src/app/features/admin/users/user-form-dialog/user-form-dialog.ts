import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select } from '../../../../shared/components/select/select';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../../catalogs/catalog-lookups';
import { AppUser } from '../../admin.models';
import { AppUserService } from '../../admin.services';

export interface UserFormDialogData {
  user: AppUser | null;
}

// La contraseña que pone el administrador es temporal: el usuario la cambia al entrar.
// Al editar es opcional; si se llena, además desbloquea la cuenta. No hay "olvidé mi contraseña".
@Component({
  selector: 'app-user-form-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, Select, TranslatePipe],
  template: `
    <app-dialog
      [title]="(user ? 'admin.users.editTitle' : 'admin.users.newTitle') | translate"
      [saveDisabled]="saveDisabled()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-input formControlName="fullName" [label]="'catalogs.columns.fullName' | translate" [required]="true" [maxLength]="150" />
          <app-input formControlName="email" type="email" [label]="'catalogs.columns.email' | translate" [required]="true" [maxLength]="150" />
          <app-input formControlName="ci" [label]="'catalogs.columns.ci' | translate" [maxLength]="20" />
          <app-input formControlName="phone" type="tel" [label]="'catalogs.columns.phone' | translate" [maxLength]="30" />
        </div>
        <app-select
          formControlName="pastorId"
          [label]="'admin.users.linkedPastor' | translate"
          [options]="lookups.pastorOptions()"
          [hint]="'admin.users.linkedPastorHint' | translate"
        />
        <app-input
          formControlName="password"
          type="password"
          [label]="(user ? 'admin.users.newPassword' : 'admin.users.tempPassword') | translate"
          [required]="!user"
          [minLength]="8"
          [maxLength]="100"
          [hint]="(user ? 'admin.users.newPasswordHint' : 'admin.users.tempPasswordHint') | translate"
        />
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class UserFormDialog extends FormDialog {
  protected readonly user = inject<UserFormDialogData>(DIALOG_DATA).user;
  protected readonly dialogRef = inject(DialogRef<boolean, UserFormDialog>);
  private readonly appUserService = inject(AppUserService);
  protected readonly lookups = inject(CatalogLookups);

  protected readonly form = new FormGroup({
    fullName: new FormControl(this.user?.fullName ?? '', { nonNullable: true, validators: Validators.required }),
    email: new FormControl(this.user?.email ?? '', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    ci: new FormControl(this.user?.ci ?? ''),
    phone: new FormControl(this.user?.phone ?? ''),
    pastorId: new FormControl<string | null>(this.user?.pastorId ? String(this.user.pastorId) : null),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.user ? [Validators.minLength(8), Validators.maxLength(100)] : [Validators.required, Validators.minLength(8), Validators.maxLength(100)],
    }),
    isActive: new FormControl(this.user?.isActive ?? true, { nonNullable: true }),
  });

  constructor() {
    super();
    this.watch(this.form);
    void this.lookups.load('pastors');
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const user: AppUser = {
      appUserId: this.user?.appUserId ?? 0,
      fullName: raw.fullName.trim(),
      email: raw.email.trim(),
      ci: this.text(raw.ci),
      phone: this.text(raw.phone),
      pastorId: raw.pastorId ? Number(raw.pastorId) : null,
      password: raw.password || null,
      isActive: raw.isActive,
      mustChangePassword: this.user?.mustChangePassword ?? true,
      failedLoginAttempts: this.user?.failedLoginAttempts ?? 0,
      lockedUntil: this.user?.lockedUntil ?? null,
      lastLogin: this.user?.lastLogin ?? null,
    };
    return this.submit(() => (this.user ? this.appUserService.update(user) : this.appUserService.create(user)));
  }
}
