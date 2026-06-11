'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Vale, ValeItem } from '@/lib/types';

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
  const [processing, setProcessing] = useState(false);

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

    // Real-time subscription for new vales
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

  const processVale = async () => {
    if (!selectedVale || !profile) return;
    setProcessing(true);

    try {
      // Process each item
      for (const item of selectedVale.items || []) {
        // Decrease stock
        const { error: stockError } = await supabase.rpc('decrease_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        });

        // If RPC doesn't exist, do it manually
        if (stockError) {
          await supabase
            .from('products')
            .update({ stock: (item.product?.stock || 0) - item.quantity })
            .eq('id', item.product_id);
        }

        // Create stock movement
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          type: 'salida',
          quantity: item.quantity,
          reference_type: 'vale',
          reference_id: selectedVale.id,
          notes: `Vale #${selectedVale.vale_number}`,
          created_by: profile.id,
        });

        // Update vale item delivered quantity
        await supabase
          .from('vale_items')
          .update({ quantity_delivered: item.quantity })
          .eq('id', item.id);

        // Type-specific processing
        if (selectedVale.type === 'epp') {
          await supabase.from('epp_records').insert({
            worker_id: selectedVale.worker_id,
            product_id: item.product_id,
            vale_id: selectedVale.id,
            quantity: item.quantity,
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

      // Mark vale as processed
      await supabase
        .from('vales')
        .update({
          status: 'procesado',
          processed_at: new Date().toISOString(),
          processed_by: profile.id,
        })
        .eq('id', selectedVale.id);

      toast.success(`Vale #${selectedVale.vale_number} procesado exitosamente`);
      setSelectedVale(null);
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
      {/* Header */}
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

      {/* Vales List */}
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
                onClick={() => setSelectedVale(vale)}
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

                  {/* Items preview */}
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <div className="flex flex-wrap gap-1.5">
                      {(vale.items || []).map((item) => (
                        <Badge
                          key={item.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {item.product?.name} x{item.quantity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Process Dialog */}
      <Dialog open={!!selectedVale} onOpenChange={() => setSelectedVale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-primary" />
              Procesar Vale #{selectedVale?.vale_number}
            </DialogTitle>
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
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Autorizado por</span>
                  <span className="text-sm">{selectedVale.creator?.full_name}</span>
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
                          <p className="text-xs text-muted-foreground">
                            Stock actual: {item.product?.stock} {item.product?.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">x{item.quantity}</p>
                          {insufficientStock && (
                            <p className="text-[10px] text-destructive font-medium">
                              ¡Stock insuficiente!
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedVale.notes && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Observaciones:</p>
                  <p className="text-sm">{selectedVale.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedVale(null)}>
              Cancelar
            </Button>
            <Button onClick={processVale} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4 mr-2" />
                  Confirmar Despacho
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
