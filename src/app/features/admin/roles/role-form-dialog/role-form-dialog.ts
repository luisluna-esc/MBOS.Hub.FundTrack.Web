import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Textarea } from '../../../../shared/components/textarea/textarea';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Role } from '../../admin.models';
import { RoleService } from '../../admin.services';

export interface RoleFormDialogData {
  role: Role | null;
}

@Component({
  selector: 'app-role-form-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, AppInput, Textarea, TranslatePipe],
  template: `
    <app-dialog
      [title]="(role ? 'admin.roles.editTitle' : 'admin.roles.newTitle') | translate"
      [saveDisabled]="saveDisabled()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <app-input formControlName="name" [label]="'catalogs.columns.name' | translate" [required]="true" [maxLength]="50" />
        <app-textarea formControlName="description" [label]="'admin.columns.description' | translate" [maxLength]="250" />
        @if (!role) {
          <p class="text-xs text-muted-foreground">{{ 'admin.roles.newRoleHint' | translate }}</p>
        }
        <app-checkbox formControlName="isActive">{{ 'catalogs.active' | translate }}</app-checkbox>
      </form>
    </app-dialog>
  `,
})
export class RoleFormDialog extends FormDialog {
  protected readonly role = inject<RoleFormDialogData>(DIALOG_DATA).role;
  protected readonly dialogRef = inject(DialogRef<boolean, RoleFormDialog>);
  private readonly roleService = inject(RoleService);

  protected readonly form = new FormGroup({
    name: new FormControl(this.role?.name ?? '', { nonNullable: true, validators: Validators.required }),
    description: new FormControl(this.role?.description ?? ''),
    isActive: new FormControl(this.role?.isActive ?? true, { nonNullable: true }),
  });

  constructor() {
    super();
    this.watch(this.form);
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const role: Role = { roleId: this.role?.roleId ?? 0, name: raw.name.trim(), description: this.text(raw.description), isActive: raw.isActive };
    return this.submit(() => (this.role ? this.roleService.update(role) : this.roleService.create(role)));
  }
}
