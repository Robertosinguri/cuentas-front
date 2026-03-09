import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BillService, Bill } from '../../services/bill.service';
import { Observable, BehaviorSubject, combineLatest, map, switchMap, shareReplay } from 'rxjs';
import { BillFormComponent } from '../bill-form/bill-form.component';
import { CalendarComponent } from '../calendar/calendar.component';
import { ReportsComponent } from '../reports/reports.component';
import { Auth, signOut, user } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { GoogleCalendarService } from '../../services/google-calendar.service';

import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, BillFormComponent, CalendarComponent, ReportsComponent, FormsModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    private billService = inject(BillService);
    private auth = inject(Auth);
    private router = inject(Router);
    private googleCalendarService = inject(GoogleCalendarService);

    private refreshSubject = new BehaviorSubject<void>(undefined);
    private filterSubject = new BehaviorSubject<string>('Todas');
    sortColumn = new BehaviorSubject<string>('due_date');
    sortDirection = new BehaviorSubject<'asc' | 'desc'>('asc');

    // Nueva gestión de fechas
    private now = new Date();
    selectedMonth = new BehaviorSubject<number>(this.now.getMonth());
    selectedYear = new BehaviorSubject<number>(this.now.getFullYear());

    monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    years = Array.from({ length: 5 }, (_, i) => this.now.getFullYear() - 2 + i);

    // 1. Fuente base: todas las facturas del usuario (se refresca con refreshSubject)
    private allBills$: Observable<Bill[]> = combineLatest([
        this.refreshSubject,
        this.selectedMonth,
        this.selectedYear
    ]).pipe(
        switchMap(() => this.billService.getBills()),
        shareReplay(1)
    );

    // 2. Facturas del mes seleccionado (sin filtros de categoría/estado)
    private billsForMonth$: Observable<Bill[]> = combineLatest([
        this.allBills$,
        this.selectedMonth,
        this.selectedYear
    ]).pipe(
        map(([bills, month, year]) => {
            return bills.filter(b => {
                if (!b.due_date) return false;
                const parts = b.due_date.split('T')[0].split('-');
                if (parts.length >= 3) {
                    const bYear = parseInt(parts[0], 10);
                    const bMonth = parseInt(parts[1], 10) - 1; // 0-indexed en JS
                    return bMonth === month && bYear === year;
                }
                return false;
            });
        }),
        shareReplay(1)
    );

    // 3. Estadísticas dinámicas del mes
    summary$: Observable<any> = this.billsForMonth$.pipe(
        map(bills => {
            const { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd } = this.getWeekRanges();
            const sum = (list: Bill[]) => list.reduce((acc, b) => acc + (b.amount || 0), 0);

            const isBetween = (dStr: string, start: Date, end: Date) => {
                const [year, month, day] = dStr.split('-').map(Number);
                const d = new Date(year, month - 1, day, 0, 0, 0, 0);
                return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
            };

            const paidList = bills.filter(b => b.status === 'paid');
            const pendingList = bills.filter(b => b.status !== 'paid');
            const thisWeekPending = bills.filter(b => b.status !== 'paid' && isBetween(b.due_date, currentWeekStart, currentWeekEnd));
            const nextWeekPending = bills.filter(b => b.status !== 'paid' && isBetween(b.due_date, nextWeekStart, nextWeekEnd));

            return {
                total: bills.length,
                totalAmount: sum(bills),
                paid: paidList.length,
                paidAmount: sum(paidList),
                pending: pendingList.length,
                pendingAmount: sum(pendingList),
                thisWeek: thisWeekPending.length,
                thisWeekAmount: sum(thisWeekPending),
                nextWeek: nextWeekPending.length,
                nextWeekAmount: sum(nextWeekPending)
            };
        })
    );

    // 4. Facturas visibles finales (aplicando el filtro Y el orden seleccionado)
    bills$: Observable<Bill[]> = combineLatest([
        this.billsForMonth$,
        this.filterSubject,
        this.sortColumn,
        this.sortDirection
    ]).pipe(
        map(([bills, filter, column, direction]) => {
            let filtered = bills;
            if (filter !== 'Todas') {
                const { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd } = this.getWeekRanges();
                const isBetween = (dStr: string, start: Date, end: Date) => {
                    const [year, month, day] = dStr.split('-').map(Number);
                    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
                    return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
                };

                if (filter === 'Abonadas') filtered = bills.filter(b => b.status === 'paid');
                else if (filter === 'Por Abonar') filtered = bills.filter(b => b.status !== 'paid');
                else if (filter === 'Esta Semana') filtered = bills.filter(b => isBetween(b.due_date, currentWeekStart, currentWeekEnd));
                else if (filter === 'Prox. Semana') filtered = bills.filter(b => isBetween(b.due_date, nextWeekStart, nextWeekEnd));
                else filtered = bills.filter(b => b.category === filter);
            }

            // Aplicar ordenamiento
            return filtered.sort((a, b) => {
                let valA: any = a[column as keyof Bill];
                let valB: any = b[column as keyof Bill];

                if (column === 'service') {
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                } else if (column === 'days') {
                    valA = a.days_until_due || 999;
                    valB = b.days_until_due || 999;
                }

                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        })
    );

    toggleSort(column: string) {
        if (this.sortColumn.value === column) {
            this.sortDirection.next(this.sortDirection.value === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortColumn.next(column);
            this.sortDirection.next('asc');
        }
    }

    private getWeekRanges() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const currentWeekStart = new Date(now);
        const day = currentWeekStart.getDay();
        const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
        currentWeekStart.setDate(diff);
        currentWeekStart.setHours(0, 0, 0, 0);

        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
        currentWeekEnd.setHours(23, 59, 59, 999);

        const nextWeekStart = new Date(currentWeekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        nextWeekStart.setHours(0, 0, 0, 0);

        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
        nextWeekEnd.setHours(23, 59, 59, 999);

        return { currentWeekStart, currentWeekEnd, nextWeekStart, nextWeekEnd };
    }

    user$ = user(this.auth);

    categories = ['Hogar', 'Comunicaciones', 'Vehículo', 'Tributario', 'Créditos', 'Otros'];
    showModal = false;
    showUserMenu = false;
    showDeleteConfirm = false;
    selectedBill: Bill | null = null;
    billToDelete: Bill | null = null;
    viewMode: 'table' | 'calendar' | 'reports' = 'table';
    activeFilter = 'Todas';

    changeMonth(m: any) {
        this.selectedMonth.next(Number(m));
    }

    changeYear(y: any) {
        this.selectedYear.next(Number(y));
    }

    ngOnInit() {
        // Aquí podríamos cargar más datos si fuera necesario
    }

    refresh() {
        this.refreshSubject.next();
        this.showModal = false;
        this.showDeleteConfirm = false;
        this.selectedBill = null;
        this.billToDelete = null;
    }

    setFilter(category: string) {
        this.activeFilter = category;
        this.filterSubject.next(category);
    }

    toggleModal() {
        this.showModal = !this.showModal;
        if (!this.showModal) this.selectedBill = null;
    }

    editBill(bill: Bill) {
        this.selectedBill = bill;
        this.showModal = true;
    }

    getDaysClass(bill: Bill): string {
        if (bill.status === 'paid') return 'status-paid';
        const days = bill.days_until_due;
        if (days === undefined) return '';
        if (days <= 0) return 'status-danger'; // Rojo sólido para hoy y vencidos
        if (days <= 3) return 'status-danger';
        if (days <= 7) return 'status-warning';
        return 'status-safe';
    }

    getDaysText(bill: Bill): string {
        if (bill.status === 'paid') return 'Abonada';
        const days = bill.days_until_due;
        if (days === undefined) return '-';
        if (days < 0) return `Vencida (${Math.abs(days)}d)`;
        if (days === 0) return 'Vence hoy';
        return `${days} días`;
    }

    togglePayment(id: string) {
        this.billService.markAsPaid(id).subscribe(() => {
            this.refreshSubject.next();
        });
    }

    toggleProvisional(bill: Bill) {
        const newValue = !bill.is_provisional;
        this.billService.updateBill(bill.id, { is_provisional: newValue }).subscribe(() => {
            this.refreshSubject.next();
        });
    }

    async logout() {
        await signOut(this.auth);
        localStorage.removeItem('google_access_token');
        this.router.navigate(['/login']);
    }

    toggleUserMenu() {
        this.showUserMenu = !this.showUserMenu;
    }

    deleteBill(bill: Bill) {
        this.billToDelete = bill;
        this.showDeleteConfirm = true;
    }

    confirmDelete() {
        if (!this.billToDelete) return;

        const bill = this.billToDelete;
        console.log(`[Dashboard] Iniciando eliminación de: ${bill.name} (ID: ${bill.id})`);

        // 1. Caso: Tiene evento de Google Calendar
        if (bill.google_event_id) {
            console.log(`[Dashboard] Eliminando primero de Google Calendar: ${bill.google_event_id}`);
            this.googleCalendarService.deleteEvent(bill.google_event_id).subscribe({
                next: () => {
                    console.log('[Dashboard] Evento de Google Calendar borrado con éxito.');
                    this.executeLocalDelete(bill.id);
                },
                error: (err) => {
                    console.error('[Dashboard] Error al borrar de Google Calendar:', err);
                    alert(`Ojo: La cuenta se borrará de aquí, pero hubo un error al borrar el evento en Google Calendar. Es posible que debas borrarlo manualmente en tu calendario.`);
                    this.executeLocalDelete(bill.id);
                }
            });
        }
        // 2. Caso: No tiene evento de Google Calendar
        else {
            console.log('[Dashboard] No hay ID de Google Calendar, procediendo directamente con borrado local.');
            this.executeLocalDelete(bill.id);
        }
    }

    private executeLocalDelete(billId: string) {
        this.billService.deleteBill(billId).subscribe({
            next: () => {
                console.log('[Dashboard] Factura eliminada de la base de datos local.');
                this.refresh();
            },
            error: (err) => {
                console.error('[Dashboard] Error al eliminar de la base de datos local:', err);
                this.showDeleteConfirm = false;
            }
        });
    }

    syncToCalendar(bill: Bill) {
        this.googleCalendarService.syncBill(bill).subscribe({
            next: (res: any) => {
                if (!bill.google_event_id && res?.id) {
                    this.billService.updateBill(bill.id, { google_event_id: res.id }).subscribe(() => {
                        this.refresh();
                        alert(`¡'${bill.name}' sincronizado y guardado con éxito!`);
                    });
                } else {
                    alert(`¡'${bill.name}' actualizado en el calendario!`);
                }
            },
            error: (err) => {
                console.error('Error sincronizando:', err);
                alert('Tu sesión de Google Calendar ha expirado (Error 401) y no nos permite guardar. Por favor, usa el menú superior para Cerrar Sesión y vuelve a ingresar.');
            }
        });
    }
}
