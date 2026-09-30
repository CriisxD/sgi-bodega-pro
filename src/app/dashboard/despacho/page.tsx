'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Smartphone,
  Wifi,
  PenTool,
  Pencil,
  MessageSquare
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Vale } from '@/lib/types';
import { FullScreenSignatureModal } from '@/components/shared/full-screen-signature';

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
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createClient();
  const [vales, setVales] = useState<Vale[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedVale, setSelectedVale] = useState<Vale | null>(null);
  const [editableItems, setEditableItems] = useState<Record<string, number | ''>>({});
  const [processing, setProcessing] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [remoteSignatureStatus, setRemoteSignatureStatus] = useState<'waiting' | 'received'>('waiting');
  const [signatureMode, setSignatureMode] = useState<'qr' | 'local'>('qr');
  const [isFullScreenSignatureOpen, setIsFullScreenSignatureOpen] = useState(false);
  const [notesModalVale, setNotesModalVale] = useState<Vale | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const modalCanvasContainerRef = useRef<HTMLDivElement>(null);

  const handleSaveNotes = async () => {
    if (!notesModalVale) return;
    setSavingNotes(true);
    
    const { error } = await supabase
      .from('vales')
      .update({ notes: internalNotes })
      .eq('id', notesModalVale.id);
      
    setSavingNotes(false);
    
    if (error) {
      toast.error('Error al guardar las notas');
      return;
    }
    
    toast.success('Notas guardadas correctamente');
    setVales(vales.map(v => v.id === notesModalVale.id ? { ...v, notes: internalNotes } : v));
    setNotesModalVale(null);
  };

  const handleSelectVale = (vale: Vale) => {
    setSelectedVale(vale);
    const initialItems: Record<string, number> = {};
    vale.items?.forEach(item => {
      const stock = item.product?.stock || 0;
      initialItems[item.id] = Math.min(item.quantity, stock > 0 ? stock : 0);
    });
    setEditableItems(initialItems);
    setSignatureData(vale.signature || null);
    setRemoteSignatureStatus('waiting');
    
    // Auto-detect mobile screen width to default to local signing
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setSignatureMode('local');
    } else {
      setSignatureMode('qr');
    }
  };

  // Resize local signature canvas inside the modal
  useEffect(() => {
    if (!selectedVale || signatureMode !== 'local') return;

    const canvas = sigCanvas.current?.getCanvas();
    const container = modalCanvasContainerRef.current;
    if (!canvas || !container) return;

    const resizeModalCanvas = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width > 0 && height > 0) {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        sigCanvas.current?.clear();
        setSignatureData(null); // Clear signature data to prevent stale data
      }
    };

    // Wait a brief moment for Dialog transition to finish
    const timer = setTimeout(resizeModalCanvas, 250);

    window.addEventListener('resize', resizeModalCanvas);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resizeModalCanvas);
    };
  }, [selectedVale, signatureMode]);

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

  // Listen for remote signatures for the currently selected vale
  useEffect(() => {
    if (!selectedVale) return;

    const signatureChannel = supabase
      .channel(`vale-${selectedVale.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vales',
          filter: `id=eq.${selectedVale.id}`
        },
        (payload) => {
          if (payload.new.signature && payload.new.signature !== signatureData) {
            setSignatureData(payload.new.signature);
            setRemoteSignatureStatus('received');
            toast.success('¡Firma remota recibida con éxito!');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(signatureChannel);
    };
  }, [selectedVale, supabase, signatureData]);

  const filteredVales = vales.filter((v) => {
    const matchesSearch = !search || 
      v.vale_number.toString().includes(search.toLowerCase()) ||
      (v.worker?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.worker?.rut || '').toLowerCase().includes(search.toLowerCase());
      
    const matchesType = typeFilter === 'all' || v.type === typeFilter;
    
    return matchesSearch && matchesType;
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
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            {filteredVales.length} vale{filteredVales.length !== 1 && 's'} pendiente{filteredVales.length !== 1 && 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={typeFilter} onValueChange={(val) => val && setTypeFilter(val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="epp">EPP</SelectItem>
              <SelectItem value="consumo">Consumo</SelectItem>
              <SelectItem value="herramienta">Herramienta</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar N°, nombre o RUT..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
                        
                        {/* Items preview */}
                        <div className="mt-3 bg-muted/30 rounded-md p-2 border border-border/50">
                          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                            Ítems a entregar ({vale.items?.length || 0}):
                          </p>
                          <ul className="text-sm space-y-1">
                            {vale.items?.slice(0, 2).map((item) => (
                              <li key={item.id} className="flex justify-between gap-4">
                                <span className="truncate">{item.product?.name}</span>
                                <span className="font-medium shrink-0">x{item.quantity}</span>
                              </li>
                            ))}
                            {(vale.items?.length || 0) > 2 && (
                              <li className="text-xs text-muted-foreground italic">
                                + {(vale.items?.length || 0) - 2} ítem(s) más...
                              </li>
                            )}
                          </ul>
                        </div>
                        {/* Notes preview */}
                        {vale.notes && (
                          <div className="mt-3 bg-amber-500/10 text-amber-500/90 rounded-md p-3 border border-amber-500/20 text-xs">
                            <p className="font-semibold mb-1 flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Nota Interna</p>
                            <p className="italic">{vale.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 mt-2 sm:mt-0 flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInternalNotes(vale.notes || '');
                          setNotesModalVale(vale);
                        }}
                        className="w-full sm:w-auto border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Notas
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/vales/editar/${vale.id}`);
                        }}
                        className="w-full sm:w-auto"
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button size="sm" className="w-full sm:w-auto">
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
        <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-4xl lg:max-w-5xl w-full max-h-[90vh] overflow-y-auto">
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
                <div className="flex justify-between items-center mb-3">
                  <Label className="font-bold flex items-center gap-2">
                    <Signature className="w-4 h-4 text-primary" /> 
                    Firma del Trabajador {selectedVale?.type === 'epp' && <span className="text-destructive">*Obligatoria</span>}
                  </Label>
                  {signatureData && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSignatureData(null);
                        setRemoteSignatureStatus('waiting');
                        sigCanvas.current?.clear();
                      }}
                      className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Limpiar Firma
                    </Button>
                  )}
                </div>

                {/* Alternar entre QR Remoto y Firma Local */}
                <div className="grid grid-cols-2 gap-2 mb-4 bg-muted/50 p-1 rounded-xl border">
                  <Button
                    type="button"
                    variant={signatureMode === 'qr' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="text-xs font-bold rounded-lg h-9"
                    onClick={() => {
                      setSignatureMode('qr');
                      setSignatureData(null);
                      setRemoteSignatureStatus('waiting');
                    }}
                  >
                    <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                    Código QR
                  </Button>
                  <Button
                    type="button"
                    variant={signatureMode === 'local' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="text-xs font-bold rounded-lg h-9"
                    onClick={() => {
                      setSignatureMode('local');
                      setSignatureData(null);
                    }}
                  >
                    <Signature className="w-3.5 h-3.5 mr-1.5" />
                    Firmar en Pantalla
                  </Button>
                </div>

                {signatureMode === 'qr' ? (
                  !signatureData ? (
                    <div className="flex flex-col sm:flex-row gap-6 items-center bg-muted/20 p-4 rounded-xl border border-border/50">
                      <div className="bg-white p-3 rounded-xl shadow-sm shrink-0">
                        <QRCodeSVG 
                          value={typeof window !== 'undefined' ? `${window.location.origin}/firma/${selectedVale.id}` : ''}
                          size={140}
                          bgColor="#ffffff"
                          fgColor="#000000"
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                      <div className="text-center sm:text-left space-y-2">
                        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                          <Wifi className="w-3 h-3 animate-pulse" /> Esperando firma...
                        </div>
                        <h4 className="font-bold text-base">Que el trabajador escanee este código</h4>
                        <p className="text-sm text-muted-foreground">
                          Pídele a <span className="font-bold text-foreground">{selectedVale.worker?.name}</span> que abra la cámara de su celular, apunte al código QR y firme en su pantalla. Aparecerá aquí mágicamente.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-success/50 rounded-xl bg-success/5 overflow-hidden flex flex-col items-center justify-center p-6 relative">
                      <div className="absolute top-2 right-2 bg-success text-success-foreground text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Recibida
                      </div>
                      <div className="bg-white p-2 rounded-lg w-full max-w-[240px] h-28 flex items-center justify-center mt-4 shadow-sm border border-border/20">
                        <img src={signatureData} alt="Firma recibida" className="h-full object-contain" />
                      </div>
                      <p className="text-xs text-success font-semibold mt-3">Firma digital lista para guardar</p>
                    </div>
                  )
                ) : (
                  // Firma Local (Pantalla Táctil o Mouse)
                  <div className="space-y-3">
                    {!signatureData ? (
                      <Button
                        type="button"
                        onClick={() => setIsFullScreenSignatureOpen(true)}
                        className="w-full h-28 border-2 border-dashed border-border hover:border-primary/50 bg-background/50 hover:bg-primary/5 text-muted-foreground hover:text-primary rounded-xl flex flex-col items-center justify-center gap-2 transition-all font-semibold"
                      >
                        <PenTool className="w-6 h-6 animate-pulse text-amber-500" />
                        <span className="text-sm">Presione aquí para firmar en pantalla completa</span>
                        <span className="text-[10px] font-normal text-muted-foreground">La pantalla se girará para firmar de costado</span>
                      </Button>
                    ) : (
                      <div className="border border-border/80 rounded-xl bg-muted/50 overflow-hidden flex flex-col items-center justify-center p-5 relative">
                        <div className="absolute top-2 right-2 bg-success text-success-foreground text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 select-none pointer-events-none">
                          <CheckCircle className="w-2.5 h-2.5" /> Firma Capturada
                        </div>
                        {/* We display signature image: since signature is black stroke on transparent canvas, we show it on a light background slot so it's clearly visible */}
                        <div className="bg-white p-2 rounded-lg w-full max-w-[200px] h-20 flex items-center justify-center">
                          <img src={signatureData} alt="Firma capturada" className="h-full object-contain" />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsFullScreenSignatureOpen(true)}
                          className="mt-3 text-xs h-8"
                        >
                          Volver a firmar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button variant="ghost" onClick={() => setSelectedVale(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleProcess} 
              disabled={processing || (selectedVale?.type === 'epp' && !signatureData)}
              className="font-bold shadow-lg shadow-primary/20"
              size="lg"
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

      <Dialog open={!!notesModalVale} onOpenChange={() => setNotesModalVale(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Notas Internas
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Agrega una nota para el Vale #{notesModalVale?.vale_number}. Solo visible para la bodega.
            </p>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Ej: Falta stock de guantes, se entregará mañana..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotesModalVale(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveNotes} 
              disabled={savingNotes}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {savingNotes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FullScreenSignatureModal
        isOpen={isFullScreenSignatureOpen}
        onClose={() => setIsFullScreenSignatureOpen(false)}
        onConfirm={(sig) => setSignatureData(sig)}
        title={`Firma de ${selectedVale?.worker?.name || 'Trabajador'}`}
      />
    </div>
  );
}
