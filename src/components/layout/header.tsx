'use client';

import { useAuth } from '@/lib/supabase/auth-context';
import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationsMenu } from './notifications-menu';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/vales': 'Mis Vales',
  '/dashboard/vales/nuevo': 'Nuevo Vale',
  '/dashboard/despacho': 'Despacho',
  '/dashboard/devoluciones': 'Devoluciones',
  '/dashboard/stock': 'Stock',
  '/dashboard/recepciones': 'Recepciones',
  '/dashboard/epp': 'EPP',
  '/dashboard/trabajadores': 'Trabajadores',
  '/dashboard/productos': 'Productos',
  '/dashboard/reportes': 'Reportes',
};

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { profile } = useAuth();
  const pathname = usePathname();

  const title = pageTitles[pathname] || 'SGI Bodega';

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border/50 bg-background/80 backdrop-blur-lg flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {profile?.area && (
            <p className="text-xs text-muted-foreground -mt-0.5">
              Área: {profile.area}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsMenu />
      </div>
    </header>
  );
}
