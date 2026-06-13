'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { createClient } from '@/lib/supabase/client';
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
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [records, setRecords] = useState<EppRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const [viewMode, setViewMode] = usePersistentState<'cards' | 'table'>('epp-viewMode', 'cards');
  const [sortBy, setSortBy] = usePersistentState<'name_asc' | 'name_desc' | 'rut'>('epp-sortBy', 'name_asc');
  const [areaFilter, setAreaFilter] = usePersistentState<string>('epp-areaFilter', 'all');

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

  const filteredWorkers = useMemo(() => {
    let result = workers.filter(w => {
      const s = search.toLowerCase();
      const matchesSearch = w.name.toLowerCase().includes(s) || w.rut.toLowerCase().includes(s) || w.area.toLowerCase().includes(s);
      const matchesArea = areaFilter === 'all' || w.area === areaFilter;
      return matchesSearch && matchesArea;
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
  }, [workers, search, areaFilter, sortBy]);

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
              <SelectTrigger className="w-[180px] h-9">
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

            <Select value={sortBy} onValueChange={(val) => setSortBy((val || 'name_asc') as any)}>
              <SelectTrigger className="w-[150px] h-9 hidden sm:flex">
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
                    <TableHead>RUT</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Cargo</TableHead>
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
                        <TableCell className="font-mono text-sm">{worker.rut}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">{worker.area}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{worker.position}</TableCell>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-start justify-between print:hidden">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-chart-4" /> 
                Ficha EPP: {selectedWorker?.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">RUT: {selectedWorker?.rut} — {selectedWorker?.position} ({selectedWorker?.area})</p>
            </div>
            <Button variant="outline" size="sm" onClick={printRecord} className="hidden sm:flex">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir Ficha
            </Button>
          </DialogHeader>

          {/* Printable Area */}
          <div className="flex-1 overflow-y-auto pr-2 print-area print:p-8 print:text-black print:bg-white print:absolute print:inset-0">
            {/* Print Header */}
            <div className="hidden print:block mb-8 border-b-2 pb-4">
              <h2 className="text-2xl font-bold">SISTEMA GESTIÓN INTEGRAL</h2>
              <h3 className="text-xl font-semibold mt-2">Registro de Entrega - Elementos de Protección Personal</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <p><strong>RUT:</strong> {selectedWorker?.rut}</p>
                <p><strong>Nombre:</strong> {selectedWorker?.name}</p>
                <p><strong>Cargo:</strong> {selectedWorker?.position}</p>
                <p><strong>Área:</strong> {selectedWorker?.area}</p>
              </div>
              <p className="text-xs mt-4 italic">
                Declaro recibir los Elementos de Protección Personal detallados a continuación, instruyéndome sobre su uso, mantención y reposición,
                comprometiéndome a usarlos en forma permanente durante la jornada laboral en las áreas donde sean requeridos.
              </p>
            </div>

            {records.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground print:hidden">
                <p>El trabajador aún no tiene EPP registrado en el sistema histórico.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record: any) => (
                  <div key={record.id} className="p-3 border rounded-lg bg-muted/20 print:bg-transparent print:border-black print:rounded-none flex justify-between">
                    <div>
                      <h4 className="font-semibold text-sm print:text-base">
                        {record.product?.name} <span className="font-normal text-muted-foreground print:text-black">x{record.quantity} {record.product?.unit}</span>
                      </h4>
                      <p className="text-xs text-muted-foreground print:text-black">
                        Fecha Entrega: {format(new Date(record.delivered_at), "d MMMM yyyy, HH:mm", { locale: es })}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1 print:hidden flex gap-3">
                        <span>Aut: {record.authorizer?.full_name || '-'}</span>
                        <span>Bodega: {record.processor?.full_name || '-'}</span>
                      </div>
                    </div>
                    
                    {/* Signature block placeholder for print mode */}
                    <div className="hidden print:flex flex-col justify-end items-center mr-8">
                      <div className="w-40 border-b border-black mb-1"></div>
                      <span className="text-xs">Firma Receptor</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="hidden print:block mt-12 text-sm">
              <p>Fecha impresión: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* CSS For Printing */}
      <style dangerouslySetInnerHTML={{__html:`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}} />
    </div>
  );
}
