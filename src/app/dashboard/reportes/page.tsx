'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, FileSpreadsheet, Loader2, Calendar, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ReportesPage() {
  const supabase = createClient();
  const [exporting, setExporting] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  
  // Data for chart
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  // Generar últimos 6 meses para el selector
  const periods = [
    { value: 'all', label: 'Todo el histórico' },
    ...Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), i);
      return {
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: es }),
      };
    }),
  ];

  const fetchChartData = async () => {
    setLoadingChart(true);
    try {
      let query = supabase
        .from('vale_items')
        .select(`
          quantity_delivered,
          product:products(name),
          vale:vales(vale_date)
        `);

      if (selectedPeriod !== 'all') {
        const [year, month] = selectedPeriod.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();
        
        // Supabase join filtering is tricky, so we fetch all and filter in JS for the MVP, 
        // or filter by vale_date if we use inner joins.
        // For simplicity and small data, filter in JS.
      }

      const { data, error } = await query;
      if (error) throw error;

      // Ensure valid data and apply date filter in JS
      let validItems = (data as any[] || []).filter(d => d.quantity_delivered > 0 && d.vale);

      if (selectedPeriod !== 'all') {
        validItems = validItems.filter(d => {
          const valeDate = d.vale.vale_date;
          return valeDate && valeDate.startsWith(selectedPeriod);
        });
      }

      // Agrupar por producto
      const grouped: Record<string, number> = {};
      validItems.forEach(item => {
        const pName = Array.isArray(item.product) ? item.product[0]?.name : item.product?.name;
        const name = pName || 'Desconocido';
        grouped[name] = (grouped[name] || 0) + item.quantity_delivered;
      });

      // Convertir a array para recharts y tomar el top 5
      const chartArray = Object.entries(grouped)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setChartData(chartArray);
    } catch (err: any) {
      console.error('Error fetching chart data:', err);
    } finally {
      setLoadingChart(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, [selectedPeriod]);

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No hay datos disponibles para este reporte en el período seleccionado');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(h => {
          const val = row[h];
          return `"${String(val !== null && val !== undefined ? val : '').replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Add BOM for Excel utf-8 recognition
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${selectedPeriod === 'all' ? 'Historico' : selectedPeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Reporte descargado correctamente');
  };

  const handleExportStock = async () => {
    setExporting('stock');
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          created_at,
          type,
          quantity,
          reference_type,
          notes,
          product:products(name)
        `)
        .order('created_at', { ascending: false });

      if (selectedPeriod !== 'all') {
        const [year, month] = selectedPeriod.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data as any[] || []).map(d => ({
        'Fecha y Hora': format(new Date(d.created_at), "dd/MM/yyyy HH:mm"),
        'Producto': Array.isArray(d.product) ? d.product[0]?.name : d.product?.name || 'Desconocido',
        'Tipo Movimiento': d.type === 'entrada' ? 'Entrada' : 'Salida',
        'Cantidad': d.quantity,
        'Motivo / Referencia': d.reference_type,
        'Notas': d.notes || ''
      }));

      downloadCSV(formatted, 'Reporte_Movimientos_Stock');
    } catch (err: any) {
      toast.error('Error al exportar stock: ' + err.message);
    } finally {
      setExporting(null);
    }
  };

  const handleExportEPP = async () => {
    setExporting('epp');
    try {
      let query = supabase
        .from('epp_records')
        .select(`
          delivered_at,
          quantity,
          product:products(name),
          worker:workers(name, rut, area)
        `)
        .order('delivered_at', { ascending: false });

      if (selectedPeriod !== 'all') {
        const [year, month] = selectedPeriod.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();
        query = query.gte('delivered_at', startDate).lte('delivered_at', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = (data as any[] || []).map(d => {
        const product = Array.isArray(d.product) ? d.product[0] : d.product;
        const worker = Array.isArray(d.worker) ? d.worker[0] : d.worker;
        
        return {
          'Fecha Entrega': format(new Date(d.delivered_at), "dd/MM/yyyy HH:mm"),
          'Trabajador': worker?.name || 'Desconocido',
          'RUT': worker?.rut || '',
          'Área': worker?.area || '',
          'Equipo EPP': product?.name || 'Desconocido',
          'Cantidad Entregada': d.quantity
        };
      });

      downloadCSV(formatted, 'Reporte_Entregas_EPP');
    } catch (err: any) {
      toast.error('Error al exportar EPP: ' + err.message);
    } finally {
      setExporting(null);
    }
  };

  const handleExportConsumos = async () => {
    setExporting('consumos');
    try {
      const { data, error } = await supabase
        .from('vale_items')
        .select(`
          quantity_delivered,
          product:products(name),
          vale:vales(
            vale_date,
            worker:workers(area)
          )
        `);

      if (error) throw error;

      let validItems = (data as any[] || []).filter(d => d.quantity_delivered > 0 && d.vale);

      if (selectedPeriod !== 'all') {
        validItems = validItems.filter(d => {
          const vale = Array.isArray(d.vale) ? d.vale[0] : d.vale;
          return vale?.vale_date && vale.vale_date.startsWith(selectedPeriod);
        });
      }

      const formatted = validItems.map(d => {
        const product = Array.isArray(d.product) ? d.product[0] : d.product;
        const vale = Array.isArray(d.vale) ? d.vale[0] : d.vale;
        const worker = vale?.worker ? (Array.isArray(vale.worker) ? vale.worker[0] : vale.worker) : null;
        
        return {
          'Fecha': vale?.vale_date ? format(new Date(vale.vale_date), "dd/MM/yyyy") : '',
          'Área Solicitante': worker?.area || 'Sin Área',
          'Material/Consumible': product?.name || 'Desconocido',
          'Cantidad Consumida': d.quantity_delivered
        };
      });

      downloadCSV(formatted, 'Reporte_Consumos_Por_Area');
    } catch (err: any) {
      toast.error('Error al exportar consumos: ' + err.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Reportes y Exportación</h2>
          <p className="text-muted-foreground text-sm">
            Genera informes operacionales y contables en formato Excel
          </p>
        </div>
        
        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border/50">
          <Calendar className="w-4 h-4 text-primary ml-2" />
          <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v || 'all')}>
            <SelectTrigger className="w-[200px] border-0 bg-transparent shadow-none focus:ring-0">
              <SelectValue placeholder="Seleccionar período">
                {periods.find(p => p.value === selectedPeriod)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {periods.map(p => (
                <SelectItem key={p.value} value={p.value} className="capitalize">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Export Card 1 */}
        <Card className="card-glow border-border/50 hover:border-primary/20 transition-all">
          <CardHeader className="pb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">Movimientos de Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Historial completo de entradas y salidas (vales y recepciones) para conciliación.
            </p>
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={handleExportStock}
              disabled={exporting !== null}
            >
              {exporting === 'stock' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Descargar CSV (.csv)
            </Button>
          </CardContent>
        </Card>

        {/* Export Card 2 */}
        <Card className="card-glow border-border/50 hover:border-primary/20 transition-all">
          <CardHeader className="pb-3">
            <div className="w-10 h-10 rounded-lg bg-chart-4/10 text-chart-4 flex items-center justify-center mb-2">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">Reporte EPP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Consolidado de EPP entregado por período y por trabajador para mutualidades.
            </p>
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={handleExportEPP}
              disabled={exporting !== null}
            >
              {exporting === 'epp' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Descargar CSV (.csv)
            </Button>
          </CardContent>
        </Card>

        {/* Export Card 3 */}
        <Card className="card-glow border-border/50 hover:border-primary/20 transition-all">
          <CardHeader className="pb-3">
            <div className="w-10 h-10 rounded-lg bg-chart-2/10 text-chart-2 flex items-center justify-center mb-2">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <CardTitle className="text-base">Consumos por Área</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Reporte de materiales utilizados agrupados por área (Mantenimiento, Producción).
            </p>
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={handleExportConsumos}
              disabled={exporting !== null}
            >
              {exporting === 'consumos' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Descargar CSV (.csv)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Chart */}
      <Card className="card-glow mt-8 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Top 5 Ítems Más Consumidos</CardTitle>
          <p className="text-sm text-muted-foreground">
            {selectedPeriod === 'all' 
              ? 'Consumo histórico total de materiales' 
              : `Consumo total registrado en ${periods.find(p => p.value === selectedPeriod)?.label}`
            }
          </p>
        </CardHeader>
        <CardContent>
          {loadingChart ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
              <p className="text-sm text-muted-foreground">No hay datos de consumo para este período</p>
            </div>
          ) : (
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 260)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="oklch(0.60 0.02 260)" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="oklch(0.60 0.02 260)" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: 'oklch(0.20 0.015 260)' }}
                    contentStyle={{ 
                      backgroundColor: 'oklch(0.17 0.015 260)', 
                      borderColor: 'oklch(0.28 0.02 260)',
                      borderRadius: '8px'
                    }}
                    itemStyle={{ color: 'oklch(0.95 0.01 260)' }}
                  />
                  <Bar 
                    dataKey="total" 
                    name="Cantidad Entregada"
                    fill="oklch(0.67 0.14 240)" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
