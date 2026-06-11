'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';

import { HormibalLogo } from '@/components/shared/hormibal-logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

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

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0a1a 0%, #0d1b2a 30%, #0a0a1a 60%, #121212 100%)' }}
    >
      {/* Subtle yellow glow */}
      <div className="absolute -top-1/3 -left-1/4 w-[600px] h-[600px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #D4D916 0%, transparent 70%)' }}
      />
      {/* Subtle cyan glow */}
      <div className="absolute -bottom-1/3 -right-1/4 w-[600px] h-[600px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #00B4D8 0%, transparent 70%)' }}
      />
      
      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo Area */}
        <div className="text-center mb-8">
          <HormibalLogo className="w-48 h-auto mx-auto mb-2" />
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border p-6 sm:p-8 backdrop-blur-xl"
          style={{
            background: 'rgba(20, 20, 35, 0.75)',
            borderColor: 'rgba(255,255,255,0.08)',
            boxShadow: '0 0 60px rgba(0, 180, 216, 0.08), 0 0 40px rgba(212, 217, 22, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white">Sistema de Bodega</h1>
            <p className="text-sm mt-1" style={{ color: '#8899aa' }}>
              Gestión de Inventario y EPP
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium" style={{ color: '#aabbcc' }}>
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@hormibal.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 border-white/10 bg-white/5 focus:border-[#00B4D8] focus:ring-[#00B4D8]/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium" style={{ color: '#aabbcc' }}>
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 border-white/10 bg-white/5 focus:border-[#00B4D8] focus:ring-[#00B4D8]/30"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold text-black transition-all duration-300"
              disabled={loading}
              style={{
                background: loading ? '#555' : 'linear-gradient(135deg, #D4D916 0%, #00B4D8 100%)',
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-center" style={{ color: '#556677' }}>
              Acceso restringido al personal autorizado
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
