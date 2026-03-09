import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, PlusCircle, Shield } from "lucide-react";
import { auth, db } from "@/firebase";
import NavBar from "@/components/NavBar";
import { useEmpresaLogo } from "@/hooks/useEmpresaLogo";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

interface AdminData {
  id: string;
  name: string;
  lastName: string;
  email: string;
  role: string;
  empresaId: string;
}

const AdminManagement = () => {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      } else {
        setEmpresaId(data.empresaId ?? null);
      }
    }
  }, [navigate]);

  useEffect(() => {
    const fetchAdmins = async () => {
      if (!empresaId) return;
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "usuarios"),
          where("empresaId", "==", empresaId),
          where("role", "==", "ADMIN")
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as AdminData[];
        setAdmins(list);
      } catch (error) {
        console.error("Error al cargar administradores:", error);
        toast.error("Error al cargar administradores");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdmins();
  }, [empresaId]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await setDoc(doc(db, "usuarios", user.uid), {
        name: name.trim(),
        lastName: lastName.trim(),
        email: user.email,
        role: "ADMIN",
        empresaId,
      });

      toast.success(`Administrador ${name} ${lastName} creado. Iniciá sesión nuevamente.`);
      await auth.signOut();
      localStorage.removeItem("user");
      sessionStorage.removeItem("superAdminEmpresaId");
      sessionStorage.removeItem("superAdminEmpresaNombre");
      navigate("/login-administrador", { replace: true });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "auth/email-already-in-use") {
        toast.error("El correo ya está registrado.");
      } else if (err.code === "auth/weak-password") {
        toast.error("La contraseña debe tener al menos 6 caracteres.");
      } else {
        console.error("Error al crear administrador:", error);
        toast.error("Error al crear administrador. Intenta de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setIsFormOpen(false);
  };

  if (!empresaId) {
    return <p className="text-center text-gray-500 p-8">Cargando...</p>;
  }

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

        <h1 className="text-2xl font-bold text-gray-800 text-center">Gestión de Administradores</h1>

        <Button
          onClick={() => setIsFormOpen(true)}
          className="w-full bg-[#213b5d] hover:bg-[#b44d35]"
        >
          <PlusCircle size={20} className="mr-2" />
          Agregar Administrador
        </Button>

        {isLoading ? (
          <p className="text-center text-gray-500">Cargando administradores...</p>
        ) : admins.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No hay administradores registrados</div>
        ) : (
          <div className="space-y-4">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <Shield className="h-8 w-8 text-[#213b5d] flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-gray-900">{`${admin.name} ${admin.lastName}`}</h3>
                  <p className="text-sm text-gray-500">{admin.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isFormOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Administrador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña (mín. 6 caracteres)</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <p className="text-xs text-gray-500">
              Al crear el administrador tendrás que iniciar sesión nuevamente.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#213b5d] hover:bg-[#b44d35]" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear Administrador"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManagement;
