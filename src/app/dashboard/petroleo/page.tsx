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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import SignatureCanvas from 'react-signature-canvas';
import { Droplet, Save, Eraser, Loader2, Fuel, PenTool, ArrowDownToLine, ArrowUpFromLine, History, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Papa from 'papaparse';

export default function PetroleoPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const tempSigCanvas = useRef<any>(null);

  const [activeTab, setActiveTab] = useState('dispensar');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Dispensar State
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

  // Recepción State
  const [receptionData, setReceptionData] = useState({
    liters: '',
    document_number: '',
    notes: ''
  });

  // Data
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [fuelReceptions, setFuelReceptions] = useState<any[]>([]);
  const [tankStock, setTankStock] = useState<number>(0);

  // View Signature Dialog
  const [viewingSignature, setViewingSignature] = useState<string | null>(null);

  const fetchData = async () => {
    setFetching(true);
    try {
      const { data: records, error: err1 } = await supabase
        .from('fuel_records')
        .select('*, bodeguero:bodeguero_id(full_name)')
        .order('created_at', { ascending: false });
      
      const { data: receptions, error: err2 } = await supabase
        .from('fuel_receptions')
        .select('*, bodeguero:bodeguero_id(full_name)')
        .order('created_at', { ascending: false });

      if (err1) throw err1;
      if (err2) throw err2;

      setFuelRecords(records || []);
      setFuelReceptions(receptions || []);

      const totalIn = (receptions || []).reduce((acc, curr) => acc + curr.liters, 0);
      const totalOut = (records || []).reduce((acc, curr) => acc + curr.liters, 0);
      setTankStock(totalIn - totalOut);
    } catch (e: any) {
      toast.error('Error al cargar historial: ' + e.message);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

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

  const handleDispense = async (e: React.FormEvent) => {
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

    const litersNum = parseFloat(formData.liters);
    if (litersNum > tankStock) {
      toast.warning(`Advertencia: Estás dispensando más litros de los que hay registrados en el estanque (${tankStock.toFixed(1)} L). Se registrará igual, pero ajusta tu estanque.`);
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
        liters: litersNum,
        signature_data: receptorSigData,
        bodeguero_signature_data: bodegueroSigData
      });

      if (error) throw error;

      toast.success('Carga de petróleo registrada exitosamente');
      setFormData({ receiver_name: '', receiver_rut: '', vehicle_type: '', vehicle_other_type: '', liters: '' });
      clearSignatures();
      fetchData();

    } catch (error: any) {
      toast.error('Error al registrar carga: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);

    try {
      const { error } = await supabase.from('fuel_receptions').insert({
        bodeguero_id: profile.id,
        liters: parseFloat(receptionData.liters),
        document_number: receptionData.document_number,
        notes: receptionData.notes
      });

      if (error) throw error;

      toast.success('Llenado de estanque registrado exitosamente');
      setReceptionData({ liters: '', document_number: '', notes: '' });
      fetchData();
      setActiveTab('historial'); // Redirect to see the new stock
    } catch (error: any) {
      toast.error('Error al registrar recepción: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    // Interleave and sort both arrays to export a combined history
    const combined = [
      ...fuelRecords.map(r => ({
        Fecha: format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
        Tipo: 'SALIDA (Dispensado)',
        Litros: -r.liters,
        Vehiculo: r.vehicle_type,
        Receptor: r.receiver_name,
        RUT: r.receiver_rut,
        Documento: '',
        Responsable_Bodega: r.bodeguero ? r.bodeguero.full_name : ''
      })),
      ...fuelReceptions.map(r => ({
        Fecha: format(new Date(r.created_at), 'dd/MM/yyyy HH:mm'),
        Tipo: 'ENTRADA (Llenado Estanque)',
        Litros: r.liters,
        Vehiculo: 'Camión Cisterna',
        Receptor: 'Estanque Principal',
        RUT: '',
        Documento: r.document_number || '',
        Responsable_Bodega: r.bodeguero ? r.bodeguero.full_name : ''
      }))
    ].sort((a, b) => new Date(b.Fecha.split(' ')[0].split('/').reverse().join('-')).getTime() - new Date(a.Fecha.split(' ')[0].split('/').reverse().join('-')).getTime());

    const csvContent = Papa.unparse(combined);
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Petroleo_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Reporte exportado exitosamente');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Fuel className="w-6 h-6 text-warning" />
            Panel de Petróleo
          </h2>
          <p className="text-muted-foreground text-sm">
            Gestión de llenado de estanque y dispensado
          </p>
        </div>
        
        <div className="bg-card border border-border/50 rounded-lg p-3 flex items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${tankStock > 500 ? 'bg-success/20 text-success' : tankStock > 100 ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}`}>
              <Droplet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Estanque Principal</p>
              <p className="text-2xl font-bold font-mono">
                {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : `${tankStock.toFixed(1)} L`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="dispensar"><ArrowUpFromLine className="w-4 h-4 mr-2" /> Dispensar</TabsTrigger>
          <TabsTrigger value="recibir"><ArrowDownToLine className="w-4 h-4 mr-2" /> Recibir Camión</TabsTrigger>
          <TabsTrigger value="historial"><History className="w-4 h-4 mr-2" /> Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="dispensar" className="mt-6">
          <Card className="card-glow border-border/50 max-w-3xl">
            <CardHeader>
              <CardTitle className="text-lg">Entregar Petróleo a Maquinaria</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDispense} className="space-y-6">
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
                    <Label htmlFor="liters">Litros a Dispensar</Label>
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
                    <ArrowUpFromLine className="w-4 h-4 mr-2" />
                  )}
                  Registrar Salida de Petróleo
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recibir" className="mt-6">
          <Card className="card-glow border-border/50 max-w-xl">
            <CardHeader>
              <CardTitle className="text-lg">Ingreso de Combustible al Estanque</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReceive} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="rec_liters">Litros Recibidos</Label>
                  <div className="relative">
                    <Input
                      id="rec_liters"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Ej. 1000"
                      className="pr-12 text-lg font-mono"
                      value={receptionData.liters}
                      onChange={(e) => setReceptionData({...receptionData, liters: e.target.value})}
                      required
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-muted-foreground font-bold">
                      L
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc_number">Nº Guía de Despacho o Factura</Label>
                  <Input
                    id="doc_number"
                    placeholder="Ej. 5984332"
                    value={receptionData.document_number}
                    onChange={(e) => setReceptionData({...receptionData, document_number: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rec_notes">Observaciones (Opcional)</Label>
                  <Input
                    id="rec_notes"
                    placeholder="Ej. Camión Copec patente AB-CD-12"
                    value={receptionData.notes}
                    onChange={(e) => setReceptionData({...receptionData, notes: e.target.value})}
                  />
                </div>

                <Button type="submit" className="w-full bg-success hover:bg-success/90 text-success-foreground" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="w-4 h-4 mr-2" />
                  )}
                  Registrar Llenado de Estanque
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-6">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
              <CardTitle className="text-lg">Historial de Movimientos</CardTitle>
              {profile?.role === 'admin' && (
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-2" /> Exportar CSV
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Movimiento</TableHead>
                      <TableHead>Detalle</TableHead>
                      <TableHead className="text-right">Litros</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Combine and sort for display */}
                    {[
                      ...fuelRecords.map(r => ({ ...r, _type: 'out' })),
                      ...fuelReceptions.map(r => ({ ...r, _type: 'in' }))
                    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                     .map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(item.created_at), 'dd MMM, HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell>
                          {item._type === 'in' ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              + ENTRADA
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                              - SALIDA
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {item._type === 'in' ? (
                            <div className="text-sm">
                              <span className="font-medium">Llenado de estanque</span>
                              <div className="text-muted-foreground text-xs">Doc: {item.document_number}</div>
                            </div>
                          ) : (
                            <div className="text-sm">
                              <span className="font-medium">{item.receiver_name}</span>
                              <div className="text-muted-foreground text-xs">Vehículo: {item.vehicle_type}</div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-bold font-mono ${item._type === 'in' ? 'text-success' : 'text-warning'}`}>
                          {item._type === 'in' ? '+' : '-'}{item.liters} L
                        </TableCell>
                        <TableCell>
                           {item._type === 'out' && item.signature_data && (
                             <Button variant="ghost" size="icon" title="Ver Firma" onClick={() => setViewingSignature(item.signature_data)}>
                               <Eye className="w-4 h-4 text-muted-foreground" />
                             </Button>
                           )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {fuelRecords.length === 0 && fuelReceptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay movimientos registrados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Signature Capture Dialog */}
      <Dialog open={!!activeDialog} onOpenChange={(open) => {
        if (!open) setActiveDialog(null);
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

      {/* View Signature Dialog */}
      <Dialog open={!!viewingSignature} onOpenChange={(open) => !open && setViewingSignature(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Firma del Receptor</DialogTitle>
          </DialogHeader>
          <div className="bg-white rounded-lg border p-4 flex justify-center">
             {viewingSignature && <img src={viewingSignature} alt="Firma" className="max-w-full" />}
          </div>
          <DialogFooter>
            <Button onClick={() => setViewingSignature(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
