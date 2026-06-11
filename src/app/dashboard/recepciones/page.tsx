'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Search, PackagePlus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Product, Reception } from '@/lib/types';

export default function RecepcionesPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<{product: Product, quantity: number}[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const fetchData = async () => {
    // Fetch past receptions
    const { data: recs } = await supabase
      .from('receptions')
      .select(`
        *,
        receiver:profiles!receptions_received_by_fkey(full_name),
        items:reception_items(*, product:products(name, unit))
      `)
      .order('created_at', { ascending: false })
      .limit(50);
      
    // Fetch products for the dropdown
    const { data: prods } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('name');

    setReceptions(recs as any[] || []);
    setProducts(prods as Product[] || []);
    setLoading(false);
  };

  const filteredReceptions = receptions.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.supplier.toLowerCase().includes(s) || (r.invoice || '').toLowerCase().includes(s);
  });

  const availableProducts = products.filter(p => 
    !selectedItems.some(item => item.product.id === p.id) &&
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addItem = (product: Product) => {
    setSelectedItems([...selectedItems, { product, quantity: 1 }]);
    setProductSearch('');
  };

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setSelectedItems(selectedItems.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    ));
  };

  const handleSave = async () => {
    if (!supplier) return toast.error('Debes ingresar un proveedor');
    if (selectedItems.length === 0) return toast.error('Debes agregar al menos un ítem');
    if (selectedItems.some(i => i.quantity <= 0)) return toast.error('Las cantidades deben ser mayores a 0');
    if (!profile) return toast.error('No se encontró el perfil de usuario');

    setProcessing(true);
    try {
      // 1. Create reception record
      const { data: newReception, error: receptionError } = await supabase
        .from('receptions')
        .insert({
          supplier,
          invoice: invoice || null,
          notes: notes || null,
          received_by: profile.id
        })
        .select()
        .single();

      if (receptionError) throw receptionError;

      // 2. Prepare and insert reception items & stock movements & update stock
      for (const item of selectedItems) {
        // Insert item
        await supabase.from('reception_items').insert({
          reception_id: newReception.id,
          product_id: item.product.id,
          quantity: item.quantity
        });

        // Insert stock movement
        await supabase.from('stock_movements').insert({
          product_id: item.product.id,
          type: 'entrada',
          quantity: item.quantity,
          reference_type: 'recepcion',
          reference_id: newReception.id,
          notes: `Recepción ${invoice ? `Fact/Guía: ${invoice}` : ''} - Prov: ${supplier}`,
          created_by: profile.id
        });

        // Update product stock (Using RPC or manual update)
        const { error: rpcError } = await supabase.rpc('increase_stock', {
          p_product_id: item.product.id,
          p_quantity: item.quantity
        });

        if (rpcError) {
          // Fallback if RPC doesn't exist
          const { data: currentProd } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.product.id)
            .single();
            
          await supabase
            .from('products')
            .update({ stock: (currentProd?.stock || 0) + item.quantity })
            .eq('id', item.product.id);
        }
      }

      toast.success('Recepción registrada y stock actualizado');
      
      // Reset form
      setSupplier('');
      setInvoice('');
      setNotes('');
      setSelectedItems([]);
      setIsModalOpen(false);
      
      fetchData();
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
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
          <h2 className="text-xl font-bold">Recepciones de Stock</h2>
          <p className="text-muted-foreground text-sm">
            Ingreso de mercadería y actualización de inventario.
          </p>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={
            <Button>
              <PackagePlus className="w-4 h-4 mr-2" />
              Nueva Recepción
            </Button>
          } />
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-primary" />
                Registrar Ingreso de Mercadería
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor <span className="text-destructive">*</span></Label>
                  <Input 
                    placeholder="Nombre del proveedor o rut..." 
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>N° Factura / Guía Despacho</Label>
                  <Input 
                    placeholder="Ej. 123456" 
                    value={invoice}
                    onChange={(e) => setInvoice(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Observaciones</Label>
                  <Input 
                    placeholder="Notas opcionales sobre el ingreso..." 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Ítems Recibidos</h3>
                
                {/* Product Search & Select */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto para agregar..."
                    className="pl-9"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productSearch && availableProducts.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {availableProducts.map(p => (
                        <div 
                          key={p.id}
                          className="px-4 py-2 hover:bg-muted cursor-pointer text-sm flex justify-between"
                          onClick={() => addItem(p)}
                        >
                          <span>{p.name}</span>
                          <span className="text-muted-foreground text-xs">Stock actual: {p.stock}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {productSearch && availableProducts.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg p-4 text-sm text-muted-foreground text-center">
                      No se encontraron productos disponibles.
                    </div>
                  )}
                </div>

                {/* Selected Items Table */}
                {selectedItems.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="w-32">Cantidad</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItems.map((item) => (
                          <TableRow key={item.product.id}>
                            <TableCell className="font-medium text-sm">
                              {item.product.name}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input 
                                  type="number" 
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 0)}
                                  className="w-20 h-8"
                                />
                                <span className="text-xs text-muted-foreground">{item.product.unit}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeItem(item.product.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-md bg-muted/20 border-dashed text-muted-foreground text-sm">
                    Busca y selecciona productos para agregar al ingreso.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t mt-auto">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={processing || selectedItems.length === 0 || !supplier}>
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Guardar e Ingresar Stock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Historial de Recepciones</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedor o factura..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Recibido por</TableHead>
                  <TableHead className="text-right">Ítems</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No se encontraron registros de recepción.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceptions.map((reception) => (
                    <TableRow key={reception.id}>
                      <TableCell className="text-sm">
                        {format(new Date(reception.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {reception.supplier}
                      </TableCell>
                      <TableCell>
                        {reception.invoice || <span className="text-muted-foreground italic text-xs">Sin doc.</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {reception.receiver?.full_name}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold">{reception.items?.length || 0} productos</span>
                          <span className="text-[10px] text-muted-foreground">
                            total: {reception.items?.reduce((acc: number, item: any) => acc + item.quantity, 0)} unid.
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
