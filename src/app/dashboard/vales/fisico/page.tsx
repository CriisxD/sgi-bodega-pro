'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PenLine, Plus, Trash2, Loader2, Save } from 'lucide-react';
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

  useEffect(() => {
    const fetchData = async () => {
      const [wRes, pRes] = await Promise.all([
        supabase.from('workers').select('*').eq('active', true).order('name'),
        supabase.from('products').select('*').eq('active', true).order('name')
      ]);
      setWorkers(wRes.data || []);
      setProducts(pRes.data || []);
      setLoadingData(false);
    };
    fetchData();
  }, [supabase]);

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
                <Select value={workerId} onValueChange={(val: any) => setWorkerId(val)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Buscar trabajador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name} ({w.rut})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Vale</Label>
                <Select value={valeType} onValueChange={(val: any) => setValeType(val)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
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
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-end bg-muted/20 p-3 rounded-lg border border-border/50">
                    <div className="flex-1 space-y-2">
                      <Label>Producto</Label>
                      <Select 
                        value={item.product_id} 
                        onValueChange={(val: any) => handleItemChange(idx, 'product_id', val)}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} <span className="text-muted-foreground ml-2">(Stock: {p.stock} {p.unit})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>Cantidad</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                        required
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 mb-0.5"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
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
    </div>
  );
}
