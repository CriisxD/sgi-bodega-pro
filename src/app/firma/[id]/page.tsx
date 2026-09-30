'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { saveSignatureRemote, getValeForSignature } from '@/app/actions/signature';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, PenTool, Trash2 } from 'lucide-react';
import { FullScreenSignatureModal } from '@/components/shared/full-screen-signature';

export default function FirmaMobilePage() {
  const params = useParams();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [valeData, setValeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isFullScreenSignatureOpen, setIsFullScreenSignatureOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getValeForSignature(id);
        if (!res.success || !res.data) {
          setError('No se pudo cargar el vale. Verifica el código QR. Detalle: ' + (res.error || ''));
        } else if (res.data.status === 'procesado') {
          setError('Este vale ya fue entregado y firmado.');
        } else {
          setValeData(res.data);
        }
      } catch (err: any) {
        setError('Error de conexión al servidor: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async () => {
    if (!signatureData) {
      alert('Por favor, dibuje su firma antes de enviar.');
      return;
    }

    setSubmitting(true);
    const res = await saveSignatureRemote(id, signatureData);
    
    if (res.success) {
      setSuccess(true);
    } else {
      alert('Error al guardar firma. Intente de nuevo.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div className="bg-card p-8 rounded-2xl shadow-sm border border-border">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Aviso</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-sm w-full">
          <div className="w-24 h-24 bg-success/15 text-success rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold">¡Firma Enviada!</h1>
          <p className="text-muted-foreground text-lg">
            La firma se ha guardado correctamente.
            <br/><br/>
            Puede cerrar esta pantalla y mirar el computador del bodeguero.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 sm:p-6">
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <PenTool className="w-6 h-6 text-primary" /> Confirmar Recepción
        </h1>
        <p className="text-center text-muted-foreground mt-2 text-sm">Vale #{valeData?.vale_number}</p>
      </div>

      <div className="brand-top-bar bg-card rounded-2xl p-5 border border-border shadow-sm mb-6 flex-1 max-h-[30vh] overflow-y-auto">
        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-3">Trabajador</p>
        <p className="font-bold text-xl mb-4 text-foreground">{valeData?.worker?.name}</p>
        
        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-3">Ítems a recibir</p>
        <ul className="space-y-2">
          {valeData?.items?.map((item: any, idx: number) => (
            <li key={idx} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
              <span className="text-foreground">{item.product?.name}</span>
              <span className="font-bold bg-accent px-2 py-1 rounded text-accent-foreground text-xs">x{item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

       <div className="flex-grow flex flex-col justify-center min-h-[200px]">
        {!signatureData ? (
          <Button
            type="button"
            onClick={() => setIsFullScreenSignatureOpen(true)}
            className="w-full h-40 border-2 border-dashed border-primary/30 hover:border-primary/60 bg-card hover:bg-accent text-muted-foreground hover:text-primary rounded-2xl flex flex-col items-center justify-center gap-3 transition-all font-semibold"
          >
            <PenTool className="w-8 h-8 animate-pulse text-primary" />
            <span className="text-base text-foreground">Presione aquí para firmar</span>
            <span className="text-xs font-normal text-muted-foreground">La pantalla se abrirá completa y de costado para firmar mejor</span>
          </Button>
        ) : (
          <div className="border border-border rounded-2xl bg-card overflow-hidden flex flex-col items-center justify-center p-6 relative">
            <div className="absolute top-2 right-2 bg-success text-success-foreground text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 select-none pointer-events-none">
              <CheckCircle className="w-3 h-3" /> Firma Capturada
            </div>
            {/* Display signature image: since it is dark ink on transparent canvas, we wrap it in a white block for clarity */}
            <div className="bg-white p-3 rounded-xl w-full max-w-[240px] h-28 flex items-center justify-center shadow-lg">
              <img src={signatureData} alt="Firma capturada" className="h-full object-contain" />
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFullScreenSignatureOpen(true)}
                className="text-xs h-9"
              >
                Volver a firmar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSignatureData(null)}
                className="text-xs h-9 text-destructive hover:bg-destructive/10"
              >
                Limpiar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 mb-4">
        <Button 
          onClick={handleSubmit} 
          disabled={submitting || !signatureData} 
          className="w-full h-16 text-lg font-bold bg-brand-gradient text-white border-0 rounded-2xl shadow-lg shadow-primary/20 hover:opacity-95"
        >
          {submitting ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : 'Enviar Firma Segura'}
        </Button>
      </div>

      <FullScreenSignatureModal
        isOpen={isFullScreenSignatureOpen}
        onClose={() => setIsFullScreenSignatureOpen(false)}
        onConfirm={(sig) => setSignatureData(sig)}
        title={`Firma de ${valeData?.worker?.name || 'Trabajador'}`}
      />
    </div>
  );
}
