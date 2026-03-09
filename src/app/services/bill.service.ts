import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth, user, idToken } from '@angular/fire/auth';
import { Observable, switchMap, take, from, of, map, filter } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Bill {
    id: string;
    name: string;
    amount: number;
    due_date: string;
    category: string;
    status: 'unpaid' | 'paid' | 'overdue';
    days_until_due?: number;
    google_event_id?: string;
    payment_date?: string;
    is_provisional?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class BillService {
    private http = inject(HttpClient);
    private auth = inject(Auth);
    private apiUrl = `${environment.apiUrl}/bills`;
    user$ = user(this.auth);

    private getAuthHeaders(): Observable<HttpHeaders> {
        return this.user$.pipe(
            filter(u => !!u), // Esperamos a que haya un usuario
            take(1),
            switchMap(u => from(u!.getIdToken())),
            map(token => new HttpHeaders({
                'Authorization': `Bearer ${token}`
            }))
        );
    }

    getBills(): Observable<Bill[]> {
        return this.getAuthHeaders().pipe(
            switchMap(headers => this.http.get<Bill[]>(this.apiUrl, { headers }))
        );
    }

    createBill(bill: Partial<Bill>): Observable<Bill> {
        return this.getAuthHeaders().pipe(
            switchMap(headers => this.http.post<Bill>(this.apiUrl + '/', bill, { headers }))
        );
    }

    updateBill(billId: string, bill: Partial<Bill>): Observable<Bill> {
        return this.getAuthHeaders().pipe(
            switchMap(headers => this.http.put<Bill>(`${this.apiUrl}/${billId}`, bill, { headers }))
        );
    }

    markAsPaid(billId: string): Observable<Bill> {
        return this.getAuthHeaders().pipe(
            switchMap(headers => this.http.patch<Bill>(`${this.apiUrl}/${billId}/pay`, {}, { headers }))
        );
    }

    deleteBill(billId: string): Observable<any> {
        return this.getAuthHeaders().pipe(
            switchMap(headers => this.http.delete(`${this.apiUrl}/${billId}`, { headers }))
        );
    }
}
