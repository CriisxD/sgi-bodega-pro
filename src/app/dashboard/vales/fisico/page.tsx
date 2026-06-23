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
  
  const [workerId, setWorkerId] = useState('');
  const [valeType, setValeType] = useState('uso_diario');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  
  // Combobox states
  const [openWorker, setOpenWorker] = useState(false);
  const [openProducts, setOpenProducts] = useState<Record<number, boolean>>({});

  // Fast Create Worker state
  const [createWorkerOpen, setCreateWorkerOpen] = useState(false);
  const [newWorkerData, setNewWorkerData] = useState({ name: '', rut: '', area: '' });
  const [creatingWorker, setCreatingWorker] = useState(false);

  // Quick Stock Adjust
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<Product | null>(null);
  const [quickAdjustQty, setQuickAdjustQty] = useState<number | ''>(1);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [wRes, pRes] = await Promise.all([
        supabase.from('workers').select('*').eq('active', true).order('name'),
        supabase.from('products').select('*, category:categories(*)').eq('active', true).order('name')
      ]);
      setWorkers(wRes.data || []);
      setProducts(pRes.data || []);
      setLoadingData(false);
    };
    fetchData();
  }, [supabase]);

  const filteredProducts = products.filter(p => {
    if (valeType === 'epp') return p.category?.type === 'epp';
    return p.category?.type === 'material' || p.category?.type === 'consumible' || !p.category;
  });

  const handleAddItem = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
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
    if (!newWorkerData.name || !newWorkerData.rut) return toast.error('Nombre y RUT son obligatorios');
    setCreatingWorker(true);
    try {
      const { data, error } = await supabase.from('workers').insert({
        name: newWorkerData.name,
        rut: newWorkerData.rut,
        area: newWorkerData.area || 'General',
        active: true
      }).select().single();
      
      if (error) throw error;
      
      setWorkers([...workers, data].sort((a, b) => a.name.localeCompare(b.name)));
      setWorkerId(data.id);
      setCreateWorkerOpen(false);
      setNewWorkerData({ name: '', rut: '', area: '' });
      toast.success('Trabajador creado y seleccionado');
    } catch (e: any) {
      toast.error('Error al crear trabajador: ' + e.message);
    } finally {
      setCreatingWorker(false);
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
    if (items.some(i => !i.product_id || i.quantity <= 0)) {
      return toast.error('Todos los ítems deben tener un producto y cantidad válida');
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
      setItems([{ product_id: '', quantity: 1 }]);
      
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

      <Card className="card-glow border-border/50">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Trabajador (Receptor)</Label>
                <div className="flex gap-2">
                  <Popover open={openWorker} onOpenChange={setOpenWorker}>
                    {/* @ts-ignore Base UI render prop */}
                    <PopoverTrigger render={<Button variant="outline" role="combobox" className="w-full justify-between" />}>
                        {workerId
                          ? workers.find((w) => w.id === workerId)?.name
                          : "Buscar trabajador..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
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
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => setCreateWorkerOpen(true)}
                    title="Crear nuevo trabajador rápido"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Vale</Label>
                <Select value={valeType} onValueChange={(val: any) => setValeType(val)} required>
                  <SelectTrigger>
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

            {/* Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Ítems Entregados</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir Ítem
                </Button>
              </div>
              
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const selectedProd = products.find(p => p.id === item.product_id);
                  return (
                    <div key={idx} className="flex gap-3 items-start bg-muted/20 p-3 rounded-lg border border-border/50">
                      <div className="flex-1 space-y-2">
                        <Label>Producto</Label>
                        <Popover 
                          open={openProducts[idx] || false} 
                          onOpenChange={(val) => setOpenProducts({...openProducts, [idx]: val})}
                        >
                        {/* @ts-ignore Base UI render prop */}
                        <PopoverTrigger render={<Button variant="outline" role="combobox" className="w-full justify-between font-normal" />}>
                            {item.product_id
                              ? products.find((p) => p.id === item.product_id)?.name
                              : "Buscar producto en bodega..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command>
                            <CommandInput placeholder="Buscar por nombre o código..." />
                            <CommandList>
                              <CommandEmpty>No se encontró el producto.</CommandEmpty>
                              <CommandGroup>
                                {filteredProducts.map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => {
                                      handleItemChange(idx, 'product_id', product.id);
                                      setOpenProducts({...openProducts, [idx]: false});
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.product_id === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {product.name} 
                                    <span className="text-muted-foreground ml-2 text-xs">
                                      (Stock: {product.stock} {product.unit})
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      
                      {selectedProd && (
                        <div className="flex items-center gap-2 mt-1.5 ml-1">
                          <span className={cn("text-xs font-semibold", selectedProd.stock <= 0 ? "text-destructive" : "text-muted-foreground")}>
                            Stock actual: {selectedProd.stock} {selectedProd.unit}
                          </span>
                          <Button 
                            type="button" 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-xs text-primary"
                            onClick={() => {
                              setQuickAdjustProduct(selectedProd);
                              setQuickAdjustQty(1);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-0.5" /> Ajustar Stock
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>Cantidad</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                        className={selectedProd && selectedProd.stock < item.quantity ? "border-destructive/50 ring-destructive/20 focus-visible:ring-destructive/50" : ""}
                        required
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 mt-7"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas (Opcional)</Label>
              <Input 
                placeholder="Ej. Vale entregado firmado por Supervisor X..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar y Descontar Stock
            </Button>
          </form>
        </CardContent>
      </Card>

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
            <div className="space-y-2">
              <Label>Área / Especialidad</Label>
              <Input 
                value={newWorkerData.area} 
                onChange={e => setNewWorkerData({...newWorkerData, area: e.target.value})} 
                placeholder="Ej. Carpintería, Maestranza..." 
              />
            </div>
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
    </div>
  );
}
