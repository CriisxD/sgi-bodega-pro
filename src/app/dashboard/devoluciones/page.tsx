'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, Undo2, Loader2, Wrench, FileArchive, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import type { Worker, Product } from '@/lib/types';

export default function DevolucionesPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Return Modal states
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [conditionNotes, setConditionNotes] = useState('');
  const [reingresarStock, setReingresarStock] = useState(true);
  const [processing, setProcessing] = useState(false);

  // New Assignment Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tools, setTools] = useState<Product[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [toolSearch, setToolSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [assignType, setAssignType] = useState<'uso_diario' | 'cargo_personal'>('uso_diario');
  const [assigning, setAssigning] = useState(false);

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('tool_assignments')
      .select(`
        *,
        worker:workers(*),
        product:products(*),
        vale:vales(vale_number, type)
      `)
      .eq('status', 'activo')
      .order('assigned_at', { ascending: false });

    setAssignments(data || []);
  };

  const fetchWorkersAndTools = async () => {
    // Workers
    const { data: w } = await supabase.from('workers').select('*').eq('active', true).order('name');
    setWorkers(w as Worker[] || []);

    // Tools
    const { data: t } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('active', true)
      .eq('categories.type', 'herramienta')
      .order('name');
    setTools(t as Product[] || []);
  };

  useEffect(() => {
    const init = async () => {
      await fetchAssignments();
      await fetchWorkersAndTools();
      setLoading(false);
    };
    init();
  }, [supabase]);

  const filteredAssignments = assignments.filter((a) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (a.worker?.name || '').toLowerCase().includes(s) ||
      (a.product?.name || '').toLowerCase().includes(s) ||
      (a.vale?.vale_number?.toString() || '').includes(s)
    );
  });

  const filteredWorkers = useMemo(() => {
    if (!workerSearch) return workers;
    return workers.filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase()) || w.rut.toLowerCase().includes(workerSearch.toLowerCase()));
  }, [workers, workerSearch]);

  const filteredTools = useMemo(() => {
    if (!toolSearch) return tools;
    return tools.filter(t => t.name.toLowerCase().includes(toolSearch.toLowerCase()));
  }, [tools, toolSearch]);

  const handleReturn = async () => {
    if (!selectedAssignment || !profile) return;
    setProcessing(true);

    try {
      await supabase
        .from('tool_assignments')
        .update({
          status: 'devuelto',
          returned_at: new Date().toISOString(),
          condition_notes: conditionNotes || null,
        })
        .eq('id', selectedAssignment.id);

      if (reingresarStock) {
        await supabase.rpc('increase_stock', {
          p_product_id: selectedAssignment.product_id,
          p_quantity: 1,
        });

        await supabase.from('stock_movements').insert({
          product_id: selectedAssignment.product_id,
          type: 'entrada',
          quantity: 1,
          reference_type: 'devolucion',
          reference_id: selectedAssignment.id,
          notes: `Devolución - Vale #${selectedAssignment.vale?.vale_number || 'Directo'}`,
          created_by: profile.id,
        });
      }

      toast.success(`Ítem ${selectedAssignment.product?.name} marcado como devuelto.`);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (error: any) {
      toast.error('Error al procesar devolución: ' + error.message);
    } finally {
      setProcessing(false);
      setConditionNotes('');
    }
  };

  const handleAssign = async () => {
    if (!selectedWorker || !selectedTool || !profile) return;
    setAssigning(true);

    try {
      const tool = tools.find(t => t.id === selectedTool);
      if (!tool || tool.stock <= 0) throw new Error('Herramienta sin stock');

      // Create assignment
      const { data: assignment, error } = await supabase
        .from('tool_assignments')
        .insert({
          worker_id: selectedWorker,
          product_id: selectedTool,
          status: 'activo',
          assigned_at: new Date().toISOString(),
          // vale_id is null since it's direct
        })
        .select()
        .single();

      if (error) throw error;

      // Decrease stock
      await supabase.rpc('decrease_stock', {
        p_product_id: selectedTool,
        p_quantity: 1,
      });

      // Stock movement
      await supabase.from('stock_movements').insert({
        product_id: selectedTool,
        type: 'salida',
        quantity: 1,
        reference_type: 'cargo',
        reference_id: assignment.id,
        notes: `Asignación directa - ${assignType === 'uso_diario' ? 'Uso Diario' : 'Cargo Personal'}`,
        created_by: profile.id,
      });

      toast.success('Herramienta asignada exitosamente');
      setIsNewModalOpen(false);
      setSelectedWorker('');
      setSelectedTool('');
      setWorkerSearch('');
      setToolSearch('');
      
      // Refresh data
      fetchAssignments();
      fetchWorkersAndTools();
    } catch (error: any) {
      toast.error('Error al asignar: ' + error.message);
    } finally {
      setAssigning(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Préstamos y Devoluciones</h2>
          <p className="text-muted-foreground text-sm">
            {filteredAssignments.length} ítem{filteredAssignments.length !== 1 && 's'} pendiente{filteredAssignments.length !== 1 && 's'} de devolución
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar trabajador o ítem..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
            <DialogTrigger render={
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Prestar Herramienta
              </Button>
            } />
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  Nueva Asignación Directa
                </DialogTitle>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                {/* Tipo de asignación */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setAssignType('uso_diario')}
                    className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                      assignType === 'uso_diario' ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border/50 hover:border-border bg-card/50'
                    }`}
                  >
                    <p className="font-medium text-sm">Uso Diario</p>
                    <p className="text-xs text-muted-foreground mt-1">Devolución hoy mismo</p>
                  </button>
                  <button
                    onClick={() => setAssignType('cargo_personal')}
                    className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                      assignType === 'cargo_personal' ? 'border-chart-3 bg-chart-3/5 ring-1 ring-chart-3/30' : 'border-border/50 hover:border-border bg-card/50'
                    }`}
                  >
                    <p className="font-medium text-sm">Cargo Personal</p>
                    <p className="text-xs text-muted-foreground mt-1">Asignación indefinida</p>
                  </button>
                </div>

                {/* Worker selection */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">Seleccionar Trabajador</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar trabajador..."
                      className="pl-9"
                      value={workerSearch}
                      onChange={(e) => setWorkerSearch(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 max-h-40 overflow-y-auto">
                    {filteredWorkers.map((worker) => (
                      <button
                        key={worker.id}
                        onClick={() => setSelectedWorker(worker.id)}
                        className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                          selectedWorker === worker.id ? 'border-primary bg-primary/5' : 'border-border/50 bg-card/50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{worker.name}</p>
                          <p className="text-xs text-muted-foreground">{worker.rut} · {worker.area}</p>
                        </div>
                        {selectedWorker === worker.id && <CheckCircle className="w-4 h-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tool selection */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">Seleccionar Herramienta</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar herramienta..."
                      className="pl-9"
                      value={toolSearch}
                      onChange={(e) => setToolSearch(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 max-h-40 overflow-y-auto">
                    {filteredTools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => tool.stock > 0 && setSelectedTool(tool.id)}
                        disabled={tool.stock <= 0}
                        className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                          tool.stock <= 0 ? 'opacity-50 cursor-not-allowed bg-muted' : 
                          selectedTool === tool.id ? 'border-primary bg-primary/5' : 'border-border/50 bg-card/50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{tool.name}</p>
                          <p className="text-xs text-muted-foreground">Stock actual: {tool.stock} un</p>
                        </div>
                        {selectedTool === tool.id && <CheckCircle className="w-4 h-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t mt-auto">
                <Button variant="outline" onClick={() => setIsNewModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleAssign} disabled={assigning || !selectedWorker || !selectedTool}>
                  {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wrench className="w-4 h-4 mr-2" />}
                  Asignar Herramienta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredAssignments.length === 0 ? (
        <Card className="card-glow border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Undo2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No hay devoluciones pendientes</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Todos los ítems de cargo o uso diario han sido retornados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAssignments.map((assignment) => (
            <Card
              key={assignment.id}
              className="card-glow border-border/50 hover:border-primary/20 transition-all cursor-pointer"
              onClick={() => setSelectedAssignment(assignment)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg font-mono">
                          {assignment.product?.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            assignment.vale?.type === 'cargo_personal'
                              ? 'bg-chart-3/15 text-chart-3'
                              : 'bg-chart-2/15 text-chart-2'
                          }
                        >
                          {assignment.vale ? (assignment.vale.type === 'cargo_personal' ? 'Cargo Personal' : 'Uso Diario') : 'Asignación Directa'}
                        </Badge>
                      </div>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Prestado a:</span>{' '}
                        <span className="font-medium">{assignment.worker?.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {assignment.vale ? `Vale #${assignment.vale.vale_number} · ` : ''} 
                        {format(new Date(assignment.assigned_at), "d MMM HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <Button size="sm" className="mt-2" variant="outline">
                      <Undo2 className="w-4 h-4 mr-1" />
                      Recibir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Return Dialog */}
      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-primary" />
              Recibir Devolución
            </DialogTitle>
          </DialogHeader>

          {selectedAssignment && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ítem:</span>
                  <span className="font-medium">{selectedAssignment.product?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trabajador:</span>
                  <span className="font-medium">{selectedAssignment.worker?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha préstamo:</span>
                  <span className="font-medium">
                    {format(new Date(selectedAssignment.assigned_at), "d MMM yyyy, HH:mm", {
                      locale: es,
                    })}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Estado/Condición del ítem
                </label>
                <Textarea
                  placeholder="Ej. Ítem en buen estado, o presenta daños..."
                  value={conditionNotes}
                  onChange={(e) => setConditionNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reingresar"
                  checked={reingresarStock}
                  onChange={(e) => setReingresarStock(e.target.checked)}
                  className="rounded border-gray-300 text-primary w-4 h-4"
                />
                <label htmlFor="reingresar" className="text-sm">
                  Reingresar al inventario (aumentar stock)
                </label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setSelectedAssignment(null)}>
              Cancelar
            </Button>
            <Button onClick={handleReturn} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <FileArchive className="w-4 h-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
