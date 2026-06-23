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
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Trash2, Save, Loader2, ArrowLeft, PackagePlus, Upload, Download } from 'lucide-react';
import { useRef } from 'react';
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
  const [newProdUnitBase, setNewProdUnitBase] = useState('un');
  const [newProdUnitDetail, setNewProdUnitDetail] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');

  // Import CSV State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const finalUnit = ['rollo', 'caja', 'bolsa', 'tira', 'set'].includes(newProdUnitBase) && newProdUnitDetail.trim() 
      ? `${newProdUnitBase} de ${newProdUnitDetail.trim()}`
      : newProdUnitBase;
    
    try {
      const { data, error } = await supabase.from('products').insert({
        name: newProdName.trim(),
        brand: newProdBrand.trim() || null,
        category_id: newProdCat,
        stock: 0,
        min_stock: newProdMinStock === '' ? 0 : (newProdMinStock as number),
        unit: finalUnit
      }).select('*, category:categories(*)').single();
      
      if (error) throw error;
      
      toast.success('Producto creado y agregado a la lista');
      setProducts([...products, data]);
      handleAddToCart(data);
      setIsNewProductOpen(false);
      setNewProdName('');
      setNewProdBrand('');
      setNewProdCat('');
      setNewProdUnitBase('un');
      setNewProdUnitDetail('');
      
    } catch (e: any) {
      toast.error('Error al crear producto: ' + e.message);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "Producto,Cantidad,Precio_Unitario_Neto\n\"Nombre exacto del producto\",10,5000";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_recepcion.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLine = (line: string) => {
    const result = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i+1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cell);
        cell = '';
      } else {
        cell += char;
      }
    }
    result.push(cell);
    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        
        if (lines.length < 2) {
          toast.error("El archivo está vacío o no tiene datos.");
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        const prodIdx = headers.findIndex(h => h.includes('producto') || h.includes('nombre'));
        const cantIdx = headers.findIndex(h => h.includes('cantidad') || h.includes('cant'));
        const precIdx = headers.findIndex(h => h.includes('precio') || h.includes('neto'));

        if (prodIdx === -1 || cantIdx === -1) {
          toast.error("Formato inválido. Descarga la plantilla primero.");
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const preview = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i]);
          if (cells.length < 2) continue;

          const rawName = cells[prodIdx]?.trim();
          const rawCant = cells[cantIdx]?.trim();
          const rawPrec = precIdx !== -1 ? cells[precIdx]?.trim() : '0';

          if (!rawName) continue;

          // Find product exactly by name
          const matchedProduct = products.find(p => p.name.toLowerCase() === rawName.toLowerCase());

          const quantity = parseInt(rawCant) || 0;
          const unitPrice = parseFloat(rawPrec) || 0;

          if (matchedProduct) {
            preview.push({
              status: 'ok',
              rawName,
              matchedProduct,
              quantity,
              unitPrice
            });
          } else {
            preview.push({
              status: 'error',
              rawName,
              errorMessage: 'Producto no encontrado en el catálogo',
              quantity,
              unitPrice
            });
          }
        }

        setPreviewData(preview);
        setShowPreview(true);
      } catch (err: any) {
        toast.error("Error al leer el archivo: " + err.message);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const removePreviewRow = (index: number) => {
    setPreviewData(prev => prev.filter((_, i) => i !== index));
  };

  const confirmImport = () => {
    const hasErrors = previewData.some(r => r.status === 'error');
    if (hasErrors) {
      toast.error('Corrige o elimina los productos con error antes de confirmar');
      return;
    }

    const newCart = [...cart];
    for (const row of previewData) {
      if (row.status !== 'ok') continue;
      
      const existingIdx = newCart.findIndex(item => item.product.id === row.matchedProduct.id);
      if (existingIdx >= 0) {
        newCart[existingIdx].quantity += row.quantity;
        if (row.unitPrice > 0) newCart[existingIdx].unit_price = row.unitPrice;
      } else {
        newCart.push({
          product: row.matchedProduct,
          quantity: row.quantity,
          unit_price: row.unitPrice
        });
      }
    }

    setCart(newCart);
    toast.success(`${previewData.length} productos añadidos al carro`);
    setIsImportModalOpen(false);
    setShowPreview(false);
    setPreviewData([]);
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

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="w-full border-dashed"
                  onClick={() => setIsNewProductOpen(true)}
                >
                  <PackagePlus className="w-4 h-4 mr-2" />
                  Crear Nuevo
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full border-dashed bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => setIsImportModalOpen(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importar CSV
                </Button>
              </div>
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
                <div className="flex gap-2">
                  <Select value={newProdUnitBase} onValueChange={(val) => setNewProdUnitBase(val || 'un')}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">un (Unidad)</SelectItem>
                      <SelectItem value="par">par (Par)</SelectItem>
                      <SelectItem value="mt">mt (Metro)</SelectItem>
                      <SelectItem value="kg">kg (Kilo)</SelectItem>
                      <SelectItem value="lt">lt (Litro)</SelectItem>
                      <SelectItem value="rollo">rollo</SelectItem>
                      <SelectItem value="caja">caja</SelectItem>
                      <SelectItem value="bolsa">bolsa</SelectItem>
                      <SelectItem value="tira">tira</SelectItem>
                      <SelectItem value="set">set</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {['rollo', 'caja', 'bolsa', 'tira', 'set'].includes(newProdUnitBase) && (
                    <Input 
                      placeholder="Cant. (Ej: 100)"
                      value={newProdUnitDetail}
                      onChange={e => setNewProdUnitDetail(e.target.value)}
                      className="w-32"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewProductOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateProduct}>Guardar y Añadir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={(open) => {
        setIsImportModalOpen(open);
        if (!open) {
          setShowPreview(false);
          setPreviewData([]);
        }
      }}>
        <DialogContent className={showPreview ? "max-w-[95vw] sm:max-w-4xl max-h-[90vh]" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" /> 
              {showPreview ? 'Vista Previa de Importación' : 'Importación Masiva de Productos'}
            </DialogTitle>
          </DialogHeader>

          {!showPreview ? (
            <div className="space-y-6 py-4">
              <div className="bg-muted/50 p-4 rounded-lg border border-border text-sm space-y-3">
                <p>Para cargar múltiples productos a la recepción, usa nuestra plantilla CSV:</p>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Descarga la plantilla CSV.</li>
                  <li>Abre el archivo en Excel o Google Sheets.</li>
                  <li>Ingresa el <strong className="text-foreground">Nombre Exacto</strong> del producto tal cual está en el catálogo, la cantidad, y el precio neto opcional.</li>
                  <li>Guarda como CSV y sube el archivo aquí.</li>
                </ol>
              </div>

              <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" /> Descargar Plantilla CSV
              </Button>

              <div className="space-y-2">
                <Label>Subir Archivo CSV Lleno</Label>
                <Input 
                  type="file" 
                  accept=".csv" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={importing}
                />
                {importing && (
                  <div className="flex items-center gap-2 text-sm text-primary mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Procesando importación...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap gap-4 mb-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 py-1">
                  {previewData.filter(r => r.status === 'ok').length} Listos
                </Badge>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 py-1">
                  {previewData.filter(r => r.status === 'error').length} Errores
                </Badge>
              </div>
              
              <div className="border rounded-md overflow-hidden flex-1 min-h-0 relative">
                <div className="max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[100px]">Estado</TableHead>
                        <TableHead>Producto (CSV)</TableHead>
                        <TableHead>Producto Encontrado</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">P. Unitario</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, i) => (
                        <TableRow key={i} className={row.status === 'error' ? 'bg-destructive/5' : ''}>
                          <TableCell>
                             {row.status === 'ok' ? <Badge className="bg-success hover:bg-success/80">OK</Badge> : <Badge variant="destructive">Error</Badge>}
                          </TableCell>
                          <TableCell className="text-sm">
                             <div className="font-medium">{row.rawName}</div>
                             {row.status === 'error' && <p className="text-xs text-destructive mt-0.5">{row.errorMessage}</p>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                             {row.matchedProduct?.name || '-'}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                             {row.quantity}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                             ${row.unitPrice.toLocaleString('es-CL')}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removePreviewRow(i)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {previewData.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-4">No hay datos que procesar</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between w-full">
                 <Button variant="outline" onClick={() => { setShowPreview(false); setPreviewData([]); }}>
                   Descartar y Volver
                 </Button>
                 <Button onClick={confirmImport} disabled={importing || previewData.length === 0 || previewData.some(r => r.status === 'error')}>
                   {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                   Confirmar y Añadir a la Lista
                 </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
