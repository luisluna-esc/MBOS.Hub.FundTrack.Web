import { Component } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { Input as AppInput } from '../../../shared/components/input/input';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, AppInput, TranslatePipe],
  templateUrl: './login.html',
})
export class Login {
  // FundTrack inicia sesión con el correo (no con usuario como InvenTrack).
  protected readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', Validators.required),
  });

  protected readonly formInvalid = toSignal(
    this.form.statusChanges.pipe(
      startWith(this.form.status),
      map((status) => status !== 'VALID'),
      takeUntilDestroyed()
    ),
    { initialValue: true }
  );

  // Solo vista por ahora: el inicio de sesión contra /api/auth/login se conecta en la etapa de lógica.
  protected onSubmit(): void {}
}
