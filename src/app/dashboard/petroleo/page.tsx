'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SignatureCanvas from 'react-signature-canvas';
import { Droplet, Save, Eraser, Loader2, Fuel } from 'lucide-react';
import { toast } from 'sonner';

export default function PetroleoPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const sigCanvas = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    receiver_name: '',
    receiver_rut: '',
    vehicle_type: '',
    liters: ''
  });

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (sigCanvas.current?.isEmpty()) {
      toast.error('Por favor, ingresa la firma del receptor.');
      return;
    }

    setLoading(true);

    try {
      const signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');

      const { error } = await supabase.from('fuel_records').insert({
        bodeguero_id: profile.id,
        receiver_name: formData.receiver_name,
        receiver_rut: formData.receiver_rut,
        vehicle_type: formData.vehicle_type,
        liters: parseFloat(formData.liters),
        signature_data: signatureData
      });

      if (error) throw error;

      toast.success('Carga de petróleo registrada exitosamente');
      setFormData({ receiver_name: '', receiver_rut: '', vehicle_type: '', liters: '' });
      clearSignature();

    } catch (error: any) {
      toast.error('Error al registrar carga: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Fuel className="w-6 h-6 text-warning" />
            Carga de Petróleo
          </h2>
          <p className="text-muted-foreground text-sm">
            Registro y control de combustible dispensado
          </p>
        </div>
      </div>

      <Card className="card-glow border-border/50">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receiver_name">Nombre del Receptor</Label>
                <Input
                  id="receiver_name"
                  placeholder="Ej. Juan Pérez"
                  value={formData.receiver_name}
                  onChange={(e) => setFormData({...formData, receiver_name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiver_rut">RUT del Receptor</Label>
                <Input
                  id="receiver_rut"
                  placeholder="12.345.678-9"
                  value={formData.receiver_rut}
                  onChange={(e) => setFormData({...formData, receiver_rut: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Maquinaria / Vehículo</Label>
                <Select 
                  value={formData.vehicle_type} 
                  onValueChange={(val: any) => setFormData({...formData, vehicle_type: val || ''})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Camioneta">Camioneta</SelectItem>
                    <SelectItem value="Cargador Frontal">Cargador Frontal</SelectItem>
                    <SelectItem value="Excavadora">Excavadora</SelectItem>
                    <SelectItem value="Generador">Generador</SelectItem>
                    <SelectItem value="Motoniveladora">Motoniveladora</SelectItem>
                    <SelectItem value="Otro">Otro equipo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="liters">Litros Cargados</Label>
                <div className="relative">
                  <Input
                    id="liters"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    className="pr-12"
                    value={formData.liters}
                    onChange={(e) => setFormData({...formData, liters: e.target.value})}
                    required
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                    L
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label>Firma del Receptor</Label>
                <Button type="button" variant="ghost" size="sm" onClick={clearSignature} className="h-8 px-2 text-xs">
                  <Eraser className="w-3 h-3 mr-1" />
                  Borrar
                </Button>
              </div>
              <div className="border border-border rounded-lg bg-white overflow-hidden" style={{ height: '200px' }}>
                <SignatureCanvas 
                  ref={sigCanvas} 
                  penColor="black"
                  canvasProps={{ className: 'w-full h-full' }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Por favor, firme dentro del recuadro blanco para certificar la recepción del combustible.
              </p>
            </div>

            <Button type="submit" className="w-full bg-warning hover:bg-warning/90 text-warning-foreground" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Droplet className="w-4 h-4 mr-2" />
              )}
              Registrar Carga de Petróleo
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
