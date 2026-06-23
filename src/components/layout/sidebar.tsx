'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  PackageCheck,
  Package,
  HardHat,
  Users,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  Undo2,
  Shield,
  Zap,
  Fuel,
  PenLine,
} from 'lucide-react';
import { HormibalLogo } from '@/components/shared/hormibal-logo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  // --- Todos ---
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ['admin', 'bodeguero', 'supervisor', 'prevencionista'],
  },
  // --- Flujo de Vales (Supervisores crean, Admin supervisa) ---
  {
    title: 'Nuevo Vale',
    href: '/dashboard/vales/nuevo',
    icon: <FilePlus className="w-5 h-5" />,
    roles: ['admin', 'supervisor', 'prevencionista'],
  },
  {
    title: 'Vales',
    href: '/dashboard/vales',
    icon: <FileText className="w-5 h-5" />,
    roles: ['admin', 'supervisor', 'prevencionista'],
  },
  // --- Operaciones de Bodega (Bodeguero opera, Admin supervisa) ---
  {
    title: 'Digitar Vale',
    href: '/dashboard/vales/fisico',
    icon: <PenLine className="w-5 h-5" />,
    roles: ['bodeguero'],
  },
  {
    title: 'Despacho',
    href: '/dashboard/despacho',
    icon: <PackageCheck className="w-5 h-5" />,
    roles: ['admin', 'bodeguero'],
  },
  {
    title: 'Préstamos',
    href: '/dashboard/devoluciones',
    icon: <Undo2 className="w-5 h-5" />,
    roles: ['admin', 'bodeguero'],
  },
  {
    title: 'Stock',
    href: '/dashboard/stock',
    icon: <Package className="w-5 h-5" />,
    roles: ['admin', 'bodeguero', 'supervisor', 'prevencionista'],
  },
  {
    title: 'Recepciones',
    href: '/dashboard/recepciones',
    icon: <PackagePlus className="w-5 h-5" />,
    roles: ['admin', 'bodeguero'],
  },
  {
    title: 'Petróleo',
    href: '/dashboard/petroleo',
    icon: <Fuel className="w-5 h-5 text-warning" />,
    roles: ['admin', 'bodeguero'],
  },
  // --- Registros y Fichas ---
  {
    title: 'EPP',
    href: '/dashboard/epp',
    icon: <HardHat className="w-5 h-5" />,
    roles: ['admin', 'bodeguero', 'prevencionista'],
  },
  // --- Administración ---
  {
    title: 'Trabajadores',
    href: '/dashboard/trabajadores',
    icon: <Users className="w-5 h-5" />,
    roles: ['admin', 'bodeguero'],
  },
  {
    title: 'Productos',
    href: '/dashboard/productos',
    icon: <Package className="w-5 h-5" />,
    roles: ['admin', 'bodeguero', 'prevencionista'],
  },
  // --- Solo Admin ---
  {
    title: 'Usuarios',
    href: '/dashboard/usuarios',
    icon: <Shield className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    title: 'Reportes',
    href: '/dashboard/reportes',
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ['admin'],
  },
  {
    title: 'Impacto MVP',
    href: '/dashboard/resultados',
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    roles: ['admin'],
  },
];

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  bodeguero: 'Bodeguero',
  supervisor: 'Supervisor',
  prevencionista: 'Prevencionista',
};

const roleColors: Record<UserRole, string> = {
  admin: 'bg-chart-3/20 text-chart-3',
  bodeguero: 'bg-primary/20 text-primary',
  supervisor: 'bg-chart-2/20 text-chart-2',
  prevencionista: 'bg-chart-4/20 text-chart-4',
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const filteredItems = navItems.filter(
    (item) => profile && item.roles.includes(profile.role)
  );

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '??';

  return (
    <aside
      className={cn(
        'md:fixed md:left-0 md:top-0 md:z-40 h-[100dvh] md:h-screen flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 pb-6 md:pb-0',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <HormibalLogo className="w-8 h-8 shrink-0" withText={false} />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-[15px] tracking-widest text-sidebar-foreground leading-none mt-1">
                HORMIBAL
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filteredItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          const link = (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  onToggle();
                }
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-primary/20'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <span className={cn('shrink-0', isActive && 'text-sidebar-primary')}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={link} />
                <TooltipContent side="right" sideOffset={8}>
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      <Separator className="mx-3 bg-sidebar-border" />

      {/* User section */}
      <div className="p-3 space-y-2">
        <div className={cn('flex items-center gap-3 px-2 py-2', collapsed && 'justify-center')}>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name}
              </span>
              <span
                className={cn(
                  'text-[11px] px-1.5 py-0.5 rounded-full w-fit font-medium',
                  profile?.role && roleColors[profile.role]
                )}
              >
                {profile?.role && roleLabels[profile.role]}
              </span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className={cn(
            'w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10',
            collapsed ? 'px-0 justify-center' : 'justify-start gap-3 px-3'
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </Button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute top-20 -right-3 w-6 h-6 rounded-full border border-sidebar-border bg-sidebar flex items-center justify-center hover:bg-sidebar-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-sidebar-foreground pointer-events-none" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-sidebar-foreground pointer-events-none" />
        )}
      </button>
    </aside>
  );
}
