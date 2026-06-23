'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import SignatureCanvas from 'react-signature-canvas';
import { Droplet, Save, Eraser, Loader2, Fuel, PenTool } from 'lucide-react';
import { toast } from 'sonner';

export default function PetroleoPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const tempSigCanvas = useRef<any>(null);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    receiver_name: '',
    receiver_rut: '',
    vehicle_type: '',
    vehicle_other_type: '',
    liters: ''
  });

  const [receptorSigData, setReceptorSigData] = useState<string | null>(null);
  const [bodegueroSigData, setBodegueroSigData] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<'receptor' | 'bodeguero' | null>(null);

  const clearSignatures = () => {
    setReceptorSigData(null);
    setBodegueroSigData(null);
  };

  const handleSaveSignature = () => {
    if (tempSigCanvas.current?.isEmpty()) {
      toast.error('Por favor, ingresa una firma antes de guardar.');
      return;
    }
    const data = tempSigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    if (activeDialog === 'receptor') setReceptorSigData(data);
    if (activeDialog === 'bodeguero') setBodegueroSigData(data);
    setActiveDialog(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!receptorSigData) {
      toast.error('Por favor, ingresa la firma del receptor.');
      return;
    }
    if (!bodegueroSigData) {
      toast.error('Por favor, ingresa la firma del bodeguero/emisor.');
      return;
    }

    setLoading(true);

    try {
      const finalVehicleType = formData.vehicle_type === 'Otro' 
        ? formData.vehicle_other_type 
        : formData.vehicle_type;

      const { error } = await supabase.from('fuel_records').insert({
        bodeguero_id: profile.id,
        receiver_name: formData.receiver_name,
        receiver_rut: formData.receiver_rut,
        vehicle_type: finalVehicleType,
        liters: parseFloat(formData.liters),
        signature_data: receptorSigData,
        bodeguero_signature_data: bodegueroSigData
      });

      if (error) throw error;

      toast.success('Carga de petróleo registrada exitosamente');
      setFormData({ receiver_name: '', receiver_rut: '', vehicle_type: '', vehicle_other_type: '', liters: '' });
      clearSignatures();

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
                    <SelectItem value="Otro">Otro equipo...</SelectItem>
                  </SelectContent>
                </Select>
                
                {formData.vehicle_type === 'Otro' && (
                  <Input
                    className="mt-2"
                    placeholder="Especifique el vehículo/máquina..."
                    value={formData.vehicle_other_type}
                    onChange={(e) => setFormData({...formData, vehicle_other_type: e.target.value})}
                    required
                  />
                )}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <Label>Firma del Receptor</Label>
                {receptorSigData ? (
                  <div className="relative border border-border rounded-lg bg-white p-2 flex justify-center items-center h-28">
                     <img src={receptorSigData} alt="Firma Receptor" className="max-h-full object-contain" />
                     <Button type="button" variant="ghost" size="icon" onClick={() => setReceptorSigData(null)} className="absolute top-1 right-1 h-8 w-8 text-destructive hover:bg-destructive/10">
                       <Eraser className="w-4 h-4" />
                     </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full h-28 border-dashed flex flex-col gap-2" onClick={() => setActiveDialog('receptor')}>
                    <PenTool className="w-6 h-6 text-muted-foreground" />
                    <span>Pulsar para Firmar</span>
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Firma del Bodeguero (Emisor)</Label>
                {bodegueroSigData ? (
                  <div className="relative border border-border rounded-lg bg-white p-2 flex justify-center items-center h-28">
                     <img src={bodegueroSigData} alt="Firma Bodeguero" className="max-h-full object-contain" />
                     <Button type="button" variant="ghost" size="icon" onClick={() => setBodegueroSigData(null)} className="absolute top-1 right-1 h-8 w-8 text-destructive hover:bg-destructive/10">
                       <Eraser className="w-4 h-4" />
                     </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full h-28 border-dashed flex flex-col gap-2" onClick={() => setActiveDialog('bodeguero')}>
                    <PenTool className="w-6 h-6 text-muted-foreground" />
                    <span>Pulsar para Firmar</span>
                  </Button>
                )}
              </div>
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

      <Dialog open={!!activeDialog} onOpenChange={(open) => {
        if (!open) setActiveDialog(null);
        // Small delay to ensure clear works after unmount
        setTimeout(() => tempSigCanvas.current?.clear(), 100);
      }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[80vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {activeDialog === 'receptor' ? 'Firma del Receptor' : 'Firma del Bodeguero'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 border-2 border-dashed border-border rounded-xl bg-white overflow-hidden my-4 relative">
             <SignatureCanvas 
               ref={tempSigCanvas} 
               penColor="black"
               canvasProps={{ className: 'w-full h-full absolute inset-0' }}
             />
             <div className="absolute inset-x-0 bottom-4 text-center pointer-events-none opacity-20 flex flex-col items-center">
                <PenTool className="w-12 h-12 mb-2" />
                <span className="text-xl font-bold uppercase tracking-widest">Dibuje su firma aquí</span>
             </div>
          </div>

          <DialogFooter className="flex flex-row justify-between items-center sm:justify-between gap-4">
            <Button type="button" variant="outline" size="lg" onClick={() => tempSigCanvas.current?.clear()}>
              <Eraser className="w-5 h-5 mr-2" /> Borrar
            </Button>
            <Button type="button" size="lg" onClick={handleSaveSignature} className="bg-primary">
              <Save className="w-5 h-5 mr-2" /> Guardar Firma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
