import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ROLES } from '../../../../core/auth/auth.models';
import { MenuService } from '../../../../core/menu/menu.service';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Menu, Role } from '../../admin.models';
import { MenuAdminService, RoleService } from '../../admin.services';

export interface RoleMenusDialogData {
  role: Role;
}

interface MenuOption {
  menu: Menu;
  initial: boolean;
  control: FormControl<boolean>;
}

interface MenuGroup extends MenuOption {
  children: MenuOption[];
}

// El menú es una lista blanca (menu_role): el rol ve solo lo marcado. Un ítem necesita también
// su grupo marcado, por eso marcar un ítem marca el grupo y desmarcar el grupo desmarca sus ítems.
// El rol M-BOS ve siempre todo.
@Component({
  selector: 'app-role-menus-dialog',
  imports: [ReactiveFormsModule, Checkbox, Dialog, Skeleton, TranslatePipe],
  template: `
    <app-dialog
      [title]="'admin.roles.menusTitle' | translate: { name: role.name }"
      [saveDisabled]="locked || loading() || saving()"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <div class="flex flex-col gap-3">
        @if (locked) {
          <p class="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">{{ 'admin.roles.protectedMenus' | translate }}</p>
        }
        @if (loading()) {
          @for (_ of [1, 2, 3]; track $index) {
            <app-skeleton height="3rem" />
          }
        }
        @for (group of groups(); track group.menu.menuId) {
          <div class="flex flex-col gap-2 rounded-md border border-border px-3 py-2">
            <app-checkbox [formControl]="group.control">
              <span class="font-medium">{{ label(group.menu) }}</span>
            </app-checkbox>
            @if (group.children.length) {
              <div class="flex flex-col gap-2 pl-6">
                @for (child of group.children; track child.menu.menuId) {
                  <app-checkbox [formControl]="child.control">{{ label(child.menu) }}</app-checkbox>
                }
              </div>
            }
          </div>
        }
      </div>
    </app-dialog>
  `,
})
export class RoleMenusDialog extends FormDialog {
  protected readonly role = inject<RoleMenusDialogData>(DIALOG_DATA).role;
  protected readonly dialogRef = inject(DialogRef<boolean, RoleMenusDialog>);
  private readonly roleService = inject(RoleService);
  private readonly menuAdminService = inject(MenuAdminService);
  private readonly menuService = inject(MenuService);

  protected readonly locked = this.role.name === ROLES.admin;
  protected readonly loading = signal(true);
  protected readonly groups = signal<MenuGroup[]>([]);

  constructor() {
    super();
    void this.load();
  }

  protected label(menu: Menu): string {
    return menu.translationKey ? this.languageService.t(menu.translationKey) : menu.name;
  }

  private async load(): Promise<void> {
    try {
      const [menus, assigned] = await Promise.all([this.menuAdminService.all(), this.roleService.menus(this.role.roleId)]);
      const assignedIds = new Set(assigned.map((m) => m.menuId));
      const option = (menu: Menu): MenuOption => ({
        menu,
        initial: assignedIds.has(menu.menuId),
        control: new FormControl({ value: assignedIds.has(menu.menuId), disabled: this.locked }, { nonNullable: true }),
      });
      const byOrder = (a: Menu, b: Menu) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name);

      const groups: MenuGroup[] = menus
        .filter((m) => m.parentMenuId === null)
        .sort(byOrder)
        .map((menu) => ({ ...option(menu), children: menus.filter((c) => c.parentMenuId === menu.menuId).sort(byOrder).map(option) }));

      for (const group of groups) {
        group.control.valueChanges.subscribe((checked) => {
          if (!checked) group.children.forEach((c) => c.control.setValue(false, { emitEvent: false }));
        });
        for (const child of group.children) {
          child.control.valueChanges.subscribe((checked) => checked && group.control.setValue(true, { emitEvent: false }));
        }
      }
      this.groups.set(groups);
    } catch {
      this.toastService.show(this.languageService.t('common.loadError'));
      this.dialogRef.close(false);
    } finally {
      this.loading.set(false);
    }
  }

  protected save(): Promise<void> {
    if (this.locked || this.loading()) {
      return Promise.resolve();
    }
    const changes = this.groups()
      .flatMap((g) => [g, ...g.children])
      .filter((o) => o.control.value !== o.initial);
    return this.submit(async () => {
      for (const change of changes) {
        if (change.control.value) {
          await this.roleService.assignMenu(this.role.roleId, change.menu.menuId);
        } else {
          await this.roleService.removeMenu(this.role.roleId, change.menu.menuId);
        }
        change.initial = change.control.value;
      }
      // Si el rol editado es uno de los míos, el menú lateral cambia.
      void this.menuService.loadMyMenu();
    });
  }
}
