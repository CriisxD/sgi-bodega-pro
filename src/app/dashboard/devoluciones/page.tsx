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
import { Search, Undo2, Loader2, Wrench, FileArchive, Plus, CheckCircle, ArrowLeft, ArrowRight, PenTool, Minus, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { FullScreenSignatureModal } from '@/components/shared/full-screen-signature';
import type { Worker, Product } from '@/lib/types';

type TabFilter = 'activos' | 'devueltos' | 'todos';

export default function DevolucionesPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tabFilter, setTabFilter] = useState<TabFilter>('activos');
  
  // Return Modal states
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [conditionNotes, setConditionNotes] = useState('');
  const [reingresarStock, setReingresarStock] = useState(true);
  const [processing, setProcessing] = useState(false);

  // New Assignment Wizard states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tools, setTools] = useState<Product[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [toolSearch, setToolSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedTool, setSelectedTool] = useState('');
  const [assignType, setAssignType] = useState<'uso_diario' | 'cargo_personal'>('uso_diario');
  const [assigning, setAssigning] = useState(false);
  const [assignStep, setAssignStep] = useState(1);
  const [assignQuantity, setAssignQuantity] = useState(1);
  
  // Signature states
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  const totalSteps = 4;

  const handleOpenNewModal = (open: boolean) => {
    setIsNewModalOpen(open);
    if (open) {
      setAssignStep(1);
      setSelectedWorker('');
      setSelectedTool('');
      setAssignQuantity(1);
      setSignatureData(null);
      setWorkerSearch('');
      setToolSearch('');
    }
  };

  const fetchAssignments = async () => {
    let query = supabase
      .from('tool_assignments')
      .select(`
        *,
        worker:workers(*),
        product:products(*),
        vale:vales(vale_number, type)
      `)
      .order('assigned_at', { ascending: false });

    if (tabFilter === 'activos') {
      query = query.eq('status', 'activo');
    } else if (tabFilter === 'devueltos') {
      query = query.eq('status', 'devuelto');
    }
    // 'todos' fetches all

    const { data } = await query;
    setAssignments(data || []);
  };

  const fetchWorkersAndTools = async () => {
    // Workers
    const { data: w } = await supabase.from('workers').select('*').eq('active', true).order('name');
    setWorkers(w as Worker[] || []);

    // Tools & Materials (excluding EPP and aseo), only with stock > 0
    const { data: t } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('active', true)
      .gt('stock', 0)
      .order('name');
    // Filter out EPP and aseo categories client-side since we need to check joined category type
    setTools((t as Product[] || []).filter(p => p.category && p.category.type !== 'epp' && p.category.type !== 'aseo'));
  };

  useEffect(() => {
    const init = async () => {
      await fetchAssignments();
      await fetchWorkersAndTools();
      setLoading(false);
    };
    init();
  }, [supabase]);

  // Refetch when tab changes
  useEffect(() => {
    if (!loading) {
      fetchAssignments();
    }
  }, [tabFilter]);

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

  const selectedToolData = tools.find(t => t.id === selectedTool);

  const handleReturn = async () => {
    if (!selectedAssignment || !profile) return;
    setProcessing(true);

    try {
      const qty = selectedAssignment.quantity || 1;

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
          p_quantity: qty,
        });

        await supabase.from('stock_movements').insert({
          product_id: selectedAssignment.product_id,
          type: 'entrada',
          quantity: qty,
          reference_type: 'devolucion',
          reference_id: selectedAssignment.id,
          notes: `Devolución${qty > 1 ? ` (x${qty})` : ''} - ${selectedAssignment.vale ? `Vale #${selectedAssignment.vale.vale_number}` : 'Directo'}`,
          created_by: profile.id,
        });
      }

      toast.success(`${selectedAssignment.product?.name}${qty > 1 ? ` (x${qty})` : ''} marcado como devuelto.`);
      setSelectedAssignment(null);
      fetchAssignments();
      fetchWorkersAndTools();
    } catch (error: any) {
      toast.error('Error al procesar devolución: ' + error.message);
    } finally {
      setProcessing(false);
      setConditionNotes('');
    }
  };

  const handleAssign = async () => {
    if (!selectedWorker || !selectedTool || !signatureData || !profile) return;
    setAssigning(true);

    try {
      const tool = tools.find(t => t.id === selectedTool);
      if (!tool || tool.stock < assignQuantity) throw new Error('Stock insuficiente');

      // Create assignment
      const { data: assignment, error } = await supabase
        .from('tool_assignments')
        .insert({
          worker_id: selectedWorker,
          product_id: selectedTool,
          status: 'activo',
          assigned_at: new Date().toISOString(),
          quantity: assignQuantity,
          signature: signatureData,
        })
        .select()
        .single();

      if (error) throw error;

      // Decrease stock
      await supabase.rpc('decrease_stock', {
        p_product_id: selectedTool,
        p_quantity: assignQuantity,
      });

      // Stock movement
      await supabase.from('stock_movements').insert({
        product_id: selectedTool,
        type: 'salida',
        quantity: assignQuantity,
        reference_type: 'cargo',
        reference_id: assignment.id,
        notes: `Asignación directa${assignQuantity > 1 ? ` (x${assignQuantity})` : ''} - ${assignType === 'uso_diario' ? 'Uso Diario' : 'Cargo Personal'}`,
        created_by: profile.id,
      });

      toast.success(`${assignQuantity > 1 ? `${assignQuantity}x ` : ''}${tool.name} asignado exitosamente`);
      handleOpenNewModal(false);
      
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

  const activeCount = assignments.filter(a => a.status === 'activo').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Préstamos y Devoluciones</h2>
          <p className="text-muted-foreground text-sm">
            {tabFilter === 'activos' 
              ? `${filteredAssignments.length} ítem${filteredAssignments.length !== 1 ? 's' : ''} pendiente${filteredAssignments.length !== 1 ? 's' : ''} de devolución`
              : tabFilter === 'devueltos'
              ? `${filteredAssignments.length} ítem${filteredAssignments.length !== 1 ? 's' : ''} devuelto${filteredAssignments.length !== 1 ? 's' : ''}`
              : `${filteredAssignments.length} registro${filteredAssignments.length !== 1 ? 's' : ''} en total`
            }
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

          <Dialog open={isNewModalOpen} onOpenChange={handleOpenNewModal}>
            <DialogTrigger render={
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Prestar Material / Herramienta
              </Button>
            } />
            <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  Nuevo Préstamo
                </DialogTitle>
                <div className="flex justify-between text-xs font-medium text-muted-foreground mt-2 px-1">
                  <span>Paso {assignStep} de {totalSteps}</span>
                  <span>{assignStep === 1 ? 'Tipo' : assignStep === 2 ? 'Trabajador' : assignStep === 3 ? 'Material' : 'Firma'}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${((assignStep - 1) / (totalSteps - 1)) * 100}%` }}
                  />
                </div>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-2 min-h-[300px]">
                {/* PASO 1: Tipo */}
                {assignStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-center mb-4">¿Qué tipo de préstamo necesitas?</h3>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setAssignType('uso_diario')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          assignType === 'uso_diario' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border/50 hover:border-primary/50 bg-card/50'
                        }`}
                      >
                        <p className="font-bold text-lg">Uso Diario</p>
                        <p className="text-sm text-muted-foreground mt-1">Devolución obligatoria al finalizar el turno hoy mismo.</p>
                      </button>
                      <button
                        onClick={() => setAssignType('cargo_personal')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          assignType === 'cargo_personal' ? 'border-chart-3 bg-chart-3/5 ring-2 ring-chart-3/20' : 'border-border/50 hover:border-primary/50 bg-card/50'
                        }`}
                      >
                        <p className="font-bold text-lg">Cargo Personal</p>
                        <p className="text-sm text-muted-foreground mt-1">Asignación indefinida de herramientas bajo responsabilidad del trabajador.</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* PASO 2: Trabajador */}
                {assignStep === 2 && (
                  <div className="space-y-4 h-full flex flex-col">
                    <h3 className="font-medium text-center">¿A quién se le prestará?</h3>
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre o RUT..."
                        className="pl-10 h-12 text-base rounded-xl"
                        value={workerSearch}
                        onChange={(e) => setWorkerSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="grid gap-2 flex-1 overflow-y-auto">
                      {filteredWorkers.map((worker) => (
                        <button
                          key={worker.id}
                          onClick={() => setSelectedWorker(worker.id)}
                          className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                            selectedWorker === worker.id ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border/50 bg-card/50 hover:border-primary/50'
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{worker.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5"><span className="font-mono">{worker.rut}</span> · {worker.area}</p>
                          </div>
                          {selectedWorker === worker.id && <CheckCircle className="w-5 h-5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* PASO 3: Material / Herramienta + Cantidad */}
                {assignStep === 3 && (
                  <div className="space-y-4 h-full flex flex-col">
                    <h3 className="font-medium text-center">¿Qué material o herramienta necesita?</h3>
                    <div className="relative shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar en bodega..."
                        className="pl-10 h-12 text-base rounded-xl"
                        value={toolSearch}
                        onChange={(e) => setToolSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="grid gap-2 flex-1 overflow-y-auto">
                      {filteredTools.map((tool) => (
                        <button
                          key={tool.id}
                          onClick={() => {
                            setSelectedTool(tool.id);
                            setAssignQuantity(1);
                          }}
                          className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                            selectedTool === tool.id ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border/50 bg-card/50 hover:border-primary/50'
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{tool.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Stock: {tool.stock} {tool.unit} {tool.category && `· ${tool.category.name}`}
                            </p>
                          </div>
                          {selectedTool === tool.id && <CheckCircle className="w-5 h-5 text-primary" />}
                        </button>
                      ))}
                      {filteredTools.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No hay productos con stock disponible</p>
                        </div>
                      )}
                    </div>

                    {/* Quantity selector */}
                    {selectedToolData && (
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl shrink-0 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm">{selectedToolData.name}</span>
                          <Badge variant="outline">Stock: {selectedToolData.stock}</Badge>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-10 w-10 rounded-full"
                            onClick={() => setAssignQuantity(Math.max(1, assignQuantity - 1))}
                            disabled={assignQuantity <= 1}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={selectedToolData.stock}
                            value={assignQuantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val >= 1 && val <= selectedToolData.stock) {
                                setAssignQuantity(val);
                              }
                            }}
                            className="w-20 h-12 text-center text-xl font-bold border-primary/30"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-10 w-10 rounded-full"
                            onClick={() => setAssignQuantity(Math.min(selectedToolData.stock, assignQuantity + 1))}
                            disabled={assignQuantity >= selectedToolData.stock}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                          {assignQuantity} de {selectedToolData.stock} disponibles
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* PASO 4: Firma */}
                {assignStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-center">Firma del trabajador</h3>
                    
                    {/* Resumen */}
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo:</span>
                        <Badge variant="outline">{assignType === 'uso_diario' ? 'Uso Diario' : 'Cargo Personal'}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trabajador:</span>
                        <span className="font-medium">{workers.find(w => w.id === selectedWorker)?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Material:</span>
                        <span className="font-medium">{selectedToolData?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cantidad:</span>
                        <span className="font-bold text-primary">{assignQuantity} {selectedToolData?.unit}</span>
                      </div>
                    </div>

                    {/* Firma area */}
                    {!signatureData ? (
                      <button
                        onClick={() => setIsSignatureModalOpen(true)}
                        className="w-full p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all flex flex-col items-center gap-2"
                      >
                        <PenTool className="w-8 h-8 text-primary" />
                        <span className="font-medium text-primary">Presione para firmar</span>
                        <span className="text-xs text-muted-foreground">La pantalla se abrirá completa para firmar cómodamente</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-white border border-success/30 flex items-center justify-center">
                          <img src={signatureData} alt="Firma capturada" className="h-24 object-contain" />
                        </div>
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSignatureData(null);
                              setIsSignatureModalOpen(true);
                            }}
                          >
                            Volver a firmar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t mt-auto flex sm:justify-between flex-row">
                {assignStep > 1 ? (
                  <Button variant="ghost" onClick={() => setAssignStep(assignStep - 1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => handleOpenNewModal(false)}>
                    Cancelar
                  </Button>
                )}
                
                {assignStep < totalSteps ? (
                  <Button 
                    onClick={() => setAssignStep(assignStep + 1)} 
                    disabled={
                      (assignStep === 2 && !selectedWorker) ||
                      (assignStep === 3 && !selectedTool)
                    }
                  >
                    Siguiente <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleAssign} disabled={assigning || !signatureData}>
                    {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wrench className="w-4 h-4 mr-2" />}
                    Asignar
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {([
          { key: 'activos' as const, label: 'Activos' },
          { key: 'devueltos' as const, label: 'Devueltos' },
          { key: 'todos' as const, label: 'Todos' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabFilter(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tabFilter === tab.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredAssignments.length === 0 ? (
        <Card className="card-glow border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Undo2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">
              {tabFilter === 'activos' ? 'No hay préstamos activos' : tabFilter === 'devueltos' ? 'No hay devoluciones registradas' : 'Sin registros'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {tabFilter === 'activos' 
                ? 'Todos los ítems de cargo o uso diario han sido retornados.'
                : tabFilter === 'devueltos'
                ? 'Aún no se han recibido devoluciones.'
                : 'No hay préstamos registrados en el sistema.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAssignments.map((assignment) => (
            <Card
              key={assignment.id}
              className={`card-glow border-border/50 transition-all ${
                assignment.status === 'activo' ? 'hover:border-primary/20 cursor-pointer' : 'opacity-80'
              }`}
              onClick={() => assignment.status === 'activo' && setSelectedAssignment(assignment)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      assignment.status === 'devuelto' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                    }`}>
                      {assignment.status === 'devuelto' ? <CheckCircle className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-lg font-mono">
                          {assignment.product?.name}
                        </span>
                        {(assignment.quantity || 1) > 1 && (
                          <Badge variant="secondary" className="font-mono">
                            x{assignment.quantity || 1}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            assignment.status === 'devuelto'
                              ? 'bg-success/15 text-success'
                              : assignment.vale?.type === 'cargo_personal'
                              ? 'bg-chart-3/15 text-chart-3'
                              : 'bg-chart-2/15 text-chart-2'
                          }
                        >
                          {assignment.status === 'devuelto' 
                            ? 'Devuelto' 
                            : assignment.vale 
                              ? (assignment.vale.type === 'cargo_personal' ? 'Cargo Personal' : 'Uso Diario') 
                              : 'Asignación Directa'
                          }
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
                        {assignment.status === 'devuelto' && assignment.returned_at && (
                          <> · Devuelto {format(new Date(assignment.returned_at), "d MMM HH:mm", { locale: es })}</>
                        )}
                      </p>
                      {assignment.condition_notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Nota: {assignment.condition_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {assignment.status === 'activo' && (
                    <div className="text-right">
                      <Button size="sm" className="mt-2" variant="outline">
                        <Undo2 className="w-4 h-4 mr-1" />
                        Recibir
                      </Button>
                    </div>
                  )}
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
                {(selectedAssignment.quantity || 1) > 1 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cantidad:</span>
                    <span className="font-bold text-primary">x{selectedAssignment.quantity}</span>
                  </div>
                )}
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

              {/* Mostrar firma si existe */}
              {selectedAssignment.signature && (
                <div className="p-3 rounded-lg bg-white border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Firma al recibir:</p>
                  <img src={selectedAssignment.signature} alt="Firma" className="h-16 object-contain" />
                </div>
              )}

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
                  Reingresar al inventario (aumentar stock en {selectedAssignment.quantity || 1})
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
                  Confirmar Devolución
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Screen Signature Modal */}
      <FullScreenSignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onConfirm={(sig) => setSignatureData(sig)}
        title="Firma del Trabajador - Préstamo"
      />
    </div>
  );
}
