'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  Wrench,
  Save
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Worker, Product, ValeType } from '@/lib/types';

interface CartItem {
  product: Product;
  quantity: number | ''; // Permite string vacío temporalmente al borrar
}

const valeTypeOptions: { value: ValeType; label: string; description: string; icon: any; roles: string[] }[] = [
  { value: 'material', label: 'Material / Herramientas', description: 'Tornillos, pintura, herramientas de uso, etc.', icon: Wrench, roles: ['admin', 'supervisor'] },
  { value: 'epp', label: 'EPP', description: 'Elementos de Protección Personal (Requiere firma)', icon: HardHat, roles: ['admin', 'prevencionista'] },
];

export default function NuevoValePage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [valeType, setValeType] = useState<ValeType>('material');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [workerSearch, setWorkerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [valeNumber, setValeNumber] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Quick Stock Adjust
  const [quickAdjustProduct, setQuickAdjustProduct] = useState<Product | null>(null);
  const [quickAdjustQty, setQuickAdjustQty] = useState<number | ''>(1);
  const [adjusting, setAdjusting] = useState(false);

  // Fast Create Worker
  const [createWorkerOpen, setCreateWorkerOpen] = useState(false);
  const [newWorkerData, setNewWorkerData] = useState({ name: '', rut: '', area: '', is_external: false, company: '' });
  const [creatingWorker, setCreatingWorker] = useState(false);

  // Add to cart modal
  const [cartModalProduct, setCartModalProduct] = useState<Product | null>(null);
  const [cartModalQty, setCartModalQty] = useState<number | ''>(1);

  const scrollToTop = () => {
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

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
      let query = supabase.from('products').select('*, category:categories(*)').eq('active', true).gt('stock', 0).order('name');
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
      filtered = filtered.filter((p) => p.category?.type?.toLowerCase() === 'epp');
    } else {
      filtered = filtered.filter((p) => p.category?.type?.toLowerCase() !== 'epp');
    }
    if (productSearch) {
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const searchTerms = normalize(productSearch)
        .replace(/s\b/g, '') // remove trailing 's' for simple singularization (discos -> disco)
        .split(' ')
        .filter(t => t.length > 0 && !['de', 'el', 'la', 'los', 'las', 'y', 'o', 'en'].includes(t));

      filtered = filtered.filter((p) => {
        const textToSearch = normalize(p.name) + ' ' + normalize(p.category?.name || '');
        return searchTerms.every(term => textToSearch.includes(term));
      });
    }
    return filtered;
  }, [products, valeType, productSearch]);

  const filteredWorkers = useMemo(() => {
    if (!workerSearch) return workers;
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const searchTerms = normalize(workerSearch).split(' ').filter(t => t.length > 0);
    return workers.filter((w) => {
      const textToSearch = normalize(w.name) + ' ' + normalize(w.rut);
      return searchTerms.every(term => textToSearch.includes(term));
    });
  }, [workers, workerSearch]);

  const handleCreateWorker = async () => {
    if (!newWorkerData.name) return toast.error('El nombre es obligatorio');
    if (newWorkerData.is_external && !newWorkerData.company) return toast.error('La empresa es obligatoria para externos');
    setCreatingWorker(true);

    // Asignar RUT temporal si está vacío
    const rutToSave = newWorkerData.rut.trim() || `TEMP-${Math.floor(Math.random() * 16777215).toString(16).padEnd(6, '0').toUpperCase()}`;

    try {
      const { data, error } = await supabase.from('workers').insert({
        name: newWorkerData.name,
        rut: rutToSave,
        area: newWorkerData.is_external ? 'Externo' : (newWorkerData.area || 'General'),
        position: newWorkerData.is_external ? 'Contratista/Visita' : 'Operador',
        is_external: newWorkerData.is_external,
        company: newWorkerData.is_external ? newWorkerData.company : null,
        active: true
      }).select().single();
      
      if (error) throw error;
      
      setWorkers([...workers, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedWorkers([...selectedWorkers, data.id]);
      setCreateWorkerOpen(false);
      setNewWorkerData({ name: '', rut: '', area: '', is_external: false, company: '' });
      toast.success('Trabajador creado y seleccionado');
    } catch (e: any) {
      toast.error('Error al crear trabajador: ' + e.message);
    } finally {
      setCreatingWorker(false);
    }
  };

  const handleAddToCartConfirm = () => {
    if (!cartModalProduct) return;
    const qty = typeof cartModalQty === 'string' ? parseInt(cartModalQty) || 1 : cartModalQty;
    if (qty <= 0) return;
    
    const exists = cart.find((c) => c.product.id === cartModalProduct.id);
    if (exists) {
      setCart(cart.map((c) => c.product.id === cartModalProduct.id ? { ...c, quantity: Math.min((c.quantity as number) + qty, cartModalProduct.stock) } : c));
    } else {
      setCart([...cart, { product: cartModalProduct, quantity: Math.min(qty, cartModalProduct.stock) }]);
    }
    setCartModalProduct(null);
    setCartModalQty(1);
    setProductSearch('');
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

  const handleQuickAdjust = async () => {
    if (!quickAdjustProduct || quickAdjustQty === '' || quickAdjustQty <= 0) return;
    setAdjusting(true);
    try {
      const { error } = await supabase.rpc('increase_stock', {
        p_product_id: quickAdjustProduct.id,
        p_quantity: quickAdjustQty
      });
      if (error) {
        await supabase.from('products').update({ stock: quickAdjustProduct.stock + quickAdjustQty }).eq('id', quickAdjustProduct.id);
      }
      await supabase.from('stock_movements').insert({
        product_id: quickAdjustProduct.id,
        type: 'entrada',
        quantity: quickAdjustQty,
        reference_type: 'ajuste_manual',
        notes: 'Ingreso rápido desde creación de vale',
        created_by: profile?.id
      });
      
      setProducts(products.map(p => p.id === quickAdjustProduct.id ? { ...p, stock: p.stock + quickAdjustQty } : p));
      toast.success(`Stock aumentado en ${quickAdjustQty}`);
      setQuickAdjustProduct(null);
      setQuickAdjustQty(1);
    } catch (e: any) {
      toast.error('Error al ajustar stock: ' + e.message);
    } finally {
      setAdjusting(false);
    }
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
      // RPC en vez de max(vale_number) local: con RLS el supervisor solo ve los vales de su área
      const { data: firstNumber, error: numberError } = await supabase.rpc('next_vale_number');
      if (numberError) throw numberError;
      let nextNumber = (firstNumber as number) - 1;

      for (const workerId of selectedWorkers) {
        nextNumber++;

        const { data: vale, error: valeError } = await supabase.from('vales').insert({
          vale_number: nextNumber,
          type: valeType,
          status: 'pendiente',
          created_by: profile!.id,
          worker_id: workerId,
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
      }

      setValeNumber(nextNumber); // guardamos el ultimo para la interfaz
      setSuccess(true);
      toast.success(selectedWorkers.length > 1 ? `Se crearon ${selectedWorkers.length} vales exitosamente` : `Vale #${nextNumber} creado exitosamente`);
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
            {selectedWorkers.length > 1 ? (
              <>Se crearon <span className="font-mono text-primary font-bold">{selectedWorkers.length} vales</span> exitosamente.</>
            ) : (
              <>Vale <span className="font-mono text-primary font-bold">#{valeNumber}</span> creado exitosamente.</>
            )}
            El bodeguero acaba de recibirlos en su pantalla.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => {
            setSuccess(false);
            setCart([]);
            setSelectedWorkers([]);
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
    <div className="max-w-xl mx-auto min-h-[calc(100dvh-8rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
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

      <Card ref={cardRef} className="card-glow border-border/50 shadow-xl flex-1 flex flex-col min-h-0">
        
        {/* PASO 1: Tipo de Vale */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl text-center">¿Qué tipo de vale necesitas?</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 py-4 border-t border-border/10 flex-1 overflow-y-auto">
              {valeTypeOptions.filter(t => t.roles.includes(profile?.role || '')).map((type) => {
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
            <CardFooter className="flex flex-col-reverse sm:flex-row justify-between gap-3 border-t border-border/10 pt-4 px-4 pb-4 sm:px-6 sm:pb-6 bg-muted/5 shrink-0">
              <Button variant="ghost" onClick={() => router.back()} className="w-full sm:w-auto h-12 sm:h-10 text-base">
                Cancelar
              </Button>
              <Button onClick={() => setStep(2)} className="w-full sm:w-auto h-12 sm:h-10 text-base shadow-lg shadow-primary/25">
                Siguiente <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* PASO 2: Seleccionar Trabajador */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle className="text-xl text-center">¿A quién se le entregará?</CardTitle>
              <p className="text-center text-sm text-muted-foreground">Puedes seleccionar varios para un vale grupal</p>
            </CardHeader>
            <CardContent className="space-y-4 py-4 border-t border-border/10 flex-1 flex flex-col min-h-0">
              {/* Chips de Trabajadores Seleccionados */}
              {selectedWorkers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 shrink-0">
                  {selectedWorkers.map(id => {
                    const w = workers.find(work => work.id === id);
                    if (!w) return null;
                    return (
                      <div key={id} className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 text-sm font-medium">
                        {w.name.split(' ')[0]} {w.name.split(' ').length > 1 ? w.name.split(' ')[1][0] + '.' : ''}
                        <button 
                          onClick={() => setSelectedWorkers(selectedWorkers.filter(wId => wId !== id))}
                          className="ml-1 hover:text-destructive transition-colors focus:outline-none"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o RUT..."
                    className="pl-10 h-12 text-base rounded-xl shadow-inner bg-background/50 focus-visible:ring-primary/50"
                    value={workerSearch}
                    onChange={(e) => setWorkerSearch(e.target.value)}
                    onBlur={scrollToTop}
                    autoFocus
                  />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-12 px-3 sm:px-4 rounded-xl flex items-center justify-center border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-colors whitespace-nowrap"
                  onClick={() => setCreateWorkerOpen(true)}
                >
                  <Plus className="w-5 h-5 sm:mr-2 text-primary" />
                  <span className="hidden sm:inline font-medium">Nuevo</span>
                </Button>
              </div>

              <div className="grid gap-3 flex-1 overflow-y-auto pr-1 pb-2">
                {workerSearch.trim() === '' && (
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mt-1">Sugerencias (Busca para ver más)</p>
                )}
                {(() => {
                  const list = workerSearch.trim() === '' ? workers.slice(0, 3) : filteredWorkers;
                  return list.length > 0 ? (
                    list.map((worker) => (
                      <button
                        key={worker.id}
                        onClick={() => {
                          if (selectedWorkers.includes(worker.id)) {
                            setSelectedWorkers(selectedWorkers.filter(id => id !== worker.id));
                          } else {
                            setSelectedWorkers([...selectedWorkers, worker.id]);
                            setWorkerSearch(''); // Limpiar búsqueda al seleccionar
                          }
                        }}
                        className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                          selectedWorkers.includes(worker.id)
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'border-border/50 hover:border-primary/50 bg-card/50'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-foreground">
                            {worker.name}
                            {worker.is_external && <Badge variant="secondary" className="ml-2 text-[10px] py-0 bg-amber-500/20 text-amber-600 border-amber-500/30">Externo</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-mono">{worker.rut}</span> • {worker.is_external ? worker.company : worker.area} • {worker.position}
                          </p>
                        </div>
                        {selectedWorkers.includes(worker.id) && (
                          <CheckCircle className="w-6 h-6 text-primary" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No se encontraron trabajadores
                    </div>
                  );
                })()}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col-reverse sm:flex-row justify-between gap-3 border-t border-border/10 pt-4 px-4 pb-4 sm:px-6 sm:pb-6 bg-muted/5 shrink-0">
              <Button 
                variant="ghost" 
                onClick={() => {
                  if (profile?.role === 'prevencionista' || profile?.role === 'supervisor') {
                    router.push('/dashboard');
                  } else {
                    setStep(1);
                  }
                }} 
                className="w-full sm:w-auto h-12 sm:h-10 text-base"
              >
                <ArrowLeft className="w-5 h-5 mr-2" /> Atrás
              </Button>
              <Button onClick={() => setStep(3)} disabled={selectedWorkers.length === 0} className="w-full sm:w-auto h-12 sm:h-10 text-base shadow-lg shadow-primary/25">
                Siguiente <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardFooter>
          </>
        )}

        {/* PASO 3: Selección de Ítems */}
        {step === 3 && (
          <>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-center">
                {profile?.role === 'prevencionista' ? 'Agrega el EPP al vale' : profile?.role === 'supervisor' ? 'Agrega los materiales al vale' : 'Agrega los ítems al vale'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 py-4 border-t border-border/10 flex-1 flex flex-col min-h-0">
              
              {/* Buscador */}
              <div className="relative mb-2 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto en bodega..."
                  className="pl-10 h-12 text-base rounded-xl shadow-inner bg-background/50 focus-visible:ring-primary/50"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onBlur={scrollToTop}
                  autoFocus
                />
              </div>

              {/* Lista de Productos o Resumen del Carrito */}
              <div className="flex-1 overflow-y-auto pr-1 pb-2 flex flex-col gap-3">
                {productSearch.trim() === '' && cart.length > 0 ? (
                  // MOSTRAR CARRITO
                  <>
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1 mt-2 px-1">Ítems Seleccionados</h4>
                    {cart.map((c) => (
                      <div key={c.product.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                        <div className="flex-1">
                          <p className="font-semibold text-sm leading-tight">{c.product.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {c.quantity} {c.product.unit} seleccionados
                          </p>
                        </div>
                        <div className="flex items-center gap-1 bg-background rounded-lg border p-1 shadow-sm shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md hover:bg-destructive/10 hover:text-destructive" onClick={() => updateQuantity(c.product.id, ((c.quantity as number) || 0) - 1)}>
                            {c.quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          </Button>
                          <span className="w-8 text-center font-bold">{c.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md" onClick={() => updateQuantity(c.product.id, ((c.quantity as number) || 0) + 1)} disabled={(c.quantity as number) >= c.product.stock}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  // MOSTRAR RESULTADOS DE BÚSQUEDA O SUGERENCIAS
                  <>
                    {productSearch.trim() === '' && (
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mt-1">Sugerencias (Busca para ver más)</p>
                    )}
                    {(() => {
                      const list = productSearch.trim() === '' ? products.filter(p => p.stock > 0).slice(0, 3) : filteredProducts;
                      return list.length > 0 ? (
                        list.map((product) => {
                          const inCart = cart.find((c) => c.product.id === product.id);
                          return (
                            <button
                              key={product.id}
                              onClick={() => {
                                if (product.stock > 0) {
                                  if (inCart) {
                                    if ((inCart.quantity as number) < product.stock) {
                                      updateQuantity(product.id, ((inCart.quantity as number) || 0) + 1);
                                    }
                                  } else {
                                    setCart([...cart, { product, quantity: 1 }]);
                                  }
                                }
                              }}
                              disabled={product.stock <= 0}
                              className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-all ${
                                inCart ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:border-primary/50 bg-card/50'
                              } ${product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Package className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-semibold text-sm leading-tight text-foreground">{product.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Stock: {product.stock} {product.unit} {product.category && ` • ${product.category.name}`}
                                  </p>
                                </div>
                              </div>

                              {inCart ? (
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">
                                  {inCart.quantity}
                                </div>
                              ) : (
                                <Plus className="w-5 h-5 text-muted-foreground shrink-0" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No se encontraron productos
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col-reverse sm:flex-row justify-between gap-3 border-t border-border/10 pt-4 px-4 pb-4 sm:px-6 sm:pb-6 bg-muted/5 shrink-0">
              <Button variant="ghost" onClick={() => setStep(2)} className="w-full sm:w-auto h-12 sm:h-10 text-base">
                <ArrowLeft className="w-5 h-5 mr-2" /> Atrás
              </Button>
              <Button onClick={() => setStep(4)} disabled={cart.length === 0} className="w-full sm:w-auto h-12 sm:h-10 text-base shadow-lg shadow-primary/25">
                Revisar <ArrowRight className="w-5 h-5 ml-2" />
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
            <CardContent className="space-y-6 pt-4 flex-1 overflow-y-auto border-t border-border/10 mt-2 bg-muted/10">
              
              <div className="bg-background border border-border/50 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                {/* Estilo Ticket */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50"></div>
                <div className="absolute -left-3 top-1/2 w-6 h-6 bg-muted/10 rounded-full border border-border/50"></div>
                <div className="absolute -right-3 top-1/2 w-6 h-6 bg-muted/10 rounded-full border border-border/50"></div>
                
                {/* Info Worker */}
                <div className="mb-6">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Entregar a</p>
                  <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl">
                    <div className="flex flex-col">
                      <span className="font-bold text-base text-primary">
                        {selectedWorkers.length} {selectedWorkers.length === 1 ? 'persona seleccionada' : 'personas seleccionadas'}
                      </span>
                    </div>
                    <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">{valeType === 'epp' ? 'EPP' : 'Material'}</Badge>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="mb-6 relative">
                  <div className="absolute -left-5 w-[calc(100%+2.5rem)] border-t-2 border-dashed border-border/50 my-4"></div>
                  <div className="pt-8">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-3">Ítems Solicitados</p>
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex justify-between items-start gap-4">
                          <span className="text-sm font-semibold text-foreground/90 leading-tight flex-1">{item.product.name}</span>
                          <span className="font-bold text-lg text-primary whitespace-nowrap">x{item.quantity} <span className="text-sm text-muted-foreground font-medium">{item.product.unit}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2 block">Observaciones (Opcional)</Label>
                  <Textarea
                    placeholder="Instrucciones especiales, centro de costo, motivos..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="resize-none h-20 bg-background/50 border-border/50 focus-visible:ring-primary/30 rounded-xl"
                  />
                </div>
              </div>

            </CardContent>
            <CardFooter className="flex flex-col-reverse sm:flex-row justify-between gap-3 border-t border-border/10 pt-4 px-4 pb-4 sm:px-6 sm:pb-6 bg-muted/5 shrink-0">
              <Button variant="ghost" onClick={() => setStep(3)} className="w-full sm:w-auto h-14 sm:h-12 text-base font-medium">
                <ArrowLeft className="w-5 h-5 mr-2" /> Editar Ítems
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={submitting} 
                size="lg" 
                className="w-full sm:w-auto h-14 sm:h-12 font-bold text-lg shadow-lg shadow-emerald-500/25 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
              >
                {submitting ? (
                  <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Procesando...</>
                ) : (
                  <><CheckCircle className="w-6 h-6 mr-2" /> Procesar Vale</>
                )}
              </Button>
            </CardFooter>
          </>
        )}

      </Card>

      {/* Quick Adjust Stock Dialog */}
      <Dialog open={!!quickAdjustProduct} onOpenChange={(open) => !open && setQuickAdjustProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Añadir Stock Rápido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm font-semibold">{quickAdjustProduct?.name}</p>
            <p className="text-sm text-muted-foreground -mt-3">Stock actual: {quickAdjustProduct?.stock} {quickAdjustProduct?.unit}</p>
            
            <div className="space-y-2 mt-2">
              <Label>Cantidad a ingresar</Label>
              <Input 
                type="number" 
                min={1} 
                value={quickAdjustQty} 
                onChange={e => setQuickAdjustQty(e.target.value === '' ? '' : parseInt(e.target.value))} 
                className="text-lg font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAdjustProduct(null)}>Cancelar</Button>
            <Button onClick={handleQuickAdjust} disabled={adjusting || quickAdjustQty === '' || quickAdjustQty <= 0}>
              {adjusting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fast Create Worker Dialog */}
      <Dialog open={createWorkerOpen} onOpenChange={setCreateWorkerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Trabajador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input 
                value={newWorkerData.name} 
                onChange={e => setNewWorkerData({...newWorkerData, name: e.target.value})} 
                placeholder="Ej. Juan Pérez" 
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>RUT</Label>
              <Input 
                value={newWorkerData.rut} 
                onChange={e => setNewWorkerData({...newWorkerData, rut: e.target.value})} 
                placeholder="12.345.678-9" 
              />
            </div>
            <div className="flex items-center space-x-2 py-2">
              <input 
                type="checkbox"
                id="isExternalFast" 
                checked={newWorkerData.is_external} 
                onChange={(e) => setNewWorkerData({...newWorkerData, is_external: e.target.checked})} 
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="isExternalFast" className="cursor-pointer text-amber-500">Es personal externo / contratista</Label>
            </div>
            {!newWorkerData.is_external ? (
              <div className="space-y-2">
                <Label>Área / Especialidad</Label>
                <Input 
                  value={newWorkerData.area} 
                  onChange={e => setNewWorkerData({...newWorkerData, area: e.target.value})} 
                  placeholder="Ej. Carpintería, Maestranza..." 
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Empresa Externa</Label>
                <Input 
                  value={newWorkerData.company} 
                  onChange={e => setNewWorkerData({...newWorkerData, company: e.target.value})} 
                  placeholder="Ej. Contratistas XYZ SpA" 
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWorkerOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateWorker} disabled={creatingWorker}>
              {creatingWorker ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Cart Modal */}
      <Dialog open={!!cartModalProduct} onOpenChange={(open) => !open && setCartModalProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Añadir al Vale</DialogTitle>
          </DialogHeader>
          {cartModalProduct && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">{cartModalProduct.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Stock disponible: {cartModalProduct.stock} {cartModalProduct.unit}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base">Cantidad a entregar</Label>
                <div className="flex items-center justify-center gap-4">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    className="h-16 w-16 rounded-2xl"
                    onClick={() => setCartModalQty(Math.max(1, (typeof cartModalQty === 'string' ? 1 : cartModalQty) - 1))}
                  >
                    <Minus className="w-6 h-6" />
                  </Button>
                  <Input 
                    type="number"
                    min={1}
                    max={cartModalProduct.stock}
                    className="h-16 w-32 text-center text-3xl font-bold rounded-2xl border-2 focus-visible:ring-primary/50"
                    value={cartModalQty}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value);
                      if (typeof val === 'number' && val > cartModalProduct.stock) {
                        setCartModalQty(cartModalProduct.stock);
                      } else {
                        setCartModalQty(val);
                      }
                    }}
                    autoFocus
                  />
                  <Button 
                    type="button"
                    variant="outline" 
                    size="icon"
                    className="h-16 w-16 rounded-2xl"
                    onClick={() => setCartModalQty(Math.min(cartModalProduct.stock, (typeof cartModalQty === 'string' ? 1 : cartModalQty) + 1))}
                    disabled={(typeof cartModalQty === 'number' ? cartModalQty : 1) >= cartModalProduct.stock}
                  >
                    <Plus className="w-6 h-6" />
                  </Button>
                </div>

                {/* Botones rápidos */}
                <div className="flex gap-2 justify-center pt-2">
                  {[1, 5, 10, 50].map((num) => (
                    <Button
                      key={num}
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      disabled={num > cartModalProduct.stock}
                      onClick={() => setCartModalQty(num)}
                    >
                      +{num}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="ghost" className="w-full sm:w-auto h-12" onClick={() => setCartModalProduct(null)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto h-12 text-base shadow-lg shadow-primary/25" onClick={handleAddToCartConfirm} disabled={!cartModalQty || cartModalQty <= 0}>
              <CheckCircle className="w-5 h-5 mr-2" /> Añadir al Vale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
