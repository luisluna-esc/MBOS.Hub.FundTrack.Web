import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ROLES } from '../../../../core/auth/auth.models';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AppUser, Role } from '../../admin.models';
import { AppUserService, RoleService } from '../../admin.services';

export interface UserRolesDialogData {
  user: AppUser;
}

interface RoleOption {
  role: Role;
  initial: boolean;
  control: FormControl<boolean>;
}

// Cada casilla que cambia es un POST o DELETE a /api/appusers/{id}/roles/{roleId}. Con varios
// roles, el usuario elige en la barra lateral con cuál trabaja.
@Component({
  selector: 'app-user-roles-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, Skeleton, TranslatePipe],
  template: `
    <app-dialog
      [title]="'admin.users.rolesTitle' | translate: { name: user.fullName }"
      [saveDisabled]="saving() || loading()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <div class="flex flex-col gap-3">
        @if (loading()) {
          @for (_ of [1, 2, 3]; track $index) {
            <app-skeleton height="3rem" />
          }
        } @else {
          @for (option of options(); track option.role.roleId) {
            <div class="flex flex-col gap-0.5 rounded-md border border-border px-3 py-2">
              <app-checkbox [formControl]="option.control">{{ option.role.name }}</app-checkbox>
              @if (option.role.description) {
                <span class="pl-13 text-xs text-muted-foreground">{{ option.role.description }}</span>
              }
            </div>
          }
          @if (pastorWithoutLink()) {
            <p class="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">{{ 'admin.users.pastorRoleNeedsLink' | translate }}</p>
          }
        }
      </div>
    </app-dialog>
  `,
})
export class UserRolesDialog extends FormDialog {
  protected readonly user = inject<UserRolesDialogData>(DIALOG_DATA).user;
  protected readonly dialogRef = inject(DialogRef<boolean, UserRolesDialog>);
  private readonly appUserService = inject(AppUserService);
  private readonly roleService = inject(RoleService);

  protected readonly loading = signal(true);
  protected readonly options = signal<RoleOption[]>([]);
  private readonly pastorChecked = signal(false);

  /** El rol Pastor filtra por distrito a través del pastor vinculado: sin vínculo no vería nada. */
  protected readonly pastorWithoutLink = computed(() => this.pastorChecked() && !this.user.pastorId);

  constructor() {
    super();
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [roles, assigned] = await Promise.all([this.roleService.all(), this.appUserService.roles(this.user.appUserId)]);
      const assignedIds = new Set(assigned.map((r) => r.roleId));
      const options = roles
        .filter((role) => role.isActive || assignedIds.has(role.roleId))
        .map((role) => ({ role, initial: assignedIds.has(role.roleId), control: new FormControl(assignedIds.has(role.roleId), { nonNullable: true }) }));
      const pastor = options.find((o) => o.role.name === ROLES.pastor);
      if (pastor) {
        this.pastorChecked.set(pastor.control.value);
        pastor.control.valueChanges.subscribe((checked) => this.pastorChecked.set(checked));
      }
      this.options.set(options);
    } catch {
      this.toastService.show(this.languageService.t('common.loadError'));
      this.dialogRef.close(false);
    } finally {
      this.loading.set(false);
    }
  }

  protected save(): Promise<void> {
    if (this.loading()) {
      return Promise.resolve();
    }
    const changes = this.options().filter((o) => o.control.value !== o.initial);
    return this.submit(async () => {
      for (const change of changes) {
        if (change.control.value) {
          await this.appUserService.assignRole(this.user.appUserId, change.role.roleId);
        } else {
          await this.appUserService.removeRole(this.user.appUserId, change.role.roleId);
        }
        change.initial = change.control.value;
      }
    });
  }
}
