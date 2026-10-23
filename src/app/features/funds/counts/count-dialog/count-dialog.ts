import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../../core/http/api-error';
import { openPdfTab, showPdf } from '../../../../core/http/pdf';
import { Badge } from '../../../../shared/components/badge/badge';
import { Checkbox } from '../../../../shared/components/checkbox/checkbox';
import { DatePicker } from '../../../../shared/components/date-picker/date-picker';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Input as AppInput } from '../../../../shared/components/input/input';
import { Skeleton } from '../../../../shared/components/skeleton/skeleton';
import { Switch } from '../../../../shared/components/switch/switch';
import { Textarea } from '../../../../shared/components/textarea/textarea';
import { FormDialog } from '../../../../shared/list-page/form-dialog';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Period } from '../../../catalogs/catalog.models';
import { ChurchService } from '../../../catalogs/catalog.services';
import { countStatus, differenceClass } from '../../count-status';
import { LocalFundCountDocument, LocalFundCountRequest, PeriodCountRow } from '../../funds.models';
import { FundsService } from '../../funds.service';

export interface CountDialogData {
  row: PeriodCountRow;
  period: Period;
  periodLabel: string;
}

/** Tipo de cambio que se sugiere para los dólares (oficial); el tesorero lo puede cambiar. */
const DEFAULT_EXCHANGE_RATE = '6.96';

type DocumentForm = FormGroup<{
  documentDate: FormControl<string | null>;
  documentNumber: FormControl<string>;
  detail: FormControl<string>;
  amount: FormControl<string | null>;
}>;

// Registro y edición del arqueo de una Iglesia o Grupo en un mes, con el formulario del tesorero:
// extracto bancario, depósito, billetes y monedas, dólares (monto por tipo de cambio) y los
// documentos a rendir. Todo eso es el total de fondos en custodia, que debe cuadrar con el saldo
// ACMS; si no cuadra, hay que explicar la diferencia. Los totales se calculan mientras se escribe
// y el backend los vuelve a calcular al guardar. En un período cerrado el arqueo es de solo lectura.
// Si la iglesia ya trae el arqueo hecho, se elige "La iglesia trajo su arqueo" y solo se anota el
// total: la diferencia con el ACMS queda registrada, pero no hace falta explicarla.
@Component({
  selector: 'app-count-dialog',
  imports: [ReactiveFormsModule, Badge, Checkbox, DatePicker, Dialog, AppInput, Skeleton, Switch, Textarea, MoneyPipe, TranslatePipe],
  templateUrl: './count-dialog.html',
})
export class CountDialog extends FormDialog {
  protected readonly data = inject<CountDialogData>(DIALOG_DATA);
  protected readonly dialogRef = inject(DialogRef<boolean, CountDialog>);
  private readonly fundsService = inject(FundsService);
  private readonly churchService = inject(ChurchService);
  private readonly authService = inject(AuthService);

  protected readonly row = this.data.row;
  protected readonly count = this.row.localFundCount;
  protected readonly isNew = !this.count;
  protected readonly filials = signal<string[]>([]);
  protected readonly loadingDocuments = signal(!!this.count);
  protected readonly printing = signal(false);

  /** Registrar o editar: rol que escribe y período abierto. */
  protected readonly editable = this.authService.canWrite() && this.data.period.status === 'open';

  protected readonly submitted = signal(this.count?.submissionStatus !== 'not_submitted');
  /** La iglesia trajo el arqueo hecho: solo se pide el total. */
  protected readonly summaryOnly = signal(this.count?.summaryOnly ?? false);
  protected readonly status = this.count ? countStatus(this.count, 'month') : null;

  protected readonly form = new FormGroup({
    acmsBalance: new FormControl<string | null>(this.amount(this.count?.acmsBalance), Validators.required),
    countDate: new FormControl<string | null>(this.count?.countDate ?? null),
    summaryTotal: new FormControl<string | null>(this.count?.summaryOnly ? String(this.count.totalAmount) : null),
    bankStatementBalance: new FormControl<string | null>(this.optionalAmount(this.count?.bankStatementBalance)),
    bankDeposit: new FormControl<string | null>(this.optionalAmount(this.count?.bankDeposit)),
    localCash: new FormControl<string | null>(this.optionalAmount(this.count?.localCash)),
    usdAmount: new FormControl<string | null>(this.optionalAmount(this.count?.usdAmount)),
    exchangeRate: new FormControl<string | null>(this.count?.exchangeRate ? this.count.exchangeRate.toFixed(2) : DEFAULT_EXCHANGE_RATE),
    documents: new FormArray<DocumentForm>([]),
    treasurerName: new FormControl(this.count?.treasurerName ?? ''),
    elderName: new FormControl(this.count?.elderName ?? ''),
    signedByPastor: new FormControl(this.count?.signedByPastor ?? false, { nonNullable: true }),
    signedByElder: new FormControl(this.count?.signedByElder ?? false, { nonNullable: true }),
    observation: new FormControl(this.count?.observation ?? ''),
  });

