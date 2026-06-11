'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FilePlus,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Worker, Product, ValeType } from '@/lib/types';

interface CartItem {
  product: Product;
  quantity: number;
}

const valeTypeOptions: { value: ValeType; label: string; description: string }[] = [
  { value: 'material', label: 'Material', description: 'Materiales de consumo (tornillos, pintura, etc.)' },
  { value: 'epp', label: 'EPP', description: 'Elementos de Protección Personal' },
];

export default function NuevoValePage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [valeType, setValeType] = useState<ValeType>('material');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [workerSearch, setWorkerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [valeNumber, setValeNumber] = useState<number | null>(null);

  // Only prevencionista can create EPP vales
  const availableTypes = useMemo(() => {
    if (profile?.role === 'admin' || profile?.role === 'bodeguero') {
      return valeTypeOptions; // Can create both EPP and Material
    }
    if (profile?.role === 'prevencionista') {
      return valeTypeOptions.filter((t) => t.value === 'epp');
    }
    return valeTypeOptions.filter((t) => t.value !== 'epp');
  }, [profile?.role]);

  // Set default type based on role
  useEffect(() => {
    if (profile?.role === 'prevencionista') {
      setValeType('epp');
    }
  }, [profile?.role]);

  // Fetch workers (filtered by supervisor's area)
  useEffect(() => {
    const fetchWorkers = async () => {
      let query = supabase
        .from('workers')
        .select('*')
        .eq('active', true)
        .order('name');

      // Supervisors only see workers from their area
      if (profile?.role === 'supervisor' && profile?.area) {
        query = query.eq('area', profile.area);
      }

      const { data } = await query;
      setWorkers(data || []);
    };
    if (profile) fetchWorkers();
  }, [supabase, profile]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      let query = supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('active', true)
        .order('name');

      // Filter by category type based on vale type
      if (valeType === 'epp') {
        query = query.eq('categories.type', 'epp');
      }

      const { data } = await query;
      setProducts(data || []);
    };
    fetchProducts();
  }, [supabase, valeType]);

  // Filter products for display
  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (valeType === 'epp') {
      filtered = filtered.filter((p) => p.category?.type === 'epp');
    } else {
      // Material vales only see material and consumible types
      filtered = filtered.filter((p) => p.category?.type === 'material' || p.category?.type === 'consumible');
    }

    if (productSearch) {
      const search = productSearch.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.category?.name?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [products, valeType, productSearch]);

  // Filter workers
  const filteredWorkers = useMemo(() => {
    if (!workerSearch) return workers;
    const search = workerSearch.toLowerCase();
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(search) ||
        w.rut.toLowerCase().includes(search)
    );
  }, [workers, workerSearch]);

  const addToCart = (product: Product) => {
    const exists = cart.find((c) => c.product.id === product.id);
    if (exists) {
      setCart(
        cart.map((c) =>
          c.product.id === product.id
            ? { ...c, quantity: Math.min(c.quantity + 1, product.stock) }
            : c
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(
      cart
        .map((c) => {
          if (c.product.id === productId) {
            const newQty = c.quantity + delta;
            if (newQty <= 0) return null;
            return { ...c, quantity: Math.min(newQty, c.product.stock) };
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product.id !== productId));
  };

  const handleSubmit = async () => {
    if (!selectedWorker) {
      toast.error('Selecciona un trabajador');
      return;
    }
    if (cart.length === 0) {
      toast.error('Agrega al menos un ítem al vale');
      return;
    }

    setSubmitting(true);

    try {
      // Get next vale number
      const { data: lastVale } = await supabase
        .from('vales')
        .select('vale_number')
        .order('vale_number', { ascending: false })
        .limit(1)
        .single();

      const nextNumber = (lastVale?.vale_number || 2000) + 1;

      // Create vale
      const { data: vale, error: valeError } = await supabase
        .from('vales')
        .insert({
          vale_number: nextNumber,
          type: valeType,
          status: 'pendiente',
          created_by: profile!.id,
          worker_id: selectedWorker,
          notes: notes || null,
          vale_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (valeError) throw valeError;

      // Create vale items
      const items = cart.map((c) => ({
        vale_id: vale.id,
        product_id: c.product.id,
        quantity: c.quantity,
        quantity_delivered: 0,
      }));

      const { error: itemsError } = await supabase
        .from('vale_items')
        .insert(items);

      if (itemsError) throw itemsError;

      setValeNumber(nextNumber);
      setSuccess(true);
      toast.success(`Vale #${nextNumber} creado exitosamente`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error('Error al crear el vale: ' + message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-12">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto ring-1 ring-success/30">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">¡Vale Creado!</h2>
          <p className="text-muted-foreground mt-2">
            Vale <span className="font-mono text-primary font-bold">#{valeNumber}</span> creado exitosamente.
            El bodeguero lo verá en su lista de pendientes.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => {
            setSuccess(false);
            setCart([]);
            setSelectedWorker('');
            setNotes('');
            setValeNumber(null);
          }}>
            <FilePlus className="w-4 h-4 mr-2" />
            Crear otro vale
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/vales')}>
            Ver mis vales
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Vale Type */}
      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de Vale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {availableTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setValeType(type.value);
                  setCart([]);
                }}
                className={`p-4 rounded-lg border text-left transition-all ${
                  valeType === type.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border/50 hover:border-border bg-card/50'
                }`}
              >
                <p className="font-medium text-sm">{type.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Worker Selection */}
      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trabajador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o RUT..."
              className="pl-9"
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
            />
          </div>
          <div className="grid gap-2 max-h-48 overflow-y-auto">
            {filteredWorkers.map((worker) => (
              <button
                key={worker.id}
                onClick={() => setSelectedWorker(worker.id)}
                className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                  selectedWorker === worker.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border/50 hover:border-border bg-card/50'
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{worker.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {worker.rut} · {worker.area} · {worker.position}
                  </p>
                </div>
                {selectedWorker === worker.id && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
            {filteredWorkers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No se encontraron trabajadores
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Selection */}
      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ítems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              className="pl-9"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>

          {/* Product list */}
          <div className="grid gap-2 max-h-64 overflow-y-auto">
            {filteredProducts.map((product) => {
              const inCart = cart.find((c) => c.product.id === product.id);
              return (
                <div
                  key={product.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    inCart
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border/50 bg-card/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {product.stock} {product.unit}
                        {product.category && ` · ${product.category.name}`}
                      </p>
                    </div>
                  </div>

                  {inCart ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(product.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {inCart.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(product.id, 1)}
                        disabled={inCart.quantity >= product.stock}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeFromCart(product.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addToCart(product)}
                      disabled={product.stock <= 0}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Agregar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cart summary */}
          {cart.length > 0 && (
            <div className="border-t border-border/50 pt-4">
              <p className="text-sm font-medium mb-2">
                Resumen ({cart.length} {cart.length === 1 ? 'ítem' : 'ítems'})
              </p>
              <div className="space-y-1">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{item.product.name}</span>
                    <span className="font-medium">
                      x{item.quantity} {item.product.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="card-glow border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Observaciones opcionales..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !selectedWorker || cart.length === 0}
          className="min-w-[160px]"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <FilePlus className="w-4 h-4 mr-2" />
              Crear Vale
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
