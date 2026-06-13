'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  PackageCheck,
  Search,
  FileText,
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Signature,
  Trash2,
  Save,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Vale } from '@/lib/types';

const valeTypeLabels: Record<string, string> = {
  epp: 'EPP',
  material: 'Material',
  cargo_personal: 'Cargo Personal',
  uso_diario: 'Uso Diario',
};

const valeTypeBadgeColors: Record<string, string> = {
  epp: 'bg-chart-4/15 text-chart-4 border-chart-4/30',
  material: 'bg-primary/15 text-primary border-primary/30',
  cargo_personal: 'bg-chart-3/15 text-chart-3 border-chart-3/30',
  uso_diario: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
};

export default function DespachoPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [vales, setVales] = useState<Vale[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVale, setSelectedVale] = useState<Vale | null>(null);
  const [editableItems, setEditableItems] = useState<Record<string, number | ''>>({});
  const [processing, setProcessing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleSelectVale = (vale: Vale) => {
    setSelectedVale(vale);
    const initialItems: Record<string, number> = {};
    vale.items?.forEach(item => {
      const stock = item.product?.stock || 0;
      initialItems[item.id] = Math.min(item.quantity, stock > 0 ? stock : 0);
    });
    setEditableItems(initialItems);
    setSignatureData(null);
  };

  const fetchVales = async () => {
    const { data } = await supabase
      .from('vales')
      .select(`
        *,
        worker:workers(*),
        creator:profiles!vales_created_by_fkey(*),
        items:vale_items(*, product:products(*))
      `)
      .eq('status', 'pendiente')
      .order('created_at', { ascending: true });

    setVales(
      (data || []).map((v: Record<string, unknown>) => ({
        ...v,
        worker: Array.isArray(v.worker) ? v.worker[0] : v.worker,
        creator: Array.isArray(v.creator) ? v.creator[0] : v.creator,
      })) as Vale[]
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchVales();
    const channel = supabase
      .channel('vales-pendientes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vales', filter: 'status=eq.pendiente' },
        () => fetchVales()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filteredVales = vales.filter((v) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      v.vale_number.toString().includes(s) ||
      (v.worker?.name || '').toLowerCase().includes(s) ||
      (v.worker?.rut || '').toLowerCase().includes(s)
    );
  });

  const handleProcess = async () => {
    if (!selectedVale || !profile) return;
    
    if (selectedVale.type === 'epp' && !signatureData) {
      toast.error('La firma del trabajador es obligatoria para entregar EPP');
      return;
    }

    setProcessing(true);

    try {
      for (const item of selectedVale.items || []) {
        const qtyRaw = editableItems[item.id];
        const qtyToDeliver = qtyRaw === '' ? 0 : (qtyRaw ?? item.quantity);

        await supabase
          .from('vale_items')
          .update({ quantity_delivered: qtyToDeliver })
          .eq('id', item.id);

        if (qtyToDeliver <= 0) continue;

        const { error: stockError } = await supabase.rpc('decrease_stock', {
          p_product_id: item.product_id,
          p_quantity: qtyToDeliver,
        });

        if (stockError) {
          await supabase
            .from('products')
            .update({ stock: (item.product?.stock || 0) - qtyToDeliver })
            .eq('id', item.product_id);
        }

        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          type: 'salida',
          quantity: qtyToDeliver,
          reference_type: 'vale',
          reference_id: selectedVale.id,
          notes: `Vale #${selectedVale.vale_number}`,
          created_by: profile.id,
        });

        if (selectedVale.type === 'epp') {
          await supabase.from('epp_records').insert({
            worker_id: selectedVale.worker_id,
            product_id: item.product_id,
            vale_id: selectedVale.id,
            quantity: qtyToDeliver,
            delivered_at: new Date().toISOString(),
            authorized_by: selectedVale.created_by,
            processed_by: profile.id,
          });
        }

        if (selectedVale.type === 'cargo_personal' || selectedVale.type === 'uso_diario') {
          await supabase.from('tool_assignments').insert({
            worker_id: selectedVale.worker_id,
            product_id: item.product_id,
            vale_id: selectedVale.id,
            assigned_at: new Date().toISOString(),
            status: 'activo',
          });
        }
      }

      await supabase
        .from('vales')
        .update({
          status: 'procesado',
          processed_at: new Date().toISOString(),
          processed_by: profile.id,
          signature: signatureData 
        })
        .eq('id', selectedVale.id);

      toast.success(`Vale #${selectedVale.vale_number} procesado exitosamente`);
      setSelectedVale(null);
      setSignatureData(null);
      fetchVales();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error al procesar: ' + message);
    } finally {
      setProcessing(false);
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            {filteredVales.length} vale{filteredVales.length !== 1 && 's'} pendiente
            {filteredVales.length !== 1 && 's'}
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por N°, nombre o RUT..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredVales.length === 0 ? (
        <Card className="card-glow border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold">Sin vales pendientes</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No hay vales por procesar en este momento
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredVales.map((vale) => {
            const hasLowStock = (vale.items || []).some(
              (item) => item.product && item.quantity > item.product.stock
            );

            return (
              <Card
                key={vale.id}
                className="card-glow border-border/50 hover:border-primary/20 transition-all cursor-pointer"
                onClick={() => handleSelectVale(vale)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg font-mono">
                            #{vale.vale_number}
                          </span>
                          <Badge variant="outline" className={valeTypeBadgeColors[vale.type]}>
                            {valeTypeLabels[vale.type]}
                          </Badge>
                          {hasLowStock && (
                            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Stock insuficiente
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Para:</span>{' '}
                          <span className="font-medium">{vale.worker?.name}</span>
                          <span className="text-muted-foreground"> · {vale.worker?.rut}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {format(new Date(vale.created_at), "d MMM HH:mm", { locale: es })}
                          {' · '}Por: {vale.creator?.full_name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {(vale.items || []).length} ítem{(vale.items || []).length !== 1 && 's'}
                      </p>
                      <Button size="sm" className="mt-2">
                        <PackageCheck className="w-4 h-4 mr-1" />
                        Procesar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedVale} onOpenChange={() => setSelectedVale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Procesar Vale #{selectedVale?.vale_number}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Revisa las cantidades reales a entregar al trabajador <span className="font-bold text-primary">{selectedVale?.worker?.name}</span>.
            </p>
          </DialogHeader>

          {selectedVale && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Trabajador</span>
                  <span className="text-sm font-medium">{selectedVale.worker?.name}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <Badge variant="outline" className={valeTypeBadgeColors[selectedVale.type]}>
                    {valeTypeLabels[selectedVale.type]}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Ítems a entregar:</p>
                <div className="space-y-2">
                  {(selectedVale.items || []).map((item) => {
                    const insufficientStock =
                      item.product && item.quantity > item.product.stock;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          insufficientStock
                            ? 'border-destructive/30 bg-destructive/5'
                            : 'border-border/50 bg-card/50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium">{item.product?.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max={item.quantity}
                            className="w-16 h-8 text-center"
                            value={editableItems[item.id] !== undefined ? editableItems[item.id] : item.quantity}
                            onChange={(e) => {
                              const valRaw = e.target.value;
                              if (valRaw === '') {
                                setEditableItems(prev => ({ ...prev, [item.id]: '' }));
                              } else {
                                const val = parseInt(valRaw);
                                if (!isNaN(val)) {
                                  setEditableItems(prev => ({
                                    ...prev, 
                                    [item.id]: Math.min(Math.max(val, 0), item.quantity)
                                  }));
                                }
                              }
                            }}
                            onBlur={(e) => {
                              // Si al salir está vacío, poner en 0
                              if (e.target.value === '') {
                                setEditableItems(prev => ({ ...prev, [item.id]: 0 }));
                              }
                            }}
                          />
                          <span className="text-sm font-bold text-muted-foreground">/ {item.quantity}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recuadro de Firma */}
              <div className="mt-6 border-t pt-6">
                <div className="flex justify-between items-center mb-2">
                  <Label className="font-bold flex items-center gap-2">
                    <Signature className="w-4 h-4 text-primary" /> 
                    Firma del Trabajador {selectedVale?.type === 'epp' && <span className="text-destructive">*Obligatoria</span>}
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      sigCanvas.current?.clear();
                      setSignatureData(null);
                    }}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Limpiar
                  </Button>
                </div>
                <div className="border-2 border-dashed border-border rounded-xl bg-card overflow-hidden">
                  <SignatureCanvas 
                    ref={sigCanvas}
                    canvasProps={{ className: 'w-full h-40 cursor-crosshair touch-none' }}
                    onEnd={() => {
                      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                        setSignatureData(sigCanvas.current.toDataURL('image/png'));
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSelectedVale(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleProcess} 
              disabled={processing || (selectedVale?.type === 'epp' && !signatureData)}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Confirmar Entrega
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
