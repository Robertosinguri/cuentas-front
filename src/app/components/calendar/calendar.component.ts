import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Bill } from '../../services/bill.service';

interface CalendarDay {
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    bills: Bill[];
}

@Component({
    selector: 'app-calendar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './calendar.component.html',
    styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit, OnChanges {
    @Input() bills: Bill[] = [];

    viewDate: Date = new Date();
    days: CalendarDay[] = [];
    weekDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    ngOnInit() {
        this.generateCalendar();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['bills']) {
            this.generateCalendar();
        }
    }

    generateCalendar() {
        const year = this.viewDate.getFullYear();
        const month = this.viewDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const endDate = new Date(lastDayOfMonth);
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

        const newDays: CalendarDay[] = [];
        let currDate = new Date(startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        while (currDate <= endDate) {
            const dateCopy = new Date(currDate);
            const isCurrentMonth = dateCopy.getMonth() === month;
            const isToday = dateCopy.getTime() === today.getTime();
            const isWeekend = dateCopy.getDay() === 0 || dateCopy.getDay() === 6;

            // Filtrar facturas para este día específico
            const dayBills = this.bills.filter(b => {
                const bDate = new Date(b.due_date);
                bDate.setMinutes(bDate.getMinutes() + bDate.getTimezoneOffset());
                bDate.setHours(0, 0, 0, 0);
                return bDate.getTime() === dateCopy.getTime();
            });

            newDays.push({
                date: dateCopy,
                isCurrentMonth,
                isToday,
                isWeekend,
                bills: dayBills
            });

            currDate.setDate(currDate.getDate() + 1);
        }

        this.days = newDays;
    }

    prevMonth() {
        this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
        this.generateCalendar();
    }

    nextMonth() {
        this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
        this.generateCalendar();
    }

    getBillClass(bill: Bill): string {
        if (bill.status === 'paid') return 'bill-paid';
        if (bill.days_until_due !== undefined) {
            if (bill.days_until_due < 0) return 'bill-overdue';
            if (bill.days_until_due <= 3) return 'bill-urgent';
        }
        return 'bill-pending';
    }
}
