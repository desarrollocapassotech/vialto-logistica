import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Building2 } from "lucide-react";
import { db, storage } from "@/firebase";
import NavBar from "@/components/NavBar";
import AppLogo from "@/components/AppLogo";
import { useEmpresaLogo } from "@/hooks/useEmpresaLogo";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { empresaConverter } from "@/converters/empresaConverter";
import { Empresa } from "@/types/empresa";

const EmpresaConfig = () => {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [razonSocial, setRazonSocial] = useState("");
  const [telefono, setTelefono] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const logoUrl = useEmpresaLogo(empresaId);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const data = JSON.parse(stored);
      setUserRole(data.role ?? null);
      setUserName(data.name && data.lastName ? `${data.name} ${data.lastName}` : data.name ?? null);
      if (data.role === "SUPER_ADMIN") {
        const sid = sessionStorage.getItem("superAdminEmpresaId");
        if (!sid) {
          navigate("/inicio", { replace: true });
          return;
        }
        setEmpresaId(sid);
      } else if (data.role === "ADMIN") {
        setEmpresaId(data.empresaId ?? null);
      } else {
        navigate("/inicio", { replace: true });
      }
    }
  }, [navigate]);

  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!empresaId) return;
      setIsLoading(true);
      try {
        const snap = await getDoc(
          doc(db, "empresas", empresaId).withConverter(empresaConverter)
        );
        if (snap.exists()) {
          const data = snap.data();
          setEmpresa(data);
          setRazonSocial(data.razonSocial ?? "");
          setTelefono(data.telefono ?? "");
        } else {
          toast.error("Empresa no encontrada");
        }
      } catch (error) {
        console.error("Error al cargar empresa:", error);
        toast.error("Error al cargar datos de la empresa");
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmpresa();
  }, [empresaId]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("La imagen no debe superar 2 MB");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setLogoFile(null);
      setLogoPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;
    setIsSaving(true);
    try {
      const updates: Partial<Empresa> = {
        razonSocial: razonSocial.trim() || undefined,
        telefono: telefono.trim() || undefined,
      };

      if (logoFile) {
        const storageRef = ref(storage, `logos/${empresaId}/logo`);
        await uploadBytes(storageRef, logoFile);
        const url = await getDownloadURL(storageRef);
        updates.logoUrl = url;
      }

      await updateDoc(doc(db, "empresas", empresaId), updates);
      if (updates.logoUrl) setEmpresa((p) => (p ? { ...p, logoUrl: updates.logoUrl } : null));
      setEmpresa((p) => (p ? { ...p, ...updates } : null));
      setLogoFile(null);
      setLogoPreview(null);
      toast.success("Datos actualizados correctamente");
    } catch (error) {
      console.error("Error al guardar:", error);
      toast.error("Error al actualizar los datos");
    } finally {
      setIsSaving(false);
    }
  };

  const displayLogo = logoPreview ?? (empresa?.logoUrl ?? logoUrl ?? undefined);

  if (!empresaId) return <p className="text-center text-gray-500 p-8">Cargando...</p>;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userRole={userRole as "CHOFER" | "ADMIN" | "SUPER_ADMIN" | null}
        userName={userName}
        showChoferesLink={true}
        logoUrl={logoUrl ?? undefined}
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
            Volver al inicio
          </Button>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center flex items-center justify-center gap-2">
          <Building2 className="h-7 w-7 text-[#213b5d]" />
          Datos de la empresa
        </h1>

        {isLoading ? (
          <p className="text-center text-gray-500">Cargando...</p>
        ) : empresa ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CUIT/CUIL</label>
              <Input value={empresa.cuit} disabled className="bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la empresa</label>
              <Input value={empresa.nombre} disabled className="bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Razón social</label>
              <Input
                value={razonSocial}
                onChange={(e) => setRazonSocial(e.target.value)}
                placeholder="Ej: Transportes López S.A."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 011 1234-5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo de la empresa</label>
              <div className="flex flex-col items-center gap-2">
                {logoPreview || displayLogo ? (
                  <img
                    src={logoPreview ?? displayLogo ?? ""}
                    alt="Logo"
                    className="h-20 object-contain border rounded"
                  />
                ) : (
                  <div className="h-20 w-full border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-sm">
                    PNG, JPG o WEBP (máx. 2 MB)
                  </div>
                )}
                <label className="cursor-pointer">
                  <span className="text-sm text-[#213b5d] hover:underline">
                    {logoFile ? "Cambiar imagen" : "Cambiar logo"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </label>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#213b5d] hover:bg-[#b44d35]"
              disabled={isSaving}
            >
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        ) : (
          <p className="text-center text-gray-500">No se encontró la empresa</p>
        )}
      </main>
    </div>
  );
};

export default EmpresaConfig;
