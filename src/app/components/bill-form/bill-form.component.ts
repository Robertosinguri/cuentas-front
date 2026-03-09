import { Component, EventEmitter, Output, Input, OnInit, inject } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { BillService, Bill } from '../../services/bill.service';
import { GoogleCalendarService } from '../../services/google-calendar.service';

@Component({
  selector: 'app-bill-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './bill-form.component.html',
  styleUrls: ['./bill-form.component.css'],
})
export class BillFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private billService = inject(BillService);
  private googleCalendarService = inject(GoogleCalendarService);

  @Output() billCreated = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  @Input() billToEdit: Bill | null = null;
  @Input() defaultMonth: number | null = null;
  @Input() defaultYear: number | null = null;

  billForm = this.fb.group({
    name: ['', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    due_date: ['', [Validators.required]],
    category: ['Hogar'],
    is_provisional: [false],
  });

  isSaving = false;

  ngOnInit() {
    if (this.billToEdit) {
      this.billForm.patchValue({
        name: this.billToEdit.name,
        amount: this.billToEdit.amount,
        due_date: this.billToEdit.due_date,
        category: this.billToEdit.category,
        is_provisional: !!this.billToEdit.is_provisional,
      });
    } else if (this.defaultMonth !== null && this.defaultYear !== null) {
      const y = this.defaultYear;
      const m = (this.defaultMonth + 1).toString().padStart(2, '0');
      const today = new Date();
      // Si el mes seleccionado es el actual, usamos el día de hoy, sino el día 1
      let d = today.getDate().toString().padStart(2, '0');
      if (today.getMonth() !== this.defaultMonth || today.getFullYear() !== this.defaultYear) {
        d = '01';
      }
      this.billForm.patchValue({
        due_date: `${y}-${m}-${d}`,
      });
    }
  }

  onSubmit() {
    if (this.billForm.valid && !this.isSaving) {
      this.isSaving = true;
      const formValue = this.billForm.value;

      const request = this.billToEdit
        ? this.billService.updateBill(this.billToEdit.id, formValue as any)
        : this.billService.createBill(formValue as any);

      request.subscribe({
        next: (billSaved: Bill) => {
          // Mantenemos el ID de Google del objeto original si el servidor aún no lo tiene procesado
          if (this.billToEdit?.google_event_id && !billSaved.google_event_id) {
            billSaved.google_event_id = this.billToEdit.google_event_id;
          }

          this.googleCalendarService.syncBill(billSaved).subscribe({
            next: (res: any) => {
              // Si acabamos de crear un evento nuevo (no tenía ID), lo guardamos
              if (!billSaved.google_event_id && res?.id) {
                this.billService
                  .updateBill(billSaved.id, { google_event_id: res.id })
                  .subscribe(() => {
                    this.finalizeSubmit();
                  });
              } else {
                this.finalizeSubmit();
              }
            },
            error: (err) => {
              console.error('Error sincronizando calendario:', err);
              alert(
                'La factura se guardó temporalmente, pero hubo un 401 de Google Calendar. Tu sesión (token) para escribir en el calendario ha expirado. Por favor, Cierra Sesión en el menú superior y vuelve a ingresar para renovar los permisos.',
              );
              this.finalizeSubmit();
            },
          });
        },
        error: (err) => {
          console.error('Error al procesar la factura:', err);
          this.isSaving = false;
        },
      });
    }
  }

  private finalizeSubmit() {
    this.isSaving = false;
    this.billCreated.emit();
    this.billForm.reset({ category: 'Hogar' });
  }
}
