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
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn('card-glow border-border/50 hover:border-primary/20 transition-colors', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
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
                  <span className="text-xs text-muted-foreground">{description}</span>
                )}
              </div>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {iconMap[icon] || <Package className="w-5 h-5" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
