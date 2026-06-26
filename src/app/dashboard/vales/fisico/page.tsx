'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PenLine, Plus, Trash2, Loader2, Save, Check, ChevronsUpDown, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Worker, Product } from '@/lib/types';

export default function DigitarValeFisicoPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [workerId, setWorkerId] = useState('');
  const [valeType, setValeType] = useState('uso_diario');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{product_id: string, quantity: number}[]>([]);
  
  // Combobox states
  const [openWorker, setOpenWorker] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);

  // Fast Create Worker state
  const [createWorkerOpen, setCreateWorkerOpen] = useState(false);
  const [newWorkerData, setNewWorkerData] = useState({ name: '', rut: '', area: '', is_external: false, company: '' });
  const [creatingWorker, setCreatingWorker] = useState(false);

  // Fast Create Product state
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [newProductData, setNewProductData] = useState({ name: '', category_id: '', type: 'material', min_stock: 0, unit: 'un' });
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Quick Stock Adjust
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<Product | null>(null);
  const [quickAdjustQty, setQuickAdjustQty] = useState<number | ''>(1);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [wRes, pRes, cRes] = await Promise.all([
        supabase.from('workers').select('*').eq('active', true).order('name'),
        supabase.from('products').select('*, category:categories(*)').eq('active', true).order('name'),
        supabase.from('categories').select('*').order('name')
      ]);
      setWorkers(wRes.data || []);
      setProducts(pRes.data || []);
      setCategories(cRes.data || []);
      setLoadingData(false);
    };
    fetchData();
  }, [supabase]);

  const filteredProducts = products.filter(p => {
    if (valeType === 'epp') return p.category?.type?.toLowerCase() === 'epp';
    return p.category?.type?.toLowerCase() !== 'epp';
  });

  const handleSelectProduct = (productId: string) => {
    const existingIdx = items.findIndex(i => i.product_id === productId);
    if (existingIdx >= 0) {
      const newItems = [...items];
      newItems[existingIdx].quantity += 1;
      setItems(newItems);
    } else {
      setItems([{ product_id: productId, quantity: 1 }, ...items]);
    }
    setOpenSearch(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleCreateWorker = async () => {
    if (!newWorkerData.name) return toast.error('El nombre es obligatorio');
    if (newWorkerData.is_external && !newWorkerData.company) return toast.error('La empresa es obligatoria para externos');
    setCreatingWorker(true);
    
    // Asignar RUT temporal si está vacío
    const rutToSave = newWorkerData.rut.trim() || `TEMP-${Math.floor(Math.random() * 16777215).toString(16).padEnd(6, '0').toUpperCase()}`;
    
    try {
      const { data, error } = await supabase.from('workers').insert({
        name: newWorkerData.name,
        rut: rutToSave,
        area: newWorkerData.is_external ? 'Externo' : (newWorkerData.area || 'General'),
        position: newWorkerData.is_external ? 'Contratista/Visita' : 'Operador',
        is_external: newWorkerData.is_external,
        company: newWorkerData.is_external ? newWorkerData.company : null,
        active: true
      }).select().single();
      
      if (error) throw error;
      
      setWorkers([...workers, data].sort((a, b) => a.name.localeCompare(b.name)));
      setWorkerId(data.id);
      setCreateWorkerOpen(false);
      setNewWorkerData({ name: '', rut: '', area: '', is_external: false, company: '' });
      toast.success('Trabajador creado y seleccionado');
    } catch (e: any) {
      toast.error('Error al crear trabajador: ' + e.message);
    } finally {
      setCreatingWorker(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!newProductData.name) return toast.error('El nombre es obligatorio');
    
    // Assign generic category if none selected
    let targetCategoryId = newProductData.category_id;
    if (!targetCategoryId) {
      const typeStr = newProductData.type === 'epp' ? 'epp' : newProductData.type === 'herramienta' ? 'herramienta' : 'material';
      let cat = categories.find(c => c.type === typeStr && c.name.toLowerCase() === 'general');
      if (!cat) cat = categories.find(c => c.type === typeStr);
      if (cat) targetCategoryId = cat.id;
    }

    setCreatingProduct(true);
    try {
      const { data, error } = await supabase.from('products').insert({
        name: newProductData.name.trim(),
        category_id: targetCategoryId || null,
        stock: 0,
        min_stock: newProductData.min_stock || 0,
        unit: newProductData.unit || 'un',
        active: true
      }).select('*, category:categories(*)').single();
      
      if (error) throw error;
      
      setProducts([...products, data].sort((a, b) => a.name.localeCompare(b.name)));
      handleSelectProduct(data.id);
      setCreateProductOpen(false);
      setNewProductData({ name: '', category_id: '', type: 'material', min_stock: 0, unit: 'un' });
      toast.success('Producto creado y añadido al vale');
    } catch (e: any) {
      toast.error('Error al crear producto: ' + e.message);
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleQuickAdjust = async () => {
    if (!quickAdjustProduct || quickAdjustQty === '' || quickAdjustQty <= 0) return;
    setAdjusting(true);
    try {
      const { error } = await supabase.rpc('increase_stock', {
        p_product_id: quickAdjustProduct.id,
        p_quantity: quickAdjustQty
      });
      if (error) {
        await supabase.from('products').update({ stock: quickAdjustProduct.stock + quickAdjustQty }).eq('id', quickAdjustProduct.id);
      }
      await supabase.from('stock_movements').insert({
        product_id: quickAdjustProduct.id,
        type: 'entrada',
        quantity: quickAdjustQty,
        reference_type: 'ajuste_manual',
        notes: 'Ingreso rápido desde digitación de vale',
        created_by: profile?.id
      });
      
      setProducts(products.map(p => p.id === quickAdjustProduct.id ? { ...p, stock: p.stock + quickAdjustQty } : p));
      toast.success(`Stock aumentado en ${quickAdjustQty}`);
      setQuickAdjustProduct(null);
      setQuickAdjustQty(1);
    } catch (e: any) {
      toast.error('Error al ajustar stock: ' + e.message);
    } finally {
      setAdjusting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    // Validate
    if (!workerId) return toast.error('Selecciona un trabajador');
    if (items.length === 0) return toast.error('Debe añadir al menos un producto al vale');
    if (items.some(i => !i.product_id || i.quantity <= 0)) {
      return toast.error('Todos los ítems deben tener cantidad válida mayor a 0');
    }

    setSubmitting(true);
    try {
      // 1. Create the vale directly as "procesado" since Bodeguero is entering it after physical delivery
      const { data: vale, error: valeError } = await supabase.from('vales').insert({
        worker_id: workerId,
        type: valeType,
        status: 'procesado',
        created_by: profile.id,
        processed_by: profile.id,
        processed_at: new Date().toISOString(),
        notes: notes || 'Ingresado manualmente desde vale físico'
      }).select().single();

      if (valeError) throw valeError;

      // 2. Insert items and process logic (decrease stock, assign, epp, etc)
      for (const item of items) {
        // Add vale item
        const { data: vItem, error: iErr } = await supabase.from('vale_items').insert({
          vale_id: vale.id,
          product_id: item.product_id,
          quantity: item.quantity,
          quantity_delivered: item.quantity
        }).select().single();
        if (iErr) throw iErr;

        // Decrease stock
        await supabase.rpc('decrease_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity
        });

        // Stock movement
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          type: 'salida',
          quantity: item.quantity,
          reference_type: 'vale',
          reference_id: vale.id,
          created_by: profile.id
        });

        // Specific logic based on type
        if (valeType === 'epp') {
          await supabase.from('epp_records').insert({
            worker_id: workerId,
            product_id: item.product_id,
            vale_id: vale.id,
            quantity: item.quantity,
            authorized_by: profile.id,
            processed_by: profile.id
          });
        } else if (valeType === 'cargo_personal' || valeType === 'uso_diario') {
          await supabase.from('tool_assignments').insert({
            worker_id: workerId,
            product_id: item.product_id,
            vale_id: vale.id,
            status: 'activo'
          });
        }
      }

      toast.success('Vale ingresado y procesado exitosamente en el sistema.');
      // Reset form
      setWorkerId('');
      setValeType('uso_diario');
      setNotes('');
      setItems([]);
      
    } catch (error: any) {
      toast.error('Error al ingresar el vale: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PenLine className="w-6 h-6 text-primary" />
          Ingresar Vale Físico
        </h2>
        <p className="text-muted-foreground text-sm">
          Digita los vales de papel para sincronizar el inventario y cargos.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          
          {/* ═══════════════════════════════════════════
              LEFT COLUMN: Workspace (Worker, Type, Add Products) 
              ═══════════════════════════════════════════ */}
          <div className="lg:col-span-3 space-y-0">
            <Card className="card-glow border-border/50 overflow-hidden">
              <CardContent className="p-0">
                
                {/* PASO 1: Trabajador */}
                <div className="p-6 border-b border-border/30">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-base shrink-0 shadow-md shadow-primary/30">1</div>
                    <div>
                      <Label className="text-base font-bold block">Seleccionar Trabajador</Label>
                      <p className="text-xs text-muted-foreground">¿A quién se le entregó el vale?</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-12">
                    <div className="flex-1 min-w-0">
                      <Popover open={openWorker} onOpenChange={setOpenWorker}>
                        {/* @ts-ignore Base UI render prop */}
                        <PopoverTrigger render={<Button variant="outline" role="combobox" className="w-full justify-between h-12 text-base" />}>
                            {workerId
                              ? workers.find((w) => w.id === workerId)?.name
                              : "Buscar por nombre o RUT..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0">
                          <Command>
                            <CommandInput placeholder="Buscar por nombre o RUT..." />
                            <CommandList>
                              <CommandEmpty>No se encontró el trabajador.</CommandEmpty>
                              <CommandGroup>
                                {workers.map((worker) => (
                                  <CommandItem
                                    key={worker.id}
                                    value={`${worker.name} ${worker.rut}`}
                                    onSelect={() => {
                                      setWorkerId(worker.id);
                                      setOpenWorker(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        workerId === worker.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {worker.name} ({worker.rut})
                                    {worker.is_external && <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/30">Externo</span>}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      className="shrink-0 h-12 w-12"
                      onClick={() => setCreateWorkerOpen(true)}
                      title="Crear nuevo trabajador rápido"
                    >
                      <UserPlus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* PASO 2: Tipo de Vale */}
                <div className="p-6 border-b border-border/30">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-base shrink-0 shadow-md shadow-primary/30">2</div>
                    <div>
                      <Label className="text-base font-bold block">Tipo de Vale</Label>
                      <p className="text-xs text-muted-foreground">¿Qué tipo de entrega fue?</p>
                    </div>
                  </div>
                  <div className="ml-12">
                    <Select value={valeType} onValueChange={(val: any) => setValeType(val)} required>
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Seleccione tipo">
                          {valeType === 'uso_diario' && 'Uso Diario (Devolución hoy)'}
                          {valeType === 'cargo_personal' && 'Cargo Personal (Largo plazo)'}
                          {valeType === 'material' && 'Material (Consumo)'}
                          {valeType === 'epp' && 'EPP (Requiere firma legal)'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uso_diario">Uso Diario (Devolución hoy)</SelectItem>
                        <SelectItem value="cargo_personal">Cargo Personal (Largo plazo)</SelectItem>
                        <SelectItem value="material">Material (Consumo)</SelectItem>
                        <SelectItem value="epp">EPP (Requiere firma legal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* PASO 3: Añadir Productos */}
                <div className="p-6 border-b border-border/30 bg-primary/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-base shrink-0 shadow-md shadow-primary/30">3</div>
                    <div>
                      <Label className="text-base font-bold text-primary block">Añadir Productos al Vale</Label>
                      <p className="text-xs text-muted-foreground">Busca y agrega los ítems entregados</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-12">
                    <div className="flex-1">
                      <Popover open={openSearch} onOpenChange={setOpenSearch}>
                        {/* @ts-ignore Base UI render prop */}
                        <PopoverTrigger render={<Button variant="outline" role="combobox" className="w-full justify-between h-12 text-base shadow-sm" />}>
                            Buscar producto por nombre o código...
                            <Plus className="ml-2 h-5 w-5 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Escribe para buscar..." autoFocus />
                            <CommandList>
                              <CommandEmpty>No se encontró el producto.</CommandEmpty>
                              <CommandGroup>
                                {filteredProducts.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => handleSelectProduct(product.id)}
                                    className="py-3"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{product.name}</span>
                                      <span className={cn("text-xs", product.stock <= 0 ? "text-destructive" : "text-muted-foreground")}>
                                        Stock: {product.stock} {product.unit}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      className="shrink-0 h-12 w-12"
                      onClick={() => setCreateProductOpen(true)}
                      title="Crear nuevo producto rápido"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* NOTAS */}
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <PenLine className="w-4 h-4" />
                    </div>
                    <div>
                      <Label className="text-base font-bold block">Notas (Opcional)</Label>
                      <p className="text-xs text-muted-foreground">Observaciones o instrucciones adicionales</p>
                    </div>
                  </div>
                  <div className="ml-12">
                    <Input 
                      placeholder="Ej. Vale entregado firmado por Supervisor X..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="h-12 text-base"
                    />
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* ═══════════════════════════════════════════
              RIGHT COLUMN: Cart / Ticket
              ═══════════════════════════════════════════ */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <Card className="border-border/50 shadow-xl flex flex-col h-[calc(100vh-120px)] max-h-[800px]">
                <div className="bg-muted/50 border-b border-border/50 p-4">
                  <h3 className="font-bold flex items-center justify-between">
                    <span>Resumen del Vale</span>
                    <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
                      {items.length} ítems
                    </span>
                  </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm opacity-50 py-20">
                      <Plus className="w-12 h-12 mb-4" />
                      <p>Añade productos desde el buscador</p>
                    </div>
                  ) : (
                    items.map((item, idx) => {
                      const selectedProd = products.find(p => p.id === item.product_id);
                      if (!selectedProd) return null;
                      
                      const isStockCritical = selectedProd.stock < item.quantity;

                      return (
                        <div key={`${item.product_id}-${idx}`} className={cn("p-3 rounded-lg border", isStockCritical ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-background")}>
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm leading-tight">{selectedProd.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">En stock: {selectedProd.stock}</span>
                                <Button 
                                  type="button" 
                                  variant="link" 
                                  size="sm" 
                                  className="h-auto p-0 text-[10px] text-primary"
                                  onClick={() => {
                                    setQuickAdjustProduct(selectedProd);
                                    setQuickAdjustQty(1);
                                  }}
                                >
                                  + Ajustar
                                </Button>
                              </div>
                            </div>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 h-7 w-7"
                              onClick={() => handleRemoveItem(idx)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          
                          <div className="flex items-center justify-between mt-3">
                            <Label className="text-xs font-semibold">Cantidad</Label>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number" 
                                min="1" 
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                                className={cn("w-20 h-8 text-center text-sm font-bold", isStockCritical ? "border-destructive focus-visible:ring-destructive" : "")}
                                required
                              />
                              <span className="text-xs text-muted-foreground w-8">{selectedProd.unit}</span>
                            </div>
                          </div>
                          {isStockCritical && (
                            <p className="text-[10px] text-destructive mt-1 font-medium">¡Stock insuficiente!</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="bg-muted/20 border-t border-border/50 p-4">
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-base font-bold shadow-lg shadow-primary/20" 
                    disabled={submitting || items.length === 0}
                  >
                    {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                    Procesar Vale y Descontar
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </form>

      {/* Fast Create Worker Dialog */}
      <Dialog open={createWorkerOpen} onOpenChange={setCreateWorkerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Trabajador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input 
                value={newWorkerData.name} 
                onChange={e => setNewWorkerData({...newWorkerData, name: e.target.value})} 
                placeholder="Ej. Juan Pérez" 
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>RUT</Label>
              <Input 
                value={newWorkerData.rut} 
                onChange={e => setNewWorkerData({...newWorkerData, rut: e.target.value})} 
                placeholder="12.345.678-9" 
              />
            </div>
            <div className="flex items-center space-x-2 py-2">
              <input 
                type="checkbox"
                id="isExternalFastFisico" 
                checked={newWorkerData.is_external} 
                onChange={(e) => setNewWorkerData({...newWorkerData, is_external: e.target.checked})} 
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isExternalFastFisico" className="cursor-pointer text-amber-500">Es personal externo / contratista</Label>
            </div>
            {!newWorkerData.is_external ? (
              <div className="space-y-2">
                <Label>Área / Especialidad</Label>
                <Input 
                  value={newWorkerData.area} 
                  onChange={e => setNewWorkerData({...newWorkerData, area: e.target.value})} 
                  placeholder="Ej. Carpintería, Maestranza..." 
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Empresa Externa</Label>
                <Input 
                  value={newWorkerData.company} 
                  onChange={e => setNewWorkerData({...newWorkerData, company: e.target.value})} 
                  placeholder="Ej. Contratistas XYZ SpA" 
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWorkerOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateWorker} disabled={creatingWorker}>
              {creatingWorker ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Adjust Stock Dialog */}
      <Dialog open={!!quickAdjustProduct} onOpenChange={(open) => !open && setQuickAdjustProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir Stock Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm font-semibold">{quickAdjustProduct?.name}</p>
            <p className="text-sm text-muted-foreground -mt-3">Stock actual: {quickAdjustProduct?.stock} {quickAdjustProduct?.unit}</p>
            
            <div className="space-y-2 mt-2">
              <Label>Cantidad a ingresar</Label>
              <Input 
                type="number" 
                min={1} 
                value={quickAdjustQty} 
                onChange={e => setQuickAdjustQty(e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="text-lg font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAdjustProduct(null)}>Cancelar</Button>
            <Button onClick={handleQuickAdjust} disabled={adjusting || quickAdjustQty === '' || quickAdjustQty <= 0}>
              {adjusting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Fast Create Product Dialog */}
      <Dialog open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Producto Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del Producto *</Label>
              <Input 
                placeholder="Ej. Taladro Makita 18V" 
                value={newProductData.name}
                onChange={e => setNewProductData({...newProductData, name: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo genérico</Label>
                <Select value={newProductData.type} onValueChange={(v: any) => setNewProductData({...newProductData, type: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material/Insumo</SelectItem>
                    <SelectItem value="herramienta">Herramienta</SelectItem>
                    <SelectItem value="epp">EPP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select value={newProductData.unit} onValueChange={(v: any) => setNewProductData({...newProductData, unit: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">Unidad (un)</SelectItem>
                    <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                    <SelectItem value="lt">Litros (lt)</SelectItem>
                    <SelectItem value="m">Metros (m)</SelectItem>
                    <SelectItem value="caja">Caja</SelectItem>
                    <SelectItem value="par">Par</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">El stock inicial será 0. Deberá ajustarse al añadirlo al vale.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProductOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateProduct} disabled={creatingProduct || !newProductData.name}>
              {creatingProduct ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar y Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
