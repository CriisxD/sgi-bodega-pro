'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, RotateCcw, Check, PenTool } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullScreenSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signatureBase64: string) => void;
  title?: string;
}

export function FullScreenSignatureModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Firma del Trabajador',
}: FullScreenSignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRotated, setIsRotated] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Detect if screen is portrait (needs rotation) or already landscape
  useEffect(() => {
    if (!isOpen) return;

    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsRotated(isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, [isOpen]);

  // Handle canvas sizing and setup
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      
      canvas.width = width * ratio;
      canvas.height = height * ratio;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#0F172A'; // Slate-900 for high-contrast signatures
      }
      setHasDrawn(false);
    };

    // Delay resize slightly to ensure container layout has settled
    const timer = setTimeout(resizeCanvas, 100);
    window.addEventListener('resize', resizeCanvas);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isOpen, isRotated]);

  if (!isOpen) return null;

  // Drawing event handlers mapping touch coordinates
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    if (isRotated) {
      // Landscape X (left to right) corresponds to screen Y (top to bottom)
      // Landscape Y (top to bottom) corresponds to screen X (right to left)
      const localX = clientY - rect.top;
      const localY = rect.right - clientX;
      return { x: localX, y: localY };
    } else {
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      return { x: localX, y: localY };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      setIsDrawing(true);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      setHasDrawn(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    // The signature image data is in landscape format naturally due to our setup.
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#090D16] select-none touch-none">
      <div
        ref={containerRef}
        className={cn(
          "flex flex-col bg-[#090D16] p-6 text-white overflow-hidden",
          isRotated 
            ? "fixed top-0 left-0 w-[100vh] h-[100vw] transform rotate-90 origin-top-left ml-[100vw]" 
            : "w-full h-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base tracking-wide">{title}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawing Area */}
        <div className="flex-1 flex flex-col relative min-h-0 bg-white rounded-2xl border border-slate-700/30 p-2 overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full cursor-crosshair rounded-xl bg-white"
          />

          {/* Guide Line & Label */}
          {!hasDrawn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-slate-400">
              <span className="text-sm tracking-widest font-semibold uppercase animate-pulse">FIRME AQUÍ</span>
              <div className="w-48 h-[1px] bg-slate-300 mt-2" />
            </div>
          )}
        </div>

        {/* Action Controls - Always aligned at the bottom of the landscape view */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800 shrink-0 gap-4">
          <div className="text-xs text-slate-400 max-w-[50%]">
            Sostenga el dispositivo de costado si es necesario para firmar con comodidad.
          </div>
          <div className="flex gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={clearCanvas}
              disabled={!hasDrawn}
              className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Limpiar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!hasDrawn}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/10"
            >
              <Check className="w-4 h-4 mr-1.5" />
              Confirmar Firma
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
