import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { USERNAME_PATTERN, usernameFromFullName } from '../../../../core/auth/username';
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

// Se entra con el usuario nombre.apellido: al crear se arma solo con el nombre completo (se puede
// corregir). La contraseña la pone M-BOS; al editar es opcional y, si se llena, también desbloquea
// la cuenta. No hay "olvidé mi contraseña" ni contraseña temporal.
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
          <app-input
            formControlName="username"
            [label]="'admin.users.username' | translate"
            [required]="true"
            [maxLength]="100"
            [patternRule]="usernamePattern"
            [errorMessages]="{ pattern: ('admin.users.usernameInvalid' | translate) }"
            [hint]="'admin.users.usernameHint' | translate"
          />
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
          [label]="(user ? 'admin.users.newPassword' : 'admin.users.password') | translate"
          [required]="!user"
          [minLength]="8"
          [maxLength]="100"
          [hint]="(user ? 'admin.users.newPasswordHint' : 'admin.users.passwordHint') | translate"
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

  protected readonly usernamePattern = USERNAME_PATTERN;

  protected readonly form = new FormGroup({
    fullName: new FormControl(this.user?.fullName ?? '', { nonNullable: true, validators: Validators.required }),
    username: new FormControl(this.user?.username ?? '', { nonNullable: true, validators: Validators.required }),
    ci: new FormControl(this.user?.ci ?? ''),
    phone: new FormControl(this.user?.phone ?? ''),
    pastorId: new FormControl<string | null>(this.user?.pastorId ? String(this.user.pastorId) : null),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.user ? [Validators.minLength(8), Validators.maxLength(100)] : [Validators.required, Validators.minLength(8), Validators.maxLength(100)],
    }),
    isActive: new FormControl(this.user?.isActive ?? true, { nonNullable: true }),
  });

  /** Al crear, el usuario sigue al nombre completo hasta que alguien lo escribe a mano. */
  private usernameEdited = !!this.user;

  constructor() {
    super();
    this.watch(this.form);
    void this.lookups.load('pastors');

    const { fullName, username, pastorId } = this.form.controls;
    fullName.valueChanges.subscribe((name) => {
      if (!this.usernameEdited) {
        username.setValue(usernameFromFullName(name), { emitEvent: false });
        username.updateValueAndValidity();
      }
    });
    username.valueChanges.subscribe(() => (this.usernameEdited = true));

    // Al vincular un pastor en una cuenta nueva sin nombre, se toma el nombre del pastor.
    pastorId.valueChanges.subscribe((id) => {
      const pastor = this.lookups.pastors().find((p) => String(p.pastorId) === id);
      if (!this.user && pastor && !fullName.value.trim()) {
        fullName.setValue(`${pastor.firstNames} ${pastor.lastNames}`);
      }
    });
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const user: AppUser = {
      appUserId: this.user?.appUserId ?? 0,
      fullName: raw.fullName.trim(),
      username: raw.username.trim().toLowerCase(),
      ci: this.text(raw.ci),
      phone: this.text(raw.phone),
      pastorId: raw.pastorId ? Number(raw.pastorId) : null,
      password: raw.password || null,
      isActive: raw.isActive,
      failedLoginAttempts: this.user?.failedLoginAttempts ?? 0,
      lockedUntil: this.user?.lockedUntil ?? null,
      lastLogin: this.user?.lastLogin ?? null,
    };
    return this.submit(() => (this.user ? this.appUserService.update(user) : this.appUserService.create(user)));
  }
}
