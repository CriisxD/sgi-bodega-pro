'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { StatsCard } from '@/components/shared/stats-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  ArrowRight,
  Plus,
  PackageCheck,
  Package,
  Undo2,
  HardHat,
  ClipboardList,
  AlertTriangle,
  ChevronRight,
  Zap,
  Search,
} from 'lucide-react';
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

/* ── Quick Action button config per role ── */
interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  gradient: string;
  badge?: number;
  badgeColor?: string;
  roles: string[];
}

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

      // JS filtering for stock <= min_stock since direct column comparison in PostgREST is tricky
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

  /* ── Build Quick Actions based on stats ── */
  const quickActions: QuickAction[] = [
    {
      label: 'Despachar Vales',
      href: '/dashboard/despacho',
      icon: <PackageCheck className="w-7 h-7" />,
      gradient: 'from-emerald-500 to-teal-600',
      badge: stats.valesPendientes,
      badgeColor: 'bg-red-500',
      roles: ['bodeguero', 'admin'],
    },
    {
      label: 'Crear Nuevo Vale',
      href: '/dashboard/vales/nuevo',
      icon: <Plus className="w-7 h-7" />,
      gradient: 'from-blue-500 to-indigo-600',
      roles: ['supervisor', 'prevencionista', 'admin'],
    },
    {
      label: 'Consultar Stock',
      href: '/dashboard/stock',
      icon: <Package className="w-7 h-7" />,
      gradient: 'from-amber-500 to-orange-600',
      badge: stats.stockBajo > 0 ? stats.stockBajo : undefined,
      badgeColor: 'bg-red-500',
      roles: ['bodeguero', 'supervisor', 'prevencionista', 'admin'],
    },
    {
      label: 'Préstamos Activos',
      href: '/dashboard/devoluciones',
      icon: <Undo2 className="w-7 h-7" />,
      gradient: 'from-violet-500 to-purple-600',
      badge: stats.devolucionesPendientes > 0 ? stats.devolucionesPendientes : undefined,
      badgeColor: 'bg-amber-500',
      roles: ['bodeguero', 'admin'],
    },
    {
      label: 'Mis Vales',
      href: '/dashboard/vales',
      icon: <ClipboardList className="w-7 h-7" />,
      gradient: 'from-sky-500 to-cyan-600',
      roles: ['supervisor', 'prevencionista'],
    },
    {
      label: 'Control EPP',
      href: '/dashboard/epp',
      icon: <HardHat className="w-7 h-7" />,
      gradient: 'from-rose-500 to-pink-600',
      roles: ['prevencionista', 'admin', 'bodeguero'],
    },
  ];

  const myActions = quickActions.filter(
    (a) => profile && a.roles.includes(profile.role)
  );

  /* ── Alert items for the compact mobile summary ── */
  const alerts: Array<{ text: string; count: number; color: string; href: string }> = [];
  if (stats.valesPendientes > 0) {
    alerts.push({
      text: 'Vales pendientes de despacho',
      count: stats.valesPendientes,
      color: 'text-amber-500',
      href: '/dashboard/despacho',
    });
  }
  if (stats.stockBajo > 0) {
    alerts.push({
      text: 'Productos con stock crítico',
      count: stats.stockBajo,
      color: 'text-red-500',
      href: '/dashboard/stock',
    });
  }
  if (stats.devolucionesPendientes > 0) {
    alerts.push({
      text: 'Préstamos activos por devolver',
      count: stats.devolucionesPendientes,
      color: 'text-violet-500',
      href: '/dashboard/devoluciones',
    });
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════
          Acción Inmediata (Hero Section)
          ═══════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider hidden sm:block">
          ¿Qué hacer hoy?
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Action Call */}
          <div className="md:col-span-2">
            <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/30 h-full overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                {profile?.role === 'bodeguero' ? <PackageCheck className="w-32 h-32" /> : <Plus className="w-32 h-32" />}
              </div>
              <CardContent className="p-6 sm:p-8 flex flex-col justify-center h-full relative z-10">
                {profile?.role === 'bodeguero' ? (
                  <>
                    <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-foreground">
                      {stats.valesPendientes > 0 ? `Tienes ${stats.valesPendientes} vales pendientes` : 'Todo al día en despacho'}
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      {stats.valesPendientes > 0 
                        ? 'Hay trabajadores esperando sus materiales. Prioriza los despachos ahora mismo.' 
                        : 'No hay vales en cola. Puedes aprovechar de revisar el stock o recepcionar mercadería.'}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {stats.valesPendientes > 0 ? (
                        <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20" onClick={() => router.push('/dashboard/despacho')}>
                          <PackageCheck className="w-5 h-5 mr-2" />
                          Despachar Vales
                        </Button>
                      ) : (
                        <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-background" onClick={() => router.push('/dashboard/stock')}>
                          <Search className="w-5 h-5 mr-2" />
                          Revisar Stock
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-foreground">
                      Solicitar Materiales
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md">
                      Crea un nuevo vale para solicitar herramientas, EPP o materiales para tu equipo de trabajo.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20" onClick={() => router.push('/dashboard/vales/nuevo')}>
                        <Plus className="w-5 h-5 mr-2" />
                        Digitar Nuevo Vale
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Alerts Summary (Desktop) */}
          <div className="hidden md:flex flex-col gap-3">
             {alerts.length > 0 ? (
               alerts.slice(0,3).map(alert => (
                 <Link key={alert.href} href={alert.href} className="flex-1">
                   <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-border/50 h-full">
                     <CardContent className="p-4 flex flex-col justify-center h-full">
                       <div className="flex items-center gap-3 mb-2">
                         <div className={`w-2 h-2 rounded-full ${alert.color.replace('text-', 'bg-')}`} />
                         <span className="text-sm font-medium leading-tight">{alert.text}</span>
                       </div>
                       <span className={`text-2xl font-bold ${alert.color}`}>{alert.count}</span>
                     </CardContent>
                   </Card>
                 </Link>
               ))
             ) : (
                <Card className="border-border/50 h-full flex flex-col items-center justify-center p-6 text-center bg-muted/20">
                  <span className="text-3xl mb-2">🎉</span>
                  <p className="text-sm text-muted-foreground font-medium">Sin alertas urgentes hoy</p>
                </Card>
             )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MOBILE: Quick Actions Grid
          Only visible < sm (640px)
          ═══════════════════════════════════════════ */}
      <div className="block sm:hidden space-y-4">
        {/* Section header */}
        <div className="flex items-center gap-2 px-1">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Acciones Rápidas
          </h3>
        </div>

        {/* Actions grid – 2 cols */}
        <div className="grid grid-cols-2 gap-3">
          {myActions.map((action, index) => {
            const isLastOdd = index === myActions.length - 1 && myActions.length % 2 !== 0;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`group relative overflow-hidden rounded-2xl p-4 flex flex-col items-center justify-center gap-3 min-h-[120px] transition-transform active:scale-95 ${
                  isLastOdd ? 'col-span-2' : ''
                }`}
              >
                {/* Gradient background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-90 group-hover:opacity-100 transition-opacity`}
                />
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />

                {/* Badge */}
                {action.badge != null && action.badge > 0 && (
                  <span
                    className={`absolute top-2 right-2 ${action.badgeColor || 'bg-red-500'} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg z-10 animate-pulse`}
                  >
                    {action.badge > 99 ? '99+' : action.badge}
                  </span>
                )}

                {/* Icon */}
                <div className="relative z-10 text-white drop-shadow-md">
                  {action.icon}
                </div>

                {/* Label */}
                <span className="relative z-10 text-white text-sm font-semibold text-center leading-tight drop-shadow-sm">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Mobile Compact Alerts ── */}
        {alerts.length > 0 && (
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Alertas
                </span>
              </div>
              {alerts.map((alert) => (
                <Link
                  key={alert.href}
                  href={alert.href}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 hover:bg-background transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full ${alert.color.replace('text-', 'bg-')} shrink-0`}
                    />
                    <span className="text-sm truncate">{alert.text}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className={`text-sm font-bold ${alert.color}`}>
                      {alert.count}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Mobile mini recent vales list (max 3) */}
        {recentVales.length > 0 && (
          <Card className="border-border/50 bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">
                Últimos Vales
              </CardTitle>
              <Link
                href={profile?.role === 'bodeguero' ? '/dashboard/despacho' : '/dashboard/vales'}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {recentVales.slice(0, 3).map((vale) => (
                <div
                  key={vale.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-background/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        Vale #{vale.vale_number}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {vale.worker?.name || 'Sin trabajador'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${
                      vale.status === 'pendiente'
                        ? 'bg-warning/15 text-warning border-warning/30'
                        : 'bg-success/15 text-success border-success/30'
                    }`}
                  >
                    {vale.status === 'pendiente' ? 'Pendiente' : 'Listo'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP: Stats Grid (hidden on mobile)
          ═══════════════════════════════════════════ */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatsCard
          title="Vales Pendientes"
          value={stats.valesPendientes}
          icon="file-text"
          description="por procesar"
          variant={stats.valesPendientes > 0 ? 'warning' : 'default'}
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
          variant={stats.stockBajo > 0 ? 'critical' : 'default'}
        />

        {/* Bodeguero and Admin see devoluciones */}
        {(profile?.role === 'bodeguero' || profile?.role === 'admin') && (
          <StatsCard
            title="Préstamos Activos"
            value={stats.devolucionesPendientes}
            icon="undo"
            description="pendientes"
            variant={stats.devolucionesPendientes > 0 ? 'warning' : 'default'}
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

      {/* ═══════════════════════════════════════════
          DESKTOP: Content Grid (hidden on mobile)
          ═══════════════════════════════════════════ */}
      <div className="hidden sm:grid lg:grid-cols-2 gap-6">
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
              <div className="text-center py-10 text-muted-foreground text-sm bg-muted/10 rounded-xl border border-dashed border-border/50">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-foreground">No hay vales recientes</p>
                <p className="text-xs mt-1">Los vales creados aparecerán aquí</p>
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
