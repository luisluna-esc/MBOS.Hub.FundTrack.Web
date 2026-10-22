import { DialogRef } from '@angular/cdk/dialog';
import { DestroyRef, Directive, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { startWith } from 'rxjs';
import { apiErrorMessage } from '../../core/http/api-error';
import { LanguageService } from '../../core/i18n/language.service';
import { ToastService } from '../../core/toast/toast.service';

// Base de los diálogos que guardan algo en el backend (igual que los formularios de CheckInvoice):
// el botón Guardar queda bloqueado mientras el formulario es inválido o se está guardando; al
// guardar bien muestra el aviso y cierra con `true` para que la lista recargue; si el backend
// rechaza, muestra sus mensajes y el diálogo sigue abierto.
@Directive()
export abstract class FormDialog {
  protected abstract readonly dialogRef: Pick<DialogRef<boolean>, 'close'>;

  protected readonly languageService = inject(LanguageService);
  protected readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  private readonly invalid = signal(false);
  protected readonly saveDisabled = computed(() => this.invalid() || this.saving());

  /** Sigue la validez del formulario (o de un control suelto) para el botón Guardar. */
  protected watch(control: AbstractControl): void {
    control.statusChanges.pipe(startWith(control.status), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.invalid.set(control.invalid));
  }

  protected async submit(action: () => Promise<unknown>, successKey = 'common.saved'): Promise<void> {
    if (this.saveDisabled()) {
      return;
    }
    this.saving.set(true);
    try {
      await action();
      this.toastService.show(this.languageService.t(successKey));
      this.dialogRef.close(true);
    } catch (error) {
      this.toastService.show(this.languageService.t('common.saveError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.saving.set(false);
    }
  }

  /** Texto vacío a null, como espera el backend en los campos opcionales. */
  protected text(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }
}
