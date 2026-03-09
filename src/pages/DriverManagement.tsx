import { Button } from "@/components/ui/button";
import UserManagement from "@/components/UserManagement";
import NavBar from "@/components/NavBar";
import { ArrowLeft } from "lucide-react";
import { useEmpresaLogo } from "@/hooks/useEmpresaLogo";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const DriverManagement = () => {
  const [filter, setFilter] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
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

        {/* Título */}
        <h1 className="text-2xl font-bold text-gray-800 text-center">Gestión de Choferes</h1>

        {/* Filtro de búsqueda */}
        <input
          type="text"
          placeholder="Buscar por nombre, apellido o DNI..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:border-[#213b5d]"
        />

        <UserManagement filter={filter} empresaId={empresaId} />
      </main>
    </div>
  );
};

export default DriverManagement;