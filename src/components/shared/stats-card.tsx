import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  FileText,
  Package,
  AlertTriangle,
  HardHat,
  TrendingUp,
  TrendingDown,
  Users,
  PackageCheck,
  Undo2,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  'file-text': <FileText className="w-5 h-5" />,
  'package': <Package className="w-5 h-5" />,
  'alert-triangle': <AlertTriangle className="w-5 h-5" />,
  'hard-hat': <HardHat className="w-5 h-5" />,
  'users': <Users className="w-5 h-5" />,
  'package-check': <PackageCheck className="w-5 h-5" />,
  'undo': <Undo2 className="w-5 h-5" />,
};

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  variant?: 'default' | 'critical' | 'warning';
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  variant = 'default',
  className,
}: StatsCardProps) {
  const isCritical = variant === 'critical';
  const isWarning = variant === 'warning';

  return (
    <Card 
      className={cn(
        'card-glow transition-colors',
        isCritical 
          ? 'bg-destructive/10 border-destructive/30 hover:border-destructive/50' 
          : isWarning
          ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
          : 'bg-card border-border/50 hover:border-primary/20',
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className={cn(
              "text-sm font-medium",
              isCritical ? "text-destructive" : isWarning ? "text-amber-500" : "text-muted-foreground"
            )}>
              {title}
            </p>
            <p className={cn(
              "text-3xl font-bold tracking-tight",
              isCritical ? "text-destructive drop-shadow-sm" : isWarning ? "text-amber-500" : "text-foreground"
            )}>
              {value}
            </p>
            {(description || trendValue) && (
              <div className="flex items-center gap-1.5">
                {trend && trendValue && (
                  <span
                    className={cn(
                      'flex items-center gap-0.5 text-xs font-medium',
                      trend === 'up' && 'text-success',
                      trend === 'down' && 'text-destructive'
                    )}
                  >
                    {trend === 'up' ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {trendValue}
                  </span>
                )}
                {description && (
                  <span className={cn(
                    "text-xs",
                    isCritical ? "text-destructive/80" : isWarning ? "text-amber-500/80" : "text-muted-foreground"
                  )}>
                    {description}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            isCritical ? "bg-destructive/20 text-destructive" : isWarning ? "bg-amber-500/20 text-amber-500" : "bg-primary/10 text-primary"
          )}>
            {iconMap[icon] || <Package className="w-5 h-5" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