  protected get documents(): FormArray<DocumentForm> {
    return this.form.controls.documents;
  }

  private readonly values = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), { initialValue: this.form.getRawValue() });

  /** Dólares pasados a Bs, redondeados a centavos (igual que el backend). */
  protected readonly usdInBs = computed(() => this.round(this.toNumber(this.values().usdAmount) * this.toNumber(this.values().exchangeRate)));

  /** Arqueo: extracto, depósito, billetes y monedas, y dólares en Bs. */
  protected readonly fundsTotal = computed(() => {
    const v = this.values();
    return this.round(this.toNumber(v.bankStatementBalance) + this.toNumber(v.bankDeposit) + this.toNumber(v.localCash) + this.usdInBs());
  });

  protected readonly documentsTotal = computed(() => this.round((this.values().documents ?? []).reduce((sum, d) => sum + this.toNumber(d?.amount), 0)));

  /** Total fondos en custodia del tesorero: el arqueo más los documentos a rendir. */
  protected readonly custodyTotal = computed(() => this.round(this.fundsTotal() + this.documentsTotal()));

  /** Total en custodia (o el total que trajo la iglesia) menos ACMS: negativo falta dinero, positivo sobra. */
  protected readonly difference = computed(() => {
    const total = this.summaryOnly() ? this.toNumber(this.values().summaryTotal) : this.custodyTotal();
    return this.round(total - this.toNumber(this.values().acmsBalance));
  });

  /** Solo se pide explicar la diferencia cuando el arqueo se hizo aquí y no cuadra. */
  protected readonly needsObservation = computed(() => this.submitted() && !this.summaryOnly() && this.difference() !== 0);

  protected readonly differenceClass = differenceClass;

  constructor() {
    super();
    this.watch(this.form);
    this.applySubmitted(this.submitted());

    // La observación es obligatoria mientras haya diferencia.
    effect(() => {
      const observation = this.form.controls.observation;
      observation.setValidators(this.needsObservation() ? Validators.required : null);
      observation.updateValueAndValidity();
    });

    this.churchService
      .all({ parentChurchId: this.row.churchId, status: 'active' })
      .then((filials) => this.filials.set(filials.map((f) => f.name)))
      .catch(() => this.filials.set([]));

    if (this.count) {
      this.fundsService
        .documents(this.count.localFundCountId)
        .then((documents) => documents.forEach((d) => this.addDocument(d)))
        .catch(() => this.toastService.show(this.languageService.t('common.loadError')))
        .finally(() => {
          this.loadingDocuments.set(false);
          if (!this.editable) this.form.disable();
        });
    } else if (!this.editable) {
      this.form.disable();
    }
  }

  protected setSubmitted(value: boolean): void {
    this.submitted.set(value);
    this.applySubmitted(value);
  }

  protected setSummaryOnly(value: boolean): void {
    if (!this.editable) return;
    this.summaryOnly.set(value);
    this.applySubmitted(this.submitted());
  }

  /**
   * Si no presentó, solo se pide el saldo ACMS. Si la iglesia trajo su arqueo, el ACMS y el total
   * (la fecha es opcional). Si el arqueo se hace aquí, la fecha y el detalle.
   */
  private applySubmitted(submitted: boolean): void {
    const { countDate, summaryTotal, documents } = this.form.controls;
    const summary = submitted && this.summaryOnly();
    countDate.setValidators(submitted && !summary ? Validators.required : null);
    countDate.updateValueAndValidity();
    summaryTotal.setValidators(summary ? Validators.required : null);
    summaryTotal.updateValueAndValidity();
    if (submitted && !summary) {
      documents.enable();
    } else {
      documents.disable();
    }
  }

  protected addDocument(document?: LocalFundCountDocument): void {
    this.documents.push(
      new FormGroup({
        documentDate: new FormControl<string | null>(document?.documentDate ?? this.form.controls.countDate.value, Validators.required),
        documentNumber: new FormControl(document?.documentNumber ?? '', { nonNullable: true }),
        detail: new FormControl(document?.detail ?? '', { nonNullable: true, validators: Validators.required }),
        amount: new FormControl<string | null>(document ? document.amount.toFixed(2) : null, Validators.required),
      })
    );
  }

  protected removeDocument(index: number): void {
    this.documents.removeAt(index);
  }

  protected save(): Promise<void> {
    if (this.loadingDocuments()) {
      return Promise.resolve();
    }
    const request = this.buildRequest();
    return this.submit(() => (this.count ? this.fundsService.update(this.count.localFundCountId, request) : this.fundsService.create(request)));
  }

  /**
   * Imprimir: si se puede editar, primero guarda lo que está en pantalla (para que la hoja salga
   * con los datos de verdad) y después abre la hoja "Arqueo del fondo local" en otra pestaña,
   * desde donde se imprime. La pestaña se abre en el mismo clic para que no la bloquee el navegador.
   */
  protected async print(): Promise<void> {
    if (this.printing() || this.saving() || this.loadingDocuments()) {
      return;
    }
    if (this.editable && this.saveDisabled()) {
      this.form.markAllAsTouched();
      this.toastService.show(this.languageService.t('funds.dialog.fixBeforePrint'));
      return;
    }

    const tab = openPdfTab();
    this.printing.set(true);
    try {
      let id = this.count?.localFundCountId ?? 0;
      if (this.editable) {
        const request = this.buildRequest();
        const response = this.count ? await this.fundsService.update(this.count.localFundCountId, request) : await this.fundsService.create(request);
        id = this.count ? this.count.localFundCountId : response.id;
      }
      showPdf(await this.fundsService.voucherPdf(id), `arqueo-${this.row.churchCode}.pdf`, tab);
      if (this.editable) {
        this.toastService.show(this.languageService.t('common.saved'));
        this.dialogRef.close(true);
      }
    } catch (error) {
      tab?.close();
      this.toastService.show(this.languageService.t('funds.dialog.printError'), apiErrorMessage(error) ?? undefined);
    } finally {
      this.printing.set(false);
    }
  }

  private buildRequest(): LocalFundCountRequest {
    const raw = this.form.getRawValue();
    const submitted = this.submitted();
    const summary = submitted && this.summaryOnly();
    if (summary) {
      return {
        churchId: this.row.churchId,
        periodId: this.data.period.periodId,
        submissionStatus: 'submitted',
        summaryOnly: true,
        summaryTotal: this.toNumber(raw.summaryTotal),
        acmsBalance: this.toNumber(raw.acmsBalance),
        bankStatementBalance: 0,
        bankDeposit: 0,
        localCash: 0,
        usdAmount: 0,
        exchangeRate: 0,
        countDate: raw.countDate,
        treasurerName: this.text(raw.treasurerName),
        elderName: this.text(raw.elderName),
        signedByPastor: false,
        signedByElder: false,
        observation: this.difference() !== 0 ? this.text(raw.observation) : null,
        documents: [],
      };
    }
    const usd = submitted ? this.toNumber(raw.usdAmount) : 0;
    const request: LocalFundCountRequest = {
      churchId: this.row.churchId,
      periodId: this.data.period.periodId,
      submissionStatus: submitted ? 'submitted' : 'not_submitted',
      summaryOnly: false,
      summaryTotal: 0,
      acmsBalance: this.toNumber(raw.acmsBalance),
      bankStatementBalance: submitted ? this.toNumber(raw.bankStatementBalance) : 0,
      bankDeposit: submitted ? this.toNumber(raw.bankDeposit) : 0,
      localCash: submitted ? this.toNumber(raw.localCash) : 0,
      usdAmount: usd,
      exchangeRate: usd > 0 ? this.toNumber(raw.exchangeRate) : 0,
      countDate: submitted ? raw.countDate : null,
      treasurerName: this.text(raw.treasurerName),
      elderName: this.text(raw.elderName),
      signedByPastor: submitted && raw.signedByPastor,
      signedByElder: submitted && raw.signedByElder,
      observation: this.needsObservation() ? this.text(raw.observation) : null,
      documents: submitted
        ? raw.documents.map((d) => ({
            documentDate: d.documentDate!,
            documentNumber: this.text(d.documentNumber),
            detail: d.detail.trim(),
            amount: this.toNumber(d.amount),
          }))
        : [],
    };
    return request;
  }

  protected onCancel(): void {
    this.dialogRef.close(false);
  }

  private amount(value: number | undefined): string | null {
    return value === undefined ? null : String(value);
  }

  /** Los montos opcionales en cero se muestran vacíos. */
  private optionalAmount(value: number | undefined): string | null {
    return value ? String(value) : null;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private toNumber(value: string | null | undefined): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
}
