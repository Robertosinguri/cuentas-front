import { Component, OnInit, ElementRef, ViewChild, inject, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportService, ReportData } from '../../services/report.service';
import Chart from 'chart.js/auto';

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './reports.component.html',
    styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('annualChart') annualChartRef!: ElementRef;
    @ViewChild('linesChart') linesChartRef!: ElementRef;

    private reportService = inject(ReportService);

    annualChartInstance: any;
    linesChartInstance: any;
    reportData: ReportData | null = null;

    loading = true;

    ngOnInit() { }

    ngAfterViewInit() {
        this.loadCharts();
    }

    loadCharts() {
        this.reportService.getAnnualReport().subscribe({
            next: (data) => {
                this.reportData = data;
                this.loading = false;
                // Wait a tick for canvas to render
                setTimeout(() => {
                    this.buildLinesChart(data);
                    this.buildAnnualChart(data);
                }, 0);
            },
            error: (err) => {
                console.error('Error fetching report', err);
                this.loading = false;
            }
        });
    }

    buildAnnualChart(data: ReportData) {
        if (this.annualChartInstance) {
            this.annualChartInstance.destroy();
        }
        const ctx = this.annualChartRef.nativeElement.getContext('2d');
        this.annualChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Gastos Totales',
                    data: data.monthly_totals,
                    backgroundColor: '#4ade80',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Total de Gastos Anual', color: '#f3f4f6' }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                    x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } }
                }
            }
        });
    }

    buildLinesChart(data: ReportData) {
        if (this.linesChartInstance) {
            this.linesChartInstance.destroy();
        }
        const ctx = this.linesChartRef.nativeElement.getContext('2d');

        // Generate distinct colors for datasets
        const colors = ['#f87171', '#60a5fa', '#fbbf24', '#c084fc', '#34d399', '#f472b6', '#a78bfa'];

        const datasets = data.lines.map((line, ix) => ({
            label: line.label,
            data: line.data,
            borderColor: colors[ix % colors.length],
            backgroundColor: colors[ix % colors.length] + '40', // slightly transparent
            tension: 0.3,
            fill: false,
            spanGaps: true,
            segment: {
                borderDash: (ctx: any) => ctx.p0DataIndex !== ctx.p1DataIndex - 1 ? [6, 6] : undefined
            }
        }));

        this.linesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'right', labels: { color: '#f3f4f6' } },
                    title: { display: true, text: 'Evolución por Factura', color: '#f3f4f6' }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } },
                    x: { grid: { color: '#374151' }, ticks: { color: '#9ca3af' } }
                }
            }
        });
    }

    ngOnDestroy() {
        if (this.annualChartInstance) this.annualChartInstance.destroy();
        if (this.linesChartInstance) this.linesChartInstance.destroy();
    }
}
