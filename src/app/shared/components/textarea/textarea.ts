import { Component, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

// Texto largo (observación, justificación, motivo). Mismo estilo que app-input: borde, foco y
// colores del tema; InvenTrack no tenía uno. Alto fijo (no se agranda arrastrando) y sin contador
// de caracteres; maxLength solo corta en silencio lo que no cabe en la columna de la base.
@Component({
  selector: 'app-textarea',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: Textarea, multi: true }],
  template: `
    <div class="flex w-full flex-col gap-1">
      @if (label()) {
        <label [for]="textareaId" class="text-sm font-medium text-foreground">
          {{ label() }}
        </label>
      }
      <textarea
        [id]="textareaId"
        [rows]="rows()"
        [placeholder]="placeholder()"
        [attr.maxlength]="maxLength()"
        [value]="value()"
        [disabled]="disabled()"
        class="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        (input)="onInput($event)"
        (blur)="onTouched()"
      ></textarea>
    </div>
  `,
})
export class Textarea implements ControlValueAccessor {
  readonly label = input<string | null>(null);
  readonly placeholder = input('');
  readonly rows = input(3);
  readonly maxLength = input<number | null>(null);
  readonly required = input(false);

  protected readonly textareaId = `app-textarea-${nextId++}`;
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.value.set(value);
    this.onChange(value);
  }
}
