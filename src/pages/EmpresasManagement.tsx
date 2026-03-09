import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { collection, addDoc, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "@/firebase";
import { empresaConverter } from "@/converters/empresaConverter";
import { Empresa } from "@/types/empresa";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, PlusCircle, Building2 } from "lucide-react";
import NavBar from "@/components/NavBar";

const EmpresasManagement = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [cuit, setCuit] = useState("");
  const [nombre, setNombre] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [telefono, setTelefono] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const data = JSON.parse(stored);
      setUserName(data.name && data.lastName ? `${data.name} ${data.lastName}` : data.name ?? null);
      if (data.role !== "SUPER_ADMIN") {
        navigate("/inicio", { replace: true });
        return;
      }
    }
  }, [navigate]);

  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const q = query(
          collection(db, "empresas").withConverter(empresaConverter),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        setEmpresas(snapshot.docs.map((d) => d.data()));
      } catch (error) {
        console.error("Error al cargar empresas:", error);
        toast.error("Error al cargar empresas");
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmpresas();
  }, []);

  const normalizeCuit = (v: string) => v.replace(/\D/g, "");
  const isValidCuit = (v: string) => /^\d{10,11}$/.test(normalizeCuit(v));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cuitNorm = normalizeCuit(cuit);
    if (!isValidCuit(cuit)) {
      toast.error("El CUIT/CUIL debe tener 10 u 11 dígitos.");
      return;
    }
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    const existing = await getDocs(
      query(collection(db, "empresas"), where("cuit", "==", cuitNorm))
    );
    if (!existing.empty) {
      toast.error("Ya existe una empresa con ese CUIT/CUIL.");
      return;
    }

    setIsSaving(true);
    try {
      const ref = await addDoc(
        collection(db, "empresas").withConverter(empresaConverter),
        {
          cuit: cuitNorm,
          nombre: nombre.trim(),
          razonSocial: razonSocial.trim() || undefined,
          telefono: telefono.trim() || undefined,
          createdAt: new Date(),
          createdBy: null,
        } as Omit<Empresa, "id">
      );
      setEmpresas((prev) => [
        ...prev,
        {
          id: ref.id,
          cuit: cuitNorm,
          nombre: nombre.trim(),
          razonSocial: razonSocial.trim() || undefined,
          telefono: telefono.trim() || undefined,
          createdAt: new Date(),
          createdBy: undefined,
        },
      ]);
      toast.success(`Empresa ${nombre} creada.`);
      setIsFormOpen(false);
      setCuit("");
      setNombre("");
      setRazonSocial("");
      setTelefono("");
    } catch (error) {
      console.error("Error al crear empresa:", error);
      toast.error("Error al crear empresa");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userRole="SUPER_ADMIN"
        userName={userName}
        showChoferesLink={false}
      />

      <main className="max-w-3xl mx-auto p-4 space-y-6 mt-16">
        <div className="flex justify-between items-center mb-4">
          <Button
            type="button"
            variant="ghost"
            className="text-[#b44d35]"
            onClick={() => navigate("/inicio", { replace: true })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center">Gestión de Empresas</h1>

        <Button
          onClick={() => setIsFormOpen(true)}
          className="w-full bg-[#213b5d] hover:bg-[#b44d35]"
        >
          <PlusCircle size={20} className="mr-2" />
          Crear empresa
        </Button>

        {isLoading ? (
          <p className="text-center text-gray-500">Cargando empresas...</p>
        ) : empresas.length === 0 ? (
          <p className="text-center text-gray-500">No hay empresas registradas</p>
        ) : (
          <div className="space-y-3">
            {empresas.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-4 p-4 bg-white rounded-lg shadow border"
              >
                <Building2 className="h-8 w-8 text-[#213b5d]" />
                <div className="flex-1">
                  <p className="font-medium">{e.nombre}</p>
                  <p className="text-sm text-gray-500">CUIT: {e.cuit}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CUIT/CUIL *</label>
              <Input
                value={cuit}
                onChange={(e) => setCuit(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="Ej: 20123456789"
                inputMode="numeric"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Transportes López"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón social (opcional)</label>
              <Input
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Ej: Transportes López S.A."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (opcional)</label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 011 1234-5678"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmpresasManagement;
