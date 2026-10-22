import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { localDateIso } from '../../../../core/dates/calendar-date';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Select, SelectOption } from '../../../../shared/components/select/select';
import { Textarea } from '../../../../shared/components/textarea/textarea';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CatalogLookups } from '../../catalog-lookups';
import { Church, ChurchRequest, ChurchType } from '../../catalog.models';
import { ChurchService } from '../../catalog.services';

export interface ChurchFormDialogData {
  church: Church | null;
}

// Una filial no tiene arqueo propio: toma el código y el distrito de su iglesia madre, por eso
// esos dos campos se bloquean y se copian de la madre al elegirla. Al editar, si cambia el tipo,
// el distrito o el nombre, el backend lo anota en el historial con la fecha y el motivo.
@Component({
  selector: 'app-church-form-dialog',
  imports: [ReactiveFormsModule, DatePicker, Dialog, AppInput, Select, Textarea, TranslatePipe],
  template: `
    <app-dialog
      [title]="(church ? 'catalogs.churches.editTitle' : 'catalogs.churches.newTitle') | translate"
      [saveDisabled]="saveDisabled()"
      size="large"
      (save)="save()"
      (cancel)="dialogRef.close(false)"
    >
      <form [formGroup]="form" class="flex flex-col gap-5">
        <section class="flex flex-col gap-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <app-select formControlName="type" [label]="'catalogs.columns.type' | translate" [options]="typeOptions()" [required]="true" />
            @if (isFilial()) {
              <app-select formControlName="parentChurchId" [label]="'catalogs.churches.parentChurch' | translate" [options]="parentOptions()" [required]="true" />
            }
            <app-input formControlName="code" [label]="'catalogs.columns.code' | translate" [required]="!isFilial()" [maxLength]="20" [hint]="isFilial() ? ('catalogs.churches.codeFromParent' | translate) : null" />
            <app-input formControlName="name" [label]="'catalogs.columns.name' | translate" [required]="true" [maxLength]="150" />
            <app-select formControlName="districtId" [label]="'catalogs.columns.district' | translate" [options]="districtOptions()" [required]="!isFilial()" />
            <app-input formControlName="phone" type="tel" [label]="'catalogs.columns.phone' | translate" [maxLength]="30" />
          </div>
          <app-input formControlName="address" [label]="'catalogs.columns.address' | translate" [maxLength]="255" />
        </section>

        <section class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold text-foreground">{{ 'catalogs.churches.contacts' | translate }}</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <app-input formControlName="treasurerName" [label]="'catalogs.columns.treasurer' | translate" [maxLength]="150" />
            <app-input formControlName="treasurerPhone" type="tel" [label]="'catalogs.columns.treasurerPhone' | translate" [maxLength]="30" />
            <app-input formControlName="elderName" [label]="'catalogs.columns.elder' | translate" [maxLength]="150" />
            <app-input formControlName="elderPhone" type="tel" [label]="'catalogs.columns.elderPhone' | translate" [maxLength]="30" />
          </div>
        </section>

        @if (tracksChange()) {
          <section class="flex flex-col gap-3 rounded-md border border-info/30 bg-info/10 p-3">
            <p class="text-xs text-info">{{ 'catalogs.churches.changeHint' | translate }}</p>
            <app-date-picker formControlName="changeDate" [label]="'catalogs.churches.changeDate' | translate" />
            <app-textarea formControlName="changeReason" [label]="'catalogs.churches.reason' | translate" [maxLength]="500" [rows]="2" />
          </section>
        }
      </form>
    </app-dialog>
  `,
})
export class ChurchFormDialog extends FormDialog {
  protected readonly church = inject<ChurchFormDialogData>(DIALOG_DATA).church;
  protected readonly dialogRef = inject(DialogRef<boolean, ChurchFormDialog>);
  private readonly churchService = inject(ChurchService);
  private readonly lookups = inject(CatalogLookups);

  protected readonly districtOptions = computed<SelectOption[]>(() =>
    this.lookups.districts().map((d) => ({ value: String(d.districtId), label: `${d.name} (${d.regionName ?? ''})` }))
  );
  /** Madres posibles: Iglesias y Grupos activos (una Filial no puede ser madre). */
  protected readonly parentOptions = computed<SelectOption[]>(() =>
    this.lookups
      .churches()
      .filter((c) => c.type !== 'Filial' && c.status === 'active' && c.churchId !== this.church?.churchId)
      .map((c) => ({ value: String(c.churchId), label: `${c.code} ${c.name}` }))
  );

