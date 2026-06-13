'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { saveSignatureRemote, getValeForSignature } from '@/app/actions/signature';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, PenTool, Trash2 } from 'lucide-react';

export default function FirmaMobilePage() {
  const params = useParams();
  const id = params.id as string;
  const sigCanvas = useRef<SignatureCanvas>(null);
  
  const [loading, setLoading] = useState(true);
  const [valeData, setValeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const res = await getValeForSignature(id);
      if (!res.success || !res.data) {
        setError('No se pudo cargar el vale. Verifica el código QR.');
      } else if (res.data.status === 'procesado') {
        setError('Este vale ya fue entregado y firmado.');
      } else {
        setValeData(res.data);
      }
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSubmit = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      alert('Por favor, dibuje su firma antes de enviar.');
      return;
    }

    setSubmitting(true);
    const signatureBase64 = sigCanvas.current.toDataURL('image/png');
    
    const res = await saveSignatureRemote(id, signatureBase64);
    
    if (res.success) {
      setSuccess(true);
    } else {
      alert('Error al guardar firma. Intente de nuevo.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h1 className="text-xl font-bold mb-2">Aviso</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-sm w-full">
          <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold">¡Firma Enviada!</h1>
          <p className="text-gray-400 text-lg">
            La firma se ha guardado correctamente.
            <br/><br/>
            Puede cerrar esta pantalla y mirar el computador del bodeguero.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col p-4 sm:p-6">
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <PenTool className="w-6 h-6 text-yellow-500" /> Confirmar Recepción
        </h1>
        <p className="text-center text-gray-400 mt-2 text-sm">Vale #{valeData?.vale_number}</p>
      </div>

      <div className="bg-[#111] rounded-2xl p-5 border border-white/10 mb-6 flex-1 max-h-[30vh] overflow-y-auto">
        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3">Trabajador</p>
        <p className="font-bold text-xl mb-4 text-white">{valeData?.worker?.name}</p>
        
        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3">Ítems a recibir</p>
        <ul className="space-y-2">
          {valeData?.items?.map((item: any, idx: number) => (
            <li key={idx} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0">
              <span className="text-gray-300">{item.product?.name}</span>
              <span className="font-bold bg-white/10 px-2 py-1 rounded text-white text-xs">x{item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 flex flex-col min-h-[300px]">
        <div className="flex justify-between items-center mb-2 px-1">
          <p className="font-bold text-sm text-yellow-500">Dibuja tu firma aquí abajo:</p>
          <button 
            onClick={() => sigCanvas.current?.clear()}
            className="text-xs text-red-400 flex items-center gap-1 bg-red-400/10 px-2 py-1 rounded hover:bg-red-400/20"
          >
            <Trash2 className="w-3 h-3" /> Limpiar
          </button>
        </div>
        <div className="bg-white rounded-2xl flex-1 overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.1)] relative touch-none border-2 border-yellow-500/30">
          <SignatureCanvas 
            ref={sigCanvas}
            canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
            backgroundColor="white"
            penColor="black"
          />
        </div>
      </div>

      <div className="mt-6 mb-4">
        <Button 
          onClick={handleSubmit} 
          disabled={submitting} 
          className="w-full h-16 text-lg font-bold bg-yellow-500 hover:bg-yellow-600 text-black rounded-2xl shadow-lg"
        >
          {submitting ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : 'Enviar Firma Segura'}
        </Button>
      </div>
    </div>
  );
}
