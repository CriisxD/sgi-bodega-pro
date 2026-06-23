'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Search, PackagePlus, Eye, FileEdit, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

export default function RecepcionesPage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();
  
  const [receptions, setReceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialogs State
  const [viewingReception, setViewingReception] = useState<any | null>(null);
  
  const [editingReception, setEditingReception] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    supplier: '',
    supplier_rut: '',
    invoice: '',
    invoice_date: '',
    document_type: '',
    net_amount: 0,
    total_amount: 0
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const fetchData = async () => {
    setLoading(true);
    const { data: recs } = await supabase
      .from('receptions')
      .select(`
        *,
        receiver:profiles!receptions_received_by_fkey(full_name),
        items:reception_items(*, product:products(name, unit))
      `)
      .order('created_at', { ascending: false })
      .limit(50);
      
    setReceptions(recs || []);
    setLoading(false);
  };

  const filteredReceptions = receptions.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.supplier.toLowerCase().includes(s) 
      || (r.invoice || '').toLowerCase().includes(s)
      || (r.supplier_rut || '').toLowerCase().includes(s);
  });

  const docTypeLabel = (type: string | null) => {
    switch (type) {
      case 'factura': return 'Factura';
      case 'guia_despacho': return 'Guía';
      case 'boleta': return 'Boleta';
      case 'nota_credito': return 'N. Crédito';
      default: return type || 'Doc.';
    }
  };

  const openEditModal = (rec: any) => {
    setEditingReception(rec);
    setEditForm({
      supplier: rec.supplier || '',
      supplier_rut: rec.supplier_rut || '',
      invoice: rec.invoice || '',
      invoice_date: rec.invoice_date || '',
      document_type: rec.document_type || '',
      net_amount: rec.net_amount || 0,
      total_amount: rec.total_amount || 0
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReception) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('receptions')
        .update({
          supplier: editForm.supplier,
          supplier_rut: editForm.supplier_rut,
          invoice: editForm.invoice,
          invoice_date: editForm.invoice_date || null,
          document_type: editForm.document_type,
          net_amount: editForm.net_amount,
          total_amount: editForm.total_amount
        })
        .eq('id', editingReception.id);
        
      if (error) throw error;
      toast.success('Recepcion actualizada correctamente');
      setEditingReception(null);
      fetchData();
    } catch (e: any) {
      toast.error('Error al actualizar: ' + e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (rec: any) => {
    if (!confirm('¿Estás seguro de eliminar esta recepción? \n\nESTO RESTARÁ AUTOMÁTICAMENTE EL STOCK DE LOS PRODUCTOS. Esta acción NO se puede deshacer.')) return;
    
    setLoading(true);
    try {
      // 1. Revert stock for each item
      for (const item of rec.items || []) {
        // Fetch current stock first
        const { data: prodData } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
        if (prodData) {
          const newStock = Math.max(0, prodData.stock - item.quantity); // Avoid negative just in case
          await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);
          
          // Log the reversion
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            type: 'salida',
            quantity: item.quantity,
            reference_type: 'reception_reverted',
            reference_id: rec.id,
            notes: `Reversión por eliminación de recepción ${rec.invoice || 'sin doc'}`,
            created_by: profile?.id
          });
        }
      }
      
      // 2. Delete reception_items
      await supabase.from('reception_items').delete().eq('reception_id', rec.id);
      
      // 3. Delete reception
      const { error } = await supabase.from('receptions').delete().eq('id', rec.id);
      if (error) throw error;
      
      toast.success('Recepción eliminada y stock revertido correctamente');
      fetchData();
    } catch (e: any) {
      toast.error('Error crítico al eliminar: ' + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Recepciones de Stock</h2>
          <p className="text-muted-foreground text-sm">
            Ingreso de mercadería y actualización de inventario.
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/recepciones/nuevo')}>
          <PackagePlus className="w-4 h-4 mr-2" />
          Nueva Recepción
        </Button>
      </div>

      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-base">Historial de Recepciones</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedor o doc..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex items-center justify-center py-20">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
             </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Recibido por</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ítems</TableHead>
                    <TableHead className="text-right w-[140px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron registros de recepción.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReceptions.map((reception) => (
                      <TableRow key={reception.id}>
                        <TableCell className="text-sm">
                          <div>{format(new Date(reception.created_at), "d MMM yyyy", { locale: es })}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(reception.created_at), "HH:mm", { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{reception.supplier_name || reception.supplier}</div>
                          {reception.supplier_rut && (
                            <div className="text-xs text-muted-foreground font-mono">{reception.supplier_rut}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {docTypeLabel(reception.document_type)}
                            </Badge>
                            {reception.invoice ? (
                              <span className="font-mono text-sm">{reception.invoice}</span>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">Sin doc.</span>
                            )}
                          </div>
                          {reception.invoice_date && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(reception.invoice_date + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {reception.receiver?.full_name}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          ${(reception.total_amount || 0).toLocaleString('es-CL')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold">{reception.items?.length || 0} prod.</span>
                            <span className="text-[10px] text-muted-foreground">
                              {reception.items?.reduce((acc: number, item: any) => acc + item.quantity, 0)} unid.
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setViewingReception(reception)} title="Ver Detalle">
                               <Eye className="w-4 h-4" />
                             </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500" onClick={() => openEditModal(reception)} title="Editar Cabecera">
                               <FileEdit className="w-4 h-4" />
                             </Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(reception)} title="Eliminar Recepción y Revertir Stock">
                               <Trash2 className="w-4 h-4" />
                             </Button>
                          </div>
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

      {/* View Details Modal */}
      <Dialog open={!!viewingReception} onOpenChange={(open) => !open && setViewingReception(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-primary" />
              Detalle de Recepción
            </DialogTitle>
          </DialogHeader>
          
          {viewingReception && (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Proveedor</p>
                  <p className="font-semibold">{viewingReception.supplier_name || viewingReception.supplier}</p>
                  <p className="text-xs font-mono">{viewingReception.supplier_rut}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Documento</p>
                  <p className="font-semibold">{docTypeLabel(viewingReception.document_type)} {viewingReception.invoice}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fecha</p>
                  <p className="font-semibold">{format(new Date(viewingReception.created_at), "dd/MM/yyyy HH:mm")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Recibido por</p>
                  <p className="font-semibold">{viewingReception.receiver?.full_name}</p>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingReception.items?.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">
                          {item.product?.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity} <span className="text-xs text-muted-foreground">{item.product?.unit}</span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${(item.unit_price || 0).toLocaleString('es-CL')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${((item.unit_price || 0) * item.quantity).toLocaleString('es-CL')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-6 bg-muted/30 p-4 rounded-lg text-right">
                 <div>
                   <p className="text-xs text-muted-foreground">Neto</p>
                   <p className="font-semibold">${(viewingReception.net_amount || 0).toLocaleString('es-CL')}</p>
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground">IVA</p>
                   <p className="font-semibold">${(viewingReception.iva_amount || 0).toLocaleString('es-CL')}</p>
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground">Total</p>
                   <p className="text-xl font-bold text-primary">${(viewingReception.total_amount || 0).toLocaleString('es-CL')}</p>
                 </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setViewingReception(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Header Modal */}
      <Dialog open={!!editingReception} onOpenChange={(open) => !open && setEditingReception(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-primary" />
              Editar Cabecera de Recepción
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-warning/10 border border-warning/20 p-3 rounded-md text-sm text-warning-foreground mb-4">
               <strong>Nota:</strong> Solo puedes editar los datos del documento. Si hubo un error en las cantidades o productos recibidos, debes eliminar la recepción completa y volver a registrarla para evitar descuadres de stock.
            </div>

            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input 
                value={editForm.supplier}
                onChange={(e) => setEditForm({...editForm, supplier: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>RUT</Label>
                <Input 
                  value={editForm.supplier_rut}
                  onChange={(e) => setEditForm({...editForm, supplier_rut: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo Doc.</Label>
                <Input 
                  value={editForm.document_type}
                  onChange={(e) => setEditForm({...editForm, document_type: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nº Documento</Label>
                <Input 
                  value={editForm.invoice}
                  onChange={(e) => setEditForm({...editForm, invoice: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Documento</Label>
                <Input 
                  type="date"
                  value={editForm.invoice_date}
                  onChange={(e) => setEditForm({...editForm, invoice_date: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto Neto ($)</Label>
                <Input 
                  type="number"
                  value={editForm.net_amount || ''}
                  onChange={(e) => setEditForm({...editForm, net_amount: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Monto Total ($)</Label>
                <Input 
                  type="number"
                  value={editForm.total_amount || ''}
                  onChange={(e) => setEditForm({...editForm, total_amount: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReception(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
