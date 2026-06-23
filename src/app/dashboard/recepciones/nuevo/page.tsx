'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Trash2, Save, Loader2, ArrowLeft, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import type { Product, Category } from '@/lib/types';

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
}

export default function NuevaRecepcionPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Invoice / Document Form State
  const [documentType, setDocumentType] = useState('factura');
  const [supplierRut, setSupplierRut] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Product Search State
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Product Modal State
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCat, setNewProdCat] = useState('');
  const [newProdMinStock, setNewProdMinStock] = useState<number | string>(0);
  const [newProdUnit, setNewProdUnit] = useState('un');
  const [newProdBrand, setNewProdBrand] = useState('');

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').order('name'),
      supabase.from('categories').select('*').order('name')
    ]);
    
    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) && p.active
  );

  const handleAddToCart = (product: Product) => {
    if (cart.some(item => item.product.id === product.id)) {
      toast.error('Este producto ya está en la lista de recepción');
      return;
    }
    setCart([...cart, { product, quantity: 1, unit_price: 0 }]);
    setSearchQuery('');
  };

  const updateCartItem = (productId: string, field: 'quantity' | 'unit_price', value: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeCartItem = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const handleCreateProduct = async () => {
    if (!newProdName.trim() || !newProdCat) {
      toast.error('Falta el nombre o la categoría');
      return;
    }
    
    try {
      const { data, error } = await supabase.from('products').insert({
        name: newProdName.trim(),
        brand: newProdBrand.trim() || null,
        category_id: newProdCat,
        stock: 0,
        min_stock: newProdMinStock === '' ? 0 : (newProdMinStock as number),
        unit: newProdUnit.trim() || 'un'
      }).select('*, category:categories(*)').single();
      
      if (error) throw error;
      
      toast.success('Producto creado y agregado a la lista');
      setProducts([...products, data]);
      handleAddToCart(data);
      setIsNewProductOpen(false);
      setNewProdName('');
      setNewProdBrand('');
      setNewProdCat('');
      
    } catch (e: any) {
      toast.error('Error al crear producto: ' + e.message);
    }
  };

  // Calculated totals
  const netAmount = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const ivaAmount = Math.round(netAmount * 0.19);
  const totalAmount = netAmount + ivaAmount;

  const handleSaveReception = async () => {
    if (!supplierName.trim()) return toast.error('Debes ingresar el nombre/razón social del proveedor');
    if (cart.length === 0) return toast.error('Añade al menos un producto a la recepción');
    if (cart.some(item => item.quantity <= 0)) return toast.error('Las cantidades deben ser mayores a cero');
    if (!profile) return toast.error('Error de sesión');

    setSaving(true);
    try {
      // 1. Create Reception with full invoice data
      const { data: reception, error: recError } = await supabase.from('receptions').insert({
        supplier: supplierName.trim(),
        supplier_rut: supplierRut.trim() || null,
        supplier_name: supplierName.trim(),
        invoice: invoiceNumber.trim() || null,
        invoice_date: invoiceDate || null,
        document_type: documentType,
        net_amount: netAmount,
        iva_amount: ivaAmount,
        total_amount: totalAmount,
        notes: notes.trim() || null,
        received_by: profile.id
      }).select().single();

      if (recError) throw recError;

      // 2. Add Items
      const itemsToInsert = cart.map(item => ({
        reception_id: reception.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price || 0
      }));

      const { error: itemsError } = await supabase.from('reception_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // 3. Stock Movements & Increase Stock
      const movements = cart.map(item => ({
        product_id: item.product.id,
        type: 'entrada',
        quantity: item.quantity,
        reference_type: 'reception',
        reference_id: reception.id,
        created_by: profile.id
      }));
      
      await supabase.from('stock_movements').insert(movements);

      // Increase stock for each product
      for (const item of cart) {
        await supabase.rpc('increase_stock', {
          p_product_id: item.product.id,
          p_quantity: item.quantity
        });
      }

      toast.success('Recepción registrada con éxito y stock actualizado');
      router.push('/dashboard/recepciones');

    } catch (e: any) {
      toast.error('Error al guardar: ' + e.message);
      setSaving(false);
    }
  };

  // Format RUT as user types
  const handleRutChange = (value: string) => {
    // Remove everything except numbers and K/k
    let clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length > 1) {
      const body = clean.slice(0, -1);
      const dv = clean.slice(-1);
      // Add dots and dash
      const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
      setSupplierRut(formatted);
    } else {
      setSupplierRut(clean);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Nueva Recepción de Stock</h2>
          <p className="text-muted-foreground">Registra facturas o guías e ingresa nuevo stock a la bodega</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Invoice Info */}
        <div className="md:col-span-1 space-y-6">
          <Card className="card-glow border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Datos del Documento</CardTitle>
              <CardDescription>Información de la factura o guía</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Type */}
              <div className="space-y-2">
                <Label>Tipo de Documento</Label>
                <Select value={documentType} onValueChange={(val) => setDocumentType(val || 'factura')}>
                  <SelectTrigger>
                    <SelectValue>
                      {documentType === 'factura' ? 'Factura' : 
                       documentType === 'guia_despacho' ? 'Guía de Despacho' : 
                       documentType === 'boleta' ? 'Boleta' : 
                       documentType === 'nota_credito' ? 'Nota de Crédito' : 'Otro'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="factura">Factura</SelectItem>
                    <SelectItem value="guia_despacho">Guía de Despacho</SelectItem>
                    <SelectItem value="boleta">Boleta</SelectItem>
                    <SelectItem value="nota_credito">Nota de Crédito</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Invoice Number */}
              <div className="space-y-2">
                <Label>Nº Documento</Label>
                <Input 
                  placeholder="Ej. F-12345" 
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                />
              </div>

              {/* Invoice Date */}
              <div className="space-y-2">
                <Label>Fecha del Documento</Label>
                <Input 
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                />
              </div>

              <div className="h-px bg-border/50 my-1" />

              {/* Supplier RUT */}
              <div className="space-y-2">
                <Label>RUT Proveedor</Label>
                <Input 
                  placeholder="Ej. 76.123.456-7" 
                  value={supplierRut}
                  onChange={e => handleRutChange(e.target.value)}
                />
              </div>

              {/* Supplier Name */}
              <div className="space-y-2">
                <Label>Razón Social / Nombre <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="Ej. Sodimac S.A." 
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                />
              </div>

              <div className="h-px bg-border/50 my-1" />

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notas (Opcional)</Label>
                <Textarea 
                  placeholder="Observaciones de la entrega..." 
                  className="resize-none"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* Totals Summary */}
              {cart.length > 0 && (
                <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Neto</span>
                    <span className="font-medium">${netAmount.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA (19%)</span>
                    <span className="font-medium">${ivaAmount.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="h-px bg-border/50" />
                  <div className="flex justify-between font-bold text-primary">
                    <span>Total</span>
                    <span>${totalAmount.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Product Search Widget */}
          <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Agregar Producto</CardTitle>
              <CardDescription>Busca en el catálogo o crea uno nuevo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              
              {searchQuery && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 flex flex-col">
                  {filteredProducts.slice(0, 5).map(prod => (
                    <button
                      key={prod.id}
                      onClick={() => handleAddToCart(prod)}
                      className="text-left px-3 py-2 hover:bg-muted text-sm border-b border-border/50 flex justify-between items-center"
                    >
                      <span className="font-medium truncate mr-2">{prod.name}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{prod.category?.name}</span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      No se encontraron resultados
                    </div>
                  )}
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full border-dashed"
                onClick={() => setIsNewProductOpen(true)}
              >
                <PackagePlus className="w-4 h-4 mr-2" />
                Crear Nuevo Producto Rápido
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Items List */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border/50 min-h-[400px] flex flex-col">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>Detalle de Productos</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {cart.length} items
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-24 text-center">Cant.</TableHead>
                    <TableHead className="w-32 text-center">Prec. Unitario (Neto)</TableHead>
                    <TableHead className="w-24 text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <PackagePlus className="w-8 h-8 opacity-20" />
                          <p>Busca y añade productos para la recepción</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map(item => (
                      <TableRow key={item.product.id}>
                        <TableCell className="font-medium">
                          <div className="truncate max-w-[150px] sm:max-w-[200px]" title={item.product.name}>
                            {item.product.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{item.product.unit}</div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            className="h-8 w-20 text-center mx-auto"
                            value={item.quantity || ''}
                            onChange={(e) => updateCartItem(item.product.id, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 pl-5"
                              value={item.unit_price || ''}
                              onChange={(e) => updateCartItem(item.product.id, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${(item.quantity * item.unit_price).toLocaleString('es-CL')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => removeCartItem(item.product.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {cart.length > 0 && (
              <div className="p-4 bg-muted/30 border-t border-border flex flex-col gap-1 rounded-b-lg">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Neto</span>
                  <span>${netAmount.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>IVA (19%)</span>
                  <span>${ivaAmount.toLocaleString('es-CL')}</span>
                </div>
                <div className="h-px bg-border/50 my-1" />
                <div className="flex justify-between font-bold text-primary text-lg">
                  <span>Total</span>
                  <span>${totalAmount.toLocaleString('es-CL')}</span>
                </div>
              </div>
            )}
          </Card>
          
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
            <Button size="lg" className="w-full sm:w-auto" onClick={handleSaveReception} disabled={saving || cart.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar Recepción
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Create Product Modal */}
      <Dialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Producto Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input 
                value={newProdName} 
                onChange={e => setNewProdName(e.target.value)} 
                placeholder="Ej. Martillo demoledor"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={newProdCat} onValueChange={(val) => setNewProdCat(val || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar...">
                    {categories.find(c => c.id === newProdCat) ? `${categories.find(c => c.id === newProdCat)?.name} (${categories.find(c => c.id === newProdCat)?.type})` : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Marca</Label>
              <Input 
                value={newProdBrand} 
                onChange={e => setNewProdBrand(e.target.value)} 
                placeholder="Ej. 3M, Bosch, Stanley..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock Mínimo (Alerta)</Label>
                <Input 
                  type="number" 
                  value={newProdMinStock} 
                  onChange={e => setNewProdMinStock(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Input 
                  list="unit-options"
                  placeholder="Ej. un, caja, mt..."
                  value={newProdUnit} 
                  onChange={e => setNewProdUnit(e.target.value)} 
                />
                <datalist id="unit-options">
                  <option value="un" />
                  <option value="par" />
                  <option value="mt" />
                  <option value="kg" />
                  <option value="lt" />
                  <option value="rollo" />
                  <option value="caja" />
                  <option value="bolsa" />
                </datalist>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewProductOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateProduct}>Guardar y Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
