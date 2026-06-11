'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  FilePlus,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle,
  Package,
  ArrowRight,
  ArrowLeft,
  HardHat,
  Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import type { Worker, Product, ValeType } from '@/lib/types';

interface CartItem {
  product: Product;
  quantity: number | ''; // Permite string vacío temporalmente al borrar
}

const valeTypeOptions: { value: ValeType; label: string; description: string; icon: any }[] = [
  { value: 'material', label: 'Material / Herramientas', description: 'Tornillos, pintura, herramientas de uso, etc.', icon: Wrench },
  { value: 'epp', label: 'EPP', description: 'Elementos de Protección Personal (Requiere firma)', icon: HardHat },
];

export default function NuevoValePage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState(1);
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

  // Auto-saltar paso 1 según el rol
  useEffect(() => {
    if (profile?.role === 'prevencionista') {
      setValeType('epp');
      setStep(2);
    } else if (profile?.role === 'supervisor') {
      setValeType('material');
      setStep(2);
    }
  }, [profile?.role]);

  // Fetch workers
  useEffect(() => {
    const fetchWorkers = async () => {
      let query = supabase.from('workers').select('*').eq('active', true).order('name');
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
      let query = supabase.from('products').select('*, category:categories(*)').eq('active', true).order('name');
      if (valeType === 'epp') {
        query = query.eq('categories.type', 'epp');
      }
      const { data } = await query;
      setProducts(data || []);
    };
    fetchProducts();
  }, [supabase, valeType]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (valeType === 'epp') {
      filtered = filtered.filter((p) => p.category?.type === 'epp');
    } else {
      filtered = filtered.filter((p) => p.category?.type === 'material' || p.category?.type === 'consumible');
    }
    if (productSearch) {
      const search = productSearch.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(search) || p.category?.name?.toLowerCase().includes(search));
    }
    return filtered;
  }, [products, valeType, productSearch]);

  const filteredWorkers = useMemo(() => {
    if (!workerSearch) return workers;
    const search = workerSearch.toLowerCase();
    return workers.filter((w) => w.name.toLowerCase().includes(search) || w.rut.toLowerCase().includes(search));
  }, [workers, workerSearch]);

  const addToCart = (product: Product) => {
    const exists = cart.find((c) => c.product.id === product.id);
    if (exists) {
      setCart(cart.map((c) => c.product.id === product.id ? { ...c, quantity: Math.min((c.quantity as number) + 1, product.stock) } : c));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, val: number | '') => {
    setCart(
      cart.map((c) => {
        if (c.product.id === productId) {
          if (val === '') return { ...c, quantity: '' };
          const num = typeof val === 'string' ? parseInt(val) : val;
          if (isNaN(num) || num < 0) return { ...c, quantity: '' };
          return { ...c, quantity: Math.min(num, c.product.stock) };
        }
        return c;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product.id !== productId));
  };

  const handleSubmit = async () => {
    // Check for empty quantities before submitting
    const validCart = cart.filter(c => c.quantity !== '' && (c.quantity as number) > 0);
    if (validCart.length === 0) {
      toast.error('Agrega al menos un ítem con cantidad válida');
      return;
    }

    setSubmitting(true);
    try {
      const { data: lastVale } = await supabase.from('vales').select('vale_number').order('vale_number', { ascending: false }).limit(1).single();
      const nextNumber = (lastVale?.vale_number || 2000) + 1;

      const { data: vale, error: valeError } = await supabase.from('vales').insert({
        vale_number: nextNumber,
        type: valeType,
        status: 'pendiente',
        created_by: profile!.id,
        worker_id: selectedWorker,
        notes: notes || null,
        vale_date: new Date().toISOString(),
      }).select().single();

      if (valeError) throw valeError;

      const items = validCart.map((c) => ({
        vale_id: vale.id,
        product_id: c.product.id,
        quantity: c.quantity as number,
        quantity_delivered: 0,
      }));

      const { error: itemsError } = await supabase.from('vale_items').insert(items);
      if (itemsError) throw itemsError;

      setValeNumber(nextNumber);
      setSuccess(true);
      toast.success(`Vale #${nextNumber} creado exitosamente`);
    } catch (error: any) {
      toast.error('Error al crear el vale: ' + error.message);
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
          <h2 className="text-2xl font-bold">¡Vale Enviado!</h2>
          <p className="text-muted-foreground mt-2">
            Vale <span className="font-mono text-primary font-bold">#{valeNumber}</span> creado exitosamente.
            El bodeguero acaba de recibirlo en su pantalla.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => {
            setSuccess(false);
            setCart([]);
            setSelectedWorker('');
            setNotes('');
            setValeNumber(null);
            setStep(profile?.role === 'prevencionista' ? 2 : 1);
          }}>
            <FilePlus className="w-4 h-4 mr-2" />
            Crear otro vale
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/vales')}>
            Ir a Mis Vales
          </Button>
        </div>
      </div>
    );
  }

  // --- WIZARD RENDER ---

  const totalSteps = 4;
  const progressPercent = ((step - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2 px-1">
          <span>Paso {step} de {totalSteps}</span>
          <span>{step === 1 ? 'Tipo' : step === 2 ? 'Trabajador' : step === 3 ? 'Ítems' : 'Revisión'}</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <Card className="card-glow border-border/50 shadow-xl">
        
        {/* PASO 1: Tipo de Vale */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl text-center">¿Qué tipo de vale necesitas?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 py-4">
              {valeTypeOptions.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      setValeType(type.value);
                      setCart([]); // Reset cart on type change
                    }}
                    className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                      valeType === type.value
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                        : 'border-border/50 hover:border-primary/50 bg-card/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${valeType === type.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg">{type.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/10 p-4 bg-muted/10 sticky bottom-16 md:bottom-0 z-20 rounded-b-xl shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
              <Button variant="ghost" onClick={() => router.back()}>Cancelar</Button>
              <Button onClick={() => setStep(2)}>
                Siguiente <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* PASO 2: Seleccionar Trabajador */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl text-center">¿A quién se le entregará?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o RUT..."
                  className="pl-10 h-12 text-base"
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid gap-2 max-h-[350px] overflow-y-auto pr-1">
                {filteredWorkers.map((worker) => (
                  <button
                    key={worker.id}
                    onClick={() => setSelectedWorker(worker.id)}
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                      selectedWorker === worker.id
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                        : 'border-border/50 hover:border-primary/50 bg-card/50'
                    }`}
                  >
                    <div>
                      <p className="font-bold">{worker.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-mono">{worker.rut}</span> • {worker.area} • {worker.position}
                      </p>
                    </div>
                    {selectedWorker === worker.id && (
                      <CheckCircle className="w-6 h-6 text-primary" />
                    )}
                  </button>
                ))}
                {filteredWorkers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No se encontraron trabajadores
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/10 p-4 bg-muted/10 sticky bottom-16 md:bottom-0 z-20 rounded-b-xl shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
              <Button 
                variant="ghost" 
                onClick={() => setStep(1)} 
                disabled={profile?.role === 'prevencionista' || profile?.role === 'supervisor'}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button onClick={() => setStep(3)} disabled={!selectedWorker} className="px-8">
                Siguiente <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* PASO 3: Selección de Ítems */}
        {step === 3 && (
          <>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-center">Agrega los ítems al vale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 py-2">
              {/* Buscador */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto en bodega..."
                  className="pl-10 h-12 text-base"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              {/* Lista de Productos */}
              <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-1">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((c) => c.product.id === product.id);
                  return (
                    <div
                      key={product.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                        inCart ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-card/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Stock: {product.stock} {product.unit} {product.category && ` • ${product.category.name}`}
                          </p>
                        </div>
                      </div>

                      {inCart ? (
                        <div className="flex items-center gap-1.5 sm:ml-auto bg-background p-1 rounded-lg border shadow-sm">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive" onClick={() => removeFromCart(product.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="w-px h-5 bg-border mx-1"></div>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md" onClick={() => updateQuantity(product.id, ((inCart.quantity as number) || 0) - 1)}>
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Input
                            type="number"
                            min={0}
                            max={product.stock}
                            className="w-14 h-8 text-center px-1 py-0 font-bold border-none shadow-none focus-visible:ring-0 bg-transparent text-base"
                            value={inCart.quantity}
                            onChange={(e) => updateQuantity(product.id, e.target.value === '' ? '' : parseInt(e.target.value))}
                            onBlur={(e) => {
                                // Si queda vacío al salir, lo eliminamos o lo ponemos en 0
                                if (e.target.value === '' || e.target.value === '0') {
                                    removeFromCart(product.id);
                                }
                            }}
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md" onClick={() => updateQuantity(product.id, ((inCart.quantity as number) || 0) + 1)} disabled={(inCart.quantity as number) >= product.stock}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => addToCart(product)} disabled={product.stock <= 0} className="w-full sm:w-auto h-10 font-semibold shadow-sm">
                          <Plus className="w-4 h-4 mr-2" /> Agregar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumen del carrito flotante */}
              {cart.length > 0 && (
                <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex items-center justify-between">
                  <span className="font-medium text-sm text-primary">
                    {cart.length} {cart.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                  </span>
                  <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    {cart.reduce((acc, curr) => acc + ((curr.quantity as number) || 0), 0)} unidades
                  </span>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/10 p-4 bg-muted/10 sticky bottom-16 md:bottom-0 z-20 rounded-b-xl shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
              </Button>
              <Button onClick={() => setStep(4)} disabled={cart.length === 0} className="px-8">
                Revisar <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* PASO 4: Revisión Final */}
        {step === 4 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl text-center flex items-center justify-center gap-2">
                <CheckCircle className="w-6 h-6 text-success" /> Resumen del Vale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 py-2">
              
              {/* Info Worker */}
              <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Para el trabajador</p>
                <div className="flex justify-between items-center">
                  <p className="font-bold">{workers.find(w => w.id === selectedWorker)?.name}</p>
                  <Badge variant="outline">{valeType === 'epp' ? 'EPP' : 'Material'}</Badge>
                </div>
              </div>

              {/* Items Summary */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Ítems Solicitados</p>
                <div className="space-y-2 border rounded-xl overflow-hidden bg-card/50">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex justify-between items-center p-3 border-b last:border-0 bg-background/50">
                      <span className="text-sm font-medium">{item.product.name}</span>
                      <span className="font-bold bg-muted px-2 py-1 rounded text-sm">x{item.quantity} {item.product.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Observaciones (Opcional)</Label>
                <Textarea
                  placeholder="Instrucciones especiales, centro de costo, motivos..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none h-20"
                />
              </div>

            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 border-t border-border/10 p-4 bg-muted/10 sticky bottom-16 md:bottom-0 z-20 rounded-b-xl shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
              <Button variant="ghost" onClick={() => setStep(3)} className="w-full sm:w-auto">
                <ArrowLeft className="w-4 h-4 mr-2" /> Editar Ítems
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} size="lg" className="w-full sm:w-auto font-bold shadow-lg shadow-primary/25">
                {submitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creando...</>
                ) : (
                  <><FilePlus className="w-5 h-5 mr-2" /> Crear y Enviar a Bodega</>
                )}
              </Button>
            </CardFooter>
          </>
        )}

      </Card>
    </div>
  );
}
