import { Pipe, PipeTransform } from '@angular/core';

const FORMAT = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Monto en bolivianos con dos decimales: 1234.5 -> "1.234,50". Con signo opcional para diferencias. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, showSign = false): string {
    if (value === null || value === undefined) {
      return '';
    }
    const text = FORMAT.format(value);
    return showSign && value > 0 ? `+${text}` : text;
  }
}
