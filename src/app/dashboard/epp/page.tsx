'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, HardHat, FileText, Printer, LayoutGrid, List, ArrowDownAZ, ArrowUpAZ, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Worker, EppRecord } from '@/lib/types';

export default function EppPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [records, setRecords] = useState<EppRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const [viewMode, setViewMode] = usePersistentState<'cards' | 'table'>('epp-viewMode', 'cards');
  const [sortBy, setSortBy] = usePersistentState<'name_asc' | 'name_desc' | 'rut'>('epp-sortBy', 'name_asc');
  const [areaFilter, setAreaFilter] = usePersistentState<string>('epp-areaFilter', 'all');
  const [positionFilter, setPositionFilter] = usePersistentState<string>('epp-positionFilter', 'all');
  const [recordFilter, setRecordFilter] = useState<'all' | 'this_month' | 'last_month' | 'this_year'>('all');

  useEffect(() => {
    const fetchData = async () => {
      const { data: workersData } = await supabase
        .from('workers')
        .select('*')
        .eq('active', true)
        .order('name');
      
      setWorkers(workersData as Worker[] || []);
      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  // Fetch EPP records when a worker is selected
  useEffect(() => {
    if (!selectedWorker) return;
    
    const fetchWorkerRecords = async () => {
      const { data } = await supabase
        .from('epp_records')
        .select(`
          *,
          product:products(*),
          vale:vales(signature),
          authorizer:profiles!epp_records_authorized_by_fkey(full_name),
          processor:profiles!epp_records_processed_by_fkey(full_name)
        `)
        .eq('worker_id', selectedWorker.id)
        .order('delivered_at', { ascending: false });
        
      setRecords(data as any[] || []);
    };
    
    fetchWorkerRecords();
  }, [selectedWorker, supabase]);

  const uniqueAreas = useMemo(() => {
    const areas = new Set(workers.map(w => w.area).filter(Boolean));
    return Array.from(areas).sort();
  }, [workers]);

  const uniquePositions = useMemo(() => {
    const positions = new Set(workers.map(w => w.position).filter(Boolean));
    return Array.from(positions).sort();
  }, [workers]);

  const filteredWorkers = useMemo(() => {
    let result = workers.filter(w => {
      const s = search.toLowerCase();
      const matchesSearch = w.name.toLowerCase().includes(s) || w.rut.toLowerCase().includes(s) || w.area.toLowerCase().includes(s);
      const matchesArea = areaFilter === 'all' || w.area === areaFilter;
      const matchesPosition = positionFilter === 'all' || w.position === positionFilter;
      return matchesSearch && matchesArea && matchesPosition;
    });

    switch (sortBy) {
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'rut':
        result.sort((a, b) => a.rut.localeCompare(b.rut));
        break;
    }
    
    return result;
  }, [workers, search, areaFilter, positionFilter, sortBy]);

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    const now = new Date();
    
    return records.filter(record => {
      const recordDate = new Date(record.delivered_at);
      if (recordFilter === 'all') return true;
      if (recordFilter === 'this_month') {
        return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      }
      if (recordFilter === 'last_month') {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return recordDate.getMonth() === lastMonthDate.getMonth() && recordDate.getFullYear() === lastMonthDate.getFullYear();
      }
      if (recordFilter === 'this_year') {
        return recordDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [records, recordFilter]);

  const printRecord = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Control de EPP</h2>
          <p className="text-muted-foreground text-sm">
            Ficha de entrega por trabajador (Respaldo Legal)
          </p>
        </div>
      </div>

      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
             <Button variant={viewMode === 'cards' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('cards')} title="Vista de Tarjetas">
               <LayoutGrid className="w-4 h-4" />
             </Button>
             <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('table')} title="Vista de Tabla">
               <List className="w-4 h-4" />
             </Button>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar trabajador o RUT..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Select value={areaFilter} onValueChange={(val) => setAreaFilter(val || 'all')}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder="Todas las áreas">
                  {areaFilter === 'all' ? 'Todas las áreas' : areaFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {uniqueAreas.map(area => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={positionFilter} onValueChange={(val) => setPositionFilter(val || 'all')}>
              <SelectTrigger className="w-full sm:w-[180px] h-9">
                <SelectValue placeholder="Todos los cargos">
                  {positionFilter === 'all' ? 'Todos los cargos' : positionFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los cargos</SelectItem>
                {uniquePositions.map(pos => (
                  <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(val) => setSortBy((val || 'name_asc') as any)}>
              <SelectTrigger className="w-full sm:w-[150px] h-9">
                <SelectValue placeholder="Ordenar por...">
                  {sortBy === 'name_asc' && <div className="flex items-center"><ArrowDownAZ className="w-4 h-4 mr-2" /> A - Z</div>}
                  {sortBy === 'name_desc' && <div className="flex items-center"><ArrowUpAZ className="w-4 h-4 mr-2" /> Z - A</div>}
                  {sortBy === 'rut' && <div className="flex items-center"><Hash className="w-4 h-4 mr-2" /> RUT</div>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc"><div className="flex items-center"><ArrowDownAZ className="w-4 h-4 mr-2" /> A - Z</div></SelectItem>
                <SelectItem value="name_desc"><div className="flex items-center"><ArrowUpAZ className="w-4 h-4 mr-2" /> Z - A</div></SelectItem>
                <SelectItem value="rut"><div className="flex items-center"><Hash className="w-4 h-4 mr-2" /> RUT</div></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'cards' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredWorkers.map(worker => (
                <Card 
                  key={worker.id} 
                  className="card-glow border-border/50 hover:border-primary/50 cursor-pointer transition-all"
                  onClick={() => setSelectedWorker(worker)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-chart-4/15 text-chart-4 rounded-full flex items-center justify-center shrink-0">
                      <HardHat className="w-6 h-6" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-semibold text-sm truncate">{worker.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{worker.rut}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{worker.area}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredWorkers.length === 0 && (
                <div className="col-span-full text-center py-10 opacity-50">
                  Ningún trabajador coincide con tu búsqueda.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">RUT</TableHead>
                    <TableHead className="hidden md:table-cell">Área</TableHead>
                    <TableHead className="hidden md:table-cell">Cargo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Ningún trabajador coincide con tu búsqueda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWorkers.map(worker => (
                      <TableRow key={worker.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedWorker(worker)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-chart-4/15 text-chart-4 rounded-full flex items-center justify-center shrink-0">
                              <HardHat className="w-4 h-4" />
                            </div>
                            {worker.name}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm hidden sm:table-cell">{worker.rut}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary" className="font-normal">{worker.area}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{worker.position}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorker(worker);
                            }}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Ver Ficha
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedWorker} onOpenChange={() => setSelectedWorker(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-col items-start gap-4 print:hidden pr-8 pb-2">
            <div className="w-full">
              <DialogTitle className="text-xl font-bold flex items-start sm:items-center gap-2 whitespace-normal text-left">
                <FileText className="w-5 h-5 text-chart-4 shrink-0 mt-0.5 sm:mt-0" /> 
                <span>Ficha EPP: {selectedWorker?.name}</span>
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1 whitespace-normal text-left">RUT: {selectedWorker?.rut} — {selectedWorker?.position} ({selectedWorker?.area})</p>
            </div>
            <div className="flex flex-row flex-wrap items-center gap-2 w-full">
              <Select value={recordFilter} onValueChange={(v: any) => setRecordFilter(v)}>
                <SelectTrigger className="w-[140px] sm:w-[180px] h-9 shrink-0">
                  <SelectValue placeholder="Periodo">
                    {recordFilter === 'all' && 'Histórico Completo'}
                    {recordFilter === 'this_month' && 'Mes Actual'}
                    {recordFilter === 'last_month' && 'Mes Anterior'}
                    {recordFilter === 'this_year' && 'Año Actual'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Histórico Completo</SelectItem>
                  <SelectItem value="this_month">Mes Actual</SelectItem>
                  <SelectItem value="last_month">Mes Anterior</SelectItem>
                  <SelectItem value="this_year">Año Actual</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={printRecord} className="h-9 shrink-0">
                <Printer className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
            </div>
          </DialogHeader>

          {/* Printable Area / Document Preview */}
          <div className="flex-1 overflow-auto bg-muted/30 p-4 sm:p-6 print:p-0 print:bg-white print:absolute print:inset-0">
            
            {/* The Document "Paper" */}
            <div className="print-area bg-white text-black w-full min-w-0 sm:w-[800px] sm:min-w-[800px] mx-auto rounded-none sm:rounded-md shadow-sm sm:shadow-md border border-border/50 print:border-none print:shadow-none p-6 sm:p-10 min-h-0 sm:min-h-[1050px] print:w-full print:min-w-0 print:min-h-0 print:mx-0">
              
              {/* Header */}
              <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Sistema Gestión Integral</h2>
                  <h3 className="text-base sm:text-lg font-semibold mt-1 uppercase text-gray-700">Registro de Entrega - EPP</h3>
                </div>
                <div className="text-right text-xs sm:text-sm">
                  <p className="font-bold">HORMIBAL</p>
                  <p className="text-gray-500">Bodega Central</p>
                </div>
              </div>

              {/* Worker Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-y-3 gap-x-8 text-sm mb-6 bg-gray-50 print:bg-transparent p-4 rounded border border-gray-200 print:border-none print:p-0">
                <p><span className="font-bold text-gray-600">RUT:</span> <span className="font-mono text-base">{selectedWorker?.rut}</span></p>
                <p><span className="font-bold text-gray-600">Nombre:</span> <span className="uppercase">{selectedWorker?.name}</span></p>
                <p><span className="font-bold text-gray-600">Cargo:</span> {selectedWorker?.position}</p>
                <p><span className="font-bold text-gray-600">Área:</span> {selectedWorker?.area}</p>
              </div>

              {/* Legal Text */}
              <div className="mb-6 p-4 border border-gray-300 text-xs text-justify bg-gray-50 print:bg-transparent">
                <p className="font-bold mb-1">DECLARACIÓN DEL TRABAJADOR:</p>
                <p>
                  Declaro recibir conforme los Elementos de Protección Personal (EPP) detallados a continuación, adecuados a los riesgos de mi labor. 
                  He sido instruido sobre su correcto uso, mantención y reposición. Me comprometo a utilizarlos de forma obligatoria y permanente 
                  durante la jornada laboral en las áreas donde sean requeridos, de acuerdo a la Ley 16.744 y el Reglamento Interno de la empresa.
                </p>
              </div>

              {/* Records Table */}
              {records.length === 0 ? (
                <div className="text-center py-10 text-gray-500 italic">
                  El trabajador aún no tiene entregas de EPP registradas en el sistema.
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-10 text-gray-500 italic">
                  No hay entregas de EPP en el periodo seleccionado.
                </div>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-sm border-collapse mb-10">
                  <thead>
                    <tr className="border-b-2 border-black text-left">
                      <th className="py-2 px-2 font-bold">Fecha</th>
                      <th className="py-2 px-2 font-bold">Elemento de Protección</th>
                      <th className="py-2 px-2 font-bold text-center">Cant.</th>
                      <th className="py-2 px-2 font-bold text-center">Firma Receptor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record: any) => (
                      <tr key={record.id} className="border-b border-gray-300">
                        <td className="py-4 px-2 whitespace-nowrap">
                          {format(new Date(record.delivered_at), "dd/MM/yyyy")}
                        </td>
                        <td className="py-4 px-2">
                          <p className="font-semibold">{record.product?.name}</p>
                          {record.product?.brand && <p className="text-xs text-gray-500">Marca: {record.product.brand}</p>}
                        </td>
                        <td className="py-4 px-2 text-center">{record.quantity} {record.product?.unit}</td>
                        <td className="py-2 px-2 text-center align-middle h-16">
                          {record.vale && record.vale.signature ? (
                            <div className="flex flex-col items-center justify-center">
                              <img src={record.vale.signature} alt="Firma Trabajador" className="h-12 object-contain" />
                              <div className="w-32 border-b border-gray-400 mt-1"></div>
                            </div>
                          ) : (
                            <div className="w-32 mx-auto border-b border-gray-400 mt-6"></div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
              
              {/* Footer */}
              <div className="mt-12 text-xs text-gray-400 flex justify-between print:mt-auto">
                <p>Impreso por: {profile?.full_name}</p>
                <p>Fecha impresión: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* CSS For Printing */}
      <style dangerouslySetInnerHTML={{__html:`
        @media print {
          @page { margin: 1cm; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
          .print-area table { page-break-inside: auto; }
          .print-area tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}} />
    </div>
  );
}