  protected readonly form = new FormGroup({
    type: new FormControl<ChurchType | null>(this.church?.type ?? null, Validators.required),
    parentChurchId: new FormControl<string | null>(this.church?.parentChurchId ? String(this.church.parentChurchId) : null),
    code: new FormControl(this.church?.code ?? '', { nonNullable: true, validators: Validators.required }),
    name: new FormControl(this.church?.name ?? '', { nonNullable: true, validators: Validators.required }),
    districtId: new FormControl<string | null>(this.church ? String(this.church.districtId) : null, Validators.required),
    phone: new FormControl(this.church?.phone ?? ''),
    address: new FormControl(this.church?.address ?? ''),
    treasurerName: new FormControl(this.church?.treasurerName ?? ''),
    treasurerPhone: new FormControl(this.church?.treasurerPhone ?? ''),
    elderName: new FormControl(this.church?.elderName ?? ''),
    elderPhone: new FormControl(this.church?.elderPhone ?? ''),
    changeDate: new FormControl<string | null>(localDateIso()),
    changeReason: new FormControl(''),
  });

  private readonly type = signal(this.form.controls.type.value);
  private readonly values = signal(this.form.getRawValue());
  protected readonly isFilial = computed(() => this.type() === 'Filial');

  /** Solo al editar y si cambió algo que va al historial (tipo, distrito o nombre). */
  protected readonly tracksChange = computed(() => {
    const church = this.church;
    const values = this.values();
    return !!church && (values.type !== church.type || values.districtId !== String(church.districtId) || values.name.trim() !== church.name);
  });

  constructor() {
    super();
    this.watch(this.form);
    this.lookups.invalidate('churches');
    void this.lookups.load('districts', 'churches');

    this.applyType(this.form.controls.type.value);
    this.form.controls.type.valueChanges.subscribe((type) => {
      this.type.set(type);
      this.applyType(type);
    });
    this.form.controls.parentChurchId.valueChanges.subscribe((id) => this.copyFromParent(id));
    this.form.valueChanges.subscribe(() => this.values.set(this.form.getRawValue()));
  }

  protected typeOptions() {
    return (['Iglesia', 'Grupo', 'Filial'] as const).map((type) => ({ value: type, label: this.languageService.t(`catalogs.churches.types.${type}`) }));
  }

  private applyType(type: ChurchType | null): void {
    const { parentChurchId, code, districtId } = this.form.controls;
    if (type === 'Filial') {
      parentChurchId.setValidators(Validators.required);
      code.disable({ emitEvent: false });
      districtId.disable({ emitEvent: false });
      this.copyFromParent(parentChurchId.value);
    } else {
      parentChurchId.clearValidators();
      parentChurchId.setValue(null, { emitEvent: false });
      code.enable({ emitEvent: false });
      districtId.enable({ emitEvent: false });
    }
    parentChurchId.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity();
  }

  private copyFromParent(id: string | null): void {
    const parent = this.lookups.churches().find((c) => String(c.churchId) === id);
    if (!parent || this.form.controls.type.value !== 'Filial') return;
    this.form.controls.code.setValue(parent.code);
    this.form.controls.districtId.setValue(String(parent.districtId));
  }

  protected save(): Promise<void> {
    const raw = this.form.getRawValue();
    const filial = raw.type === 'Filial';
    const request: ChurchRequest = {
      code: raw.code.trim(),
      parentChurchId: filial ? Number(raw.parentChurchId) : null,
      name: raw.name.trim(),
      type: raw.type!,
      districtId: Number(raw.districtId) || 0,
      address: this.text(raw.address),
      phone: this.text(raw.phone),
      treasurerName: this.text(raw.treasurerName),
      treasurerPhone: this.text(raw.treasurerPhone),
      elderName: this.text(raw.elderName),
      elderPhone: this.text(raw.elderPhone),
      changeDate: this.tracksChange() ? raw.changeDate : null,
      changeReason: this.tracksChange() ? this.text(raw.changeReason) : null,
    };
    return this.submit(async () => {
      await (this.church ? this.churchService.update(this.church.churchId, request) : this.churchService.create(request));
      this.lookups.invalidate('churches');
    });
  }
}
