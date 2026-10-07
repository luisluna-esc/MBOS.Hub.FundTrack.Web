import { Component, ElementRef, afterNextRender, computed, effect, inject, signal, viewChildren } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DialogService } from '../../core/dialog/dialog.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/toast/toast.service';
import { Badge, BadgeTone } from '../../shared/components/badge/badge';
import { Checkbox } from '../../shared/components/checkbox/checkbox';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { DatePicker } from '../../shared/components/date-picker/date-picker';
import { InfoHint } from '../../shared/components/info-hint/info-hint';
import { Input } from '../../shared/components/input/input';
import { LanguageSwitcher } from '../../shared/components/language-switcher/language-switcher';
import { Select, SelectOption } from '../../shared/components/select/select';
import { Switch } from '../../shared/components/switch/switch';
import { Table, TableAction, TableColumn } from '../../shared/components/table/table';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { Tooltip } from '../../shared/components/tooltip/tooltip';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface Swatch {
  token: string;
  usage: string;
}

interface SampleRow extends Record<string, unknown> {
  code: string;
  church: string;
  acms: number;
  counted: number;
  difference: number;
}

@Component({
  selector: 'app-style-guide',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Badge,
    Checkbox,
    DatePicker,
    InfoHint,
    Input,
    LanguageSwitcher,
    Select,
    Switch,
    Table,
    ThemeToggle,
    Tooltip,
    TranslatePipe,
  ],
  templateUrl: './style-guide.html',
})
export class StyleGuide {
  protected readonly themeService = inject(ThemeService);
  private readonly toastService = inject(ToastService);
  private readonly dialogService = inject(DialogService);

  protected readonly brandScale: Swatch[] = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => ({
    token: `brand-${step}`,
    usage: '',
  }));

  protected readonly semanticTokens: Swatch[] = [
    { token: 'background', usage: 'styleGuide.usage.background' },
    { token: 'surface', usage: 'styleGuide.usage.surface' },
    { token: 'foreground', usage: 'styleGuide.usage.foreground' },
    { token: 'muted-foreground', usage: 'styleGuide.usage.mutedForeground' },
    { token: 'border', usage: 'styleGuide.usage.border' },
    { token: 'primary', usage: 'styleGuide.usage.primary' },
    { token: 'primary-foreground', usage: 'styleGuide.usage.primaryForeground' },
  ];

  protected readonly statusTokens: { token: string; tone: BadgeTone; label: string }[] = [
    { token: 'success', tone: 'success', label: 'styleGuide.status.success' },
    { token: 'warning', tone: 'warning', label: 'styleGuide.status.warning' },
    { token: 'info', tone: 'info', label: 'styleGuide.status.info' },
    { token: 'danger', tone: 'danger', label: 'styleGuide.status.danger' },
  ];

  /** Logo azul sobre fondo claro y blanco sobre fondo oscuro (public/img). */
  protected readonly logoSrc = computed(() =>
    this.themeService.theme() === 'dark' ? 'img/fund-track-blanco.png' : 'img/fund-track-azul.png'
  );

  /** Valor real (hex) de cada muestra, leído del navegador después de pintar. */
  protected readonly resolvedColors = signal<Record<string, string>>({});
  private readonly swatchElements = viewChildren<ElementRef<HTMLElement>>('swatch');

  protected readonly nameControl = new FormControl('Machacamarca - Villa Remedios');
  protected readonly amountControl = new FormControl<string | null>('8431.20');
  protected readonly typeControl = new FormControl<string | null>('Iglesia');
  protected readonly dateControl = new FormControl<string | null>(null);
  protected readonly signedControl = new FormControl(true);
  protected readonly submitted = signal(true);

  protected readonly typeOptions: SelectOption[] = [
    { value: 'Iglesia', label: 'Iglesia' },
    { value: 'Grupo', label: 'Grupo' },
    { value: 'Filial', label: 'Filial' },
  ];

  protected readonly sampleColumns: TableColumn<SampleRow>[] = [
    { key: 'code', header: 'Código' },
    { key: 'church', header: 'Iglesia' },
    { key: 'acms', header: 'Saldo ACMS', align: 'right', format: (v) => this.money(v) },
    { key: 'counted', header: 'Arqueo', align: 'right', format: (v) => this.money(v) },
    { key: 'difference', header: 'Diferencia', align: 'right', format: (v) => this.money(v) },
  ];

  protected readonly sampleRows: SampleRow[] = [
    { code: '746', church: 'Villa Remedios', acms: 90275.5, counted: 90275.48, difference: -0.02 },
    { code: '725', church: 'Calacachi', acms: 40193.04, counted: 40193.04, difference: 0 },
    { code: '742', church: 'San Antonio - Villa Remedios', acms: 59116.65, counted: 59116.65, difference: 0 },
  ];

  protected readonly sampleActions: TableAction<SampleRow>[] = [
    { label: 'Ver', icon: 'view', onClick: () => this.showToast() },
    { label: 'Editar', icon: 'edit', onClick: () => this.showToast() },
    { label: 'Eliminar', icon: 'delete', variant: 'danger', onClick: () => this.openConfirm() },
  ];

  constructor() {
    // Cada cambio de tema vuelve a leer los valores reales de las muestras.
    effect(() => {
      this.themeService.theme();
      requestAnimationFrame(() => this.readSwatchColors());
    });

    afterNextRender(() => this.readSwatchColors());
  }

  protected showToast(): void {
    this.toastService.show('Arqueo guardado', 'La diferencia quedó en estado pendiente.');
  }

  protected openConfirm(): void {
    this.dialogService.open<boolean, ConfirmDialogData>(ConfirmDialog, {
      data: {
        title: 'Cerrar el período',
        message: 'Un período cerrado ya no se vuelve a abrir. ¿Quieres cerrar Agosto 2026?',
        confirmLabel: 'Cerrar período',
      },
    });
  }

  private readSwatchColors(): void {
    const colors: Record<string, string> = {};
    for (const element of this.swatchElements()) {
      const token = element.nativeElement.dataset['token'];
      if (token) {
        colors[token] = this.toHex(getComputedStyle(element.nativeElement).backgroundColor);
      }
    }
    this.resolvedColors.set(colors);
  }

  /** "rgb(29, 52, 86)" o "oklab(...)" ya resuelto por el navegador, a "#1d3456". */
  private toHex(color: string): string {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) {
      return color;
    }
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  private money(value: unknown): string {
    return Number(value).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
