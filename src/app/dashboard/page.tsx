'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { StatsCard } from '@/components/shared/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Clock, ArrowRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

export default function DashboardPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const router = useRouter();
  const [stats, setStats] = useState({
    valesPendientes: 0,
    valesHoy: 0,
    stockBajo: 0,
    devolucionesPendientes: 0,
    totalTrabajadores: 0,
    totalProductos: 0,
  });
  const [recentVales, setRecentVales] = useState<Array<{
    id: string;
    vale_number: number;
    type: string;
    status: string;
    created_at: string;
    worker: { name: string } | null;
  }>>([]);
  const [lowStockItems, setLowStockItems] = useState<Array<{
    id: string;
    name: string;
    stock: number;
    min_stock: number;
  }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Vales pendientes
      const { count: pendientes } = await supabase
        .from('vales')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendiente');

      // Vales hoy
      const today = new Date().toISOString().split('T')[0];
      const { count: hoy } = await supabase
        .from('vales')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // Stock bajo
      const { data: lowStock } = await supabase
        .from('products')
        .select('id, name, stock, min_stock')
        .filter('stock', 'lte', 'min_stock' as unknown as number)
        .eq('active', true)
        .order('stock', { ascending: true })
        .limit(10);

      // Use raw SQL filter for stock <= min_stock
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, stock, min_stock')
        .eq('active', true);

      const lowStockFiltered = (allProducts || []).filter(p => p.stock <= p.min_stock);

      // Devoluciones pendientes
      const { count: devoluciones } = await supabase
        .from('tool_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'activo');

      // Total trabajadores
      const { count: trabajadores } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

      // Total productos
      const { count: productos } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

      setStats({
        valesPendientes: pendientes || 0,
        valesHoy: hoy || 0,
        stockBajo: lowStockFiltered.length,
        devolucionesPendientes: devoluciones || 0,
        totalTrabajadores: trabajadores || 0,
        totalProductos: productos || 0,
      });

      setLowStockItems(lowStockFiltered.slice(0, 5));

      // Recent vales
      const { data: recent } = await supabase
        .from('vales')
        .select('id, vale_number, type, status, created_at, worker:workers(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentVales((recent || []).map(v => ({
        ...v,
        worker: Array.isArray(v.worker) ? v.worker[0] : v.worker,
      })));
    };

    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Hola, {profile?.full_name?.split(' ')[0]} 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>

        {/* Botón rápido gigante para celular */}
        <Button 
          onClick={() => router.push('/dashboard/vales/nuevo')}
          size="lg" 
          className="w-full sm:w-auto shadow-lg shadow-primary/25 font-bold h-14 sm:h-11 text-base"
        >
          <Plus className="w-6 h-6 sm:w-5 sm:h-5 mr-2" />
          Crear Nuevo Vale
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatsCard
          title="Vales Pendientes"
          value={stats.valesPendientes}
          icon="file-text"
          description="por procesar"
        />
        <StatsCard
          title="Vales Hoy"
          value={stats.valesHoy}
          icon="package-check"
          description="creados hoy"
        />
        <StatsCard
          title="Stock Bajo"
          value={stats.stockBajo}
          icon="alert-triangle"
          description="necesitan reposición"
        />
        
        {/* Bodeguero and Admin see devoluciones */}
        {(profile?.role === 'bodeguero' || profile?.role === 'admin') && (
          <StatsCard
            title="Préstamos Activos"
            value={stats.devolucionesPendientes}
            icon="undo"
            description="pendientes"
          />
        )}

        {/* Admin and Bodeguero see trabajadores */}
        {(profile?.role === 'admin' || profile?.role === 'bodeguero') && (
          <StatsCard
            title="Trabajadores"
            value={stats.totalTrabajadores}
            icon="users"
            description="activos"
          />
        )}
        
        {/* Admin also sees total products */}
        {profile?.role === 'admin' && (
          <StatsCard
            title="Total Productos"
            value={stats.totalProductos}
            icon="package"
            description="en catálogo"
          />
        )}
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Vales */}
        <Card className="card-glow border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              Últimos Vales
            </CardTitle>
            <Link
              href={profile?.role === 'bodeguero' ? '/dashboard/despacho' : '/dashboard/vales'}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentVales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No hay vales recientes</p>
              </div>
            ) : (
              recentVales.map((vale) => (
                <div
                  key={vale.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Vale #{vale.vale_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vale.worker?.name || 'Sin trabajador'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={valeTypeBadgeColors[vale.type]}
                    >
                      {valeTypeLabels[vale.type]}
                    </Badge>
                    <Badge
                      variant={vale.status === 'pendiente' ? 'outline' : 'default'}
                      className={
                        vale.status === 'pendiente'
                          ? 'bg-warning/15 text-warning border-warning/30'
                          : 'bg-success/15 text-success border-success/30'
                      }
                    >
                      <span className={`status-dot mr-1.5 ${vale.status === 'pendiente' ? 'pending' : 'active'}`} />
                      {vale.status === 'pendiente' ? 'Pendiente' : 'Procesado'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="card-glow border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              ⚠️ Stock Bajo
            </CardTitle>
            <Link
              href="/dashboard/stock"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Ver stock <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <span className="text-2xl mb-2 block">✅</span>
                <p>Todo el stock está en orden</p>
              </div>
            ) : (
              lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Mínimo: {item.min_stock}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-destructive">
                      {item.stock}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      en stock
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
