'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { HormibalLogo } from '@/components/shared/hormibal-logo';

const REMEMBER_KEY = 'sgi-remembered-email';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const rememberRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    try {
      // Se aplica tras montar (localStorage no existe en el render del servidor)
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved && rememberRef.current) {
        rememberRef.current.checked = true;
        queueMicrotask(() => setEmail(saved));
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
      return;
    }

    try {
      if (rememberRef.current?.checked) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {}

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      {/* Manchas suaves azul/turquesa */}
      <div className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgb(59 142 219 / 0.16) 0%, transparent 70%)' }}
      />
      <div className="absolute top-1/3 -left-24 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgb(56 188 196 / 0.10) 0%, transparent 70%)' }}
      />
      <div className="absolute -bottom-40 -right-40 w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgb(214 218 74 / 0.12) 0%, transparent 70%)' }}
      />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 relative z-10">
        {/* Logo */}
        <HormibalLogo className="mb-10" />

        {/* Tarjeta de login */}
        <div className="brand-top-bar w-full max-w-sm rounded-2xl border border-border bg-card px-6 pt-8 pb-6 sm:px-8"
          style={{ boxShadow: '0 1px 2px rgb(27 42 74 / 0.04), 0 16px 40px rgb(27 42 74 / 0.08)' }}
        >
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Terminal Operativo
            </span>
            <h1 className="mt-3 text-xl font-bold text-foreground">Sistema de Bodega</h1>
            <p className="text-xs mt-1 text-muted-foreground">Gestión de Inventario y EPP</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@hormibal.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10 pl-9 bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                  Contraseña
                </Label>
                <button
                  type="button"
                  onClick={() => toast.info('Contacta a un administrador del sistema para restablecer tu contraseña.')}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10 pl-9 pr-10 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                ref={rememberRef}
                className="w-3.5 h-3.5 rounded border-input accent-primary"
              />
              Recordar correo
            </label>

            <Button
              type="submit"
              className="bg-brand-gradient w-full h-11 font-semibold text-white border-0 shadow-md shadow-primary/20 hover:opacity-95 transition-opacity"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ingresando...
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Acceso restringido al personal autorizado
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          HORMIBAL S.A. © {new Date().getFullYear()} Todos los derechos reservados.
        </span>
        <span>Sistema de Bodega · Gestión de Inventario y EPP</span>
      </footer>
    </div>
  );
}
