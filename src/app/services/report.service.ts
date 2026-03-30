import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth, user } from '@angular/fire/auth';
import { Observable, switchMap, take, from, map, filter } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReportData {
    labels: string[];
    monthly_totals: number[];
    cumulative_totals: number[];
    lines: { label: string; data: number[] }[];
}

@Injectable({
    providedIn: 'root'
})
export class ReportService {
    private http = inject(HttpClient);
    private auth = inject(Auth);
    private apiUrl = `${environment.apiUrl}/reports`;
    user$ = user(this.auth);

    private getAuthHeaders(): Observable<HttpHeaders> {
        return this.user$.pipe(
            filter(u => !!u),
            take(1),
            switchMap(u => from(u!.getIdToken())),
            map(token => new HttpHeaders({
                'Authorization': `Bearer ${token}`
            }))
        );
    }

    getAnnualReport(): Observable<ReportData> {
        return this.getAuthHeaders().pipe(
            switchMap(headers => this.http.get<ReportData>(`${this.apiUrl}/annual`, { headers }))
        );
    }
}
