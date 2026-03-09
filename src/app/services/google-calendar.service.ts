import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Bill } from './bill.service';

@Injectable({
    providedIn: 'root'
})
export class GoogleCalendarService {
    private http = inject(HttpClient);
    private readonly CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('google_access_token');
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
    }

    syncBill(bill: Bill): Observable<any> {
        const token = localStorage.getItem('google_access_token');
        if (!token) {
            console.error('[Calendar] ERROR: No hay token de Google Calendar en localStorage.');
            alert('Atención: No se pudo sincronizar con Google Calendar porque la sesión no tiene los permisos necesarios. Por favor, cierra sesión y vuelve a ingresar con Google.');
            return of(null);
        }

        // Calcular mañana para el end.date (Google requiere que sea exclusivo para eventos de todo el día)
        const startDate = new Date(bill.due_date);
        startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];

        const event = {
            'summary': `Pago: ${bill.name}`,
            'description': `Monto: ${bill.amount} ARS - Categoría: ${bill.category}\nSincronizado desde Cuentas App.`,
            'start': {
                'date': bill.due_date
            },
            'end': {
                'date': endDateStr
            },
            'reminders': {
                'useDefault': false,
                'overrides': [
                    { 'method': 'popup', 'minutes': 1440 }, // 1 día antes
                    { 'method': 'email', 'minutes': 1440 }
                ]
            },
            'colorId': this.getColorByStatus(bill)
        };

        console.log('[Calendar] Payload preparado:', JSON.stringify(event));

        if (bill.google_event_id) {
            console.log(`[Calendar] ACTUALIZANDO evento: ${bill.google_event_id}`);
            return this.http.put(`${this.CALENDAR_API_URL}/${bill.google_event_id}`, event, { headers: this.getHeaders() });
        } else {
            console.log(`[Calendar] CREANDO nuevo evento`);
            return this.http.post(this.CALENDAR_API_URL, event, { headers: this.getHeaders() });
        }
    }

    deleteEvent(eventId: string): Observable<any> {
        const token = localStorage.getItem('google_access_token');
        if (!token || !eventId) return of(null);

        console.log(`[Calendar] ELIMINANDO evento: ${eventId}`);
        return this.http.delete(`${this.CALENDAR_API_URL}/${eventId}`, { headers: this.getHeaders() });
    }

    private getColorByStatus(bill: Bill): string {
        if (bill.status === 'paid') return '10'; // Verde (Basil)
        if (bill.days_until_due !== undefined && bill.days_until_due < 0) return '11'; // Rojo (Tomato)

        switch (bill.category) {
            case 'Hogar': return '1'; // Lavanda (Azul-ish)
            case 'Comunicaciones': return '9'; // Arándano (Azul oscuro)
            case 'Vehículo': return '5'; // Plátano (Amarillo)
            case 'Tributario': return '3'; // Uva (Púrpura)
            case 'Créditos': return '2'; // Sabia (Teal/Verde suave)
            case 'Otros': return '8'; // Grafito (Gris)
            default: return '8';
        }
    }
}
