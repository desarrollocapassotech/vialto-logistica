// components/NavBar.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { auth } from "@/firebase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import AppLogo from "@/components/AppLogo";

interface NavItem {
  label: string;
  path: string;
  roles: ("CHOFER" | "ADMIN" | "SUPER_ADMIN")[];
}

const navItems: NavItem[] = [
  { label: "Inicio", path: "/inicio", roles: ["CHOFER", "ADMIN", "SUPER_ADMIN"] },
  { label: "Choferes", path: "/admin/choferes", roles: ["ADMIN"] },
  { label: "Administradores", path: "/admin/administradores", roles: ["ADMIN"] },
  { label: "Mi Empresa", path: "/admin/empresa", roles: ["ADMIN"] },
  { label: "Empresas", path: "/admin/empresas", roles: ["SUPER_ADMIN"] },
];

const NavBar: React.FC<{
  userRole: "CHOFER" | "ADMIN" | "SUPER_ADMIN" | null;
  userName: string | null;
  showChoferesLink?: boolean;
  logoUrl?: string | null;
}> = ({ userRole, userName, showChoferesLink = false, logoUrl }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredNavItems = navItems.filter((item) => {
    if (item.label === "Inicio") return true;
    if (["Choferes", "Administradores", "Mi Empresa"].includes(item.label))
      return showChoferesLink || item.roles.includes(userRole as "CHOFER" | "ADMIN" | "SUPER_ADMIN");
    return item.roles.includes(userRole as "CHOFER" | "ADMIN" | "SUPER_ADMIN");
  });

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("user");
      sessionStorage.removeItem("superAdminEmpresaId");
      sessionStorage.removeItem("superAdminEmpresaNombre");
      toast.success("Sesión cerrada exitosamente");
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      toast.error("Error al cerrar sesión");
    }
  };

  // Manejar clics fuera del menú
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [mobileMenuOpen]);

  return (
    <nav className="bg-[#213b5d] text-white shadow-md z-50 fixed top-0 left-0 right-0 w-full max-w-full">
      {/* Header con logo, título y menú sandwich en todos los tamaños */}
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1">
          <AppLogo logoUrl={logoUrl} alt="Logo" className="h-6 md:h-8 flex-shrink-0" />
          <span className="font-semibold text-sm md:text-base truncate">
            Sistema de registro de cargas de combustible
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Menú desplegable (sandwich) - todas las páginas + cerrar sesión */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        >
          <motion.div
            ref={menuRef}
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 bottom-0 bg-white w-72 max-w-[85vw] p-4 shadow-xl overflow-y-auto"
          >
            <div className="flex flex-col space-y-1 mt-2">
              <p className="bg-[#213b5d] text-white text-center text-base font-semibold py-2 px-4 rounded mb-4">
                {userName || "Usuario"}
                <br />
                <span className="text-sm font-normal opacity-90">
                  {userRole === "CHOFER"
                    ? "Chofer"
                    : userRole === "ADMIN"
                      ? "Administrador"
                      : userRole === "SUPER_ADMIN"
                        ? "Super Admin"
                        : "Usuario"}
                </span>
              </p>
              {filteredNavItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className="text-left px-4 py-3 text-gray-800 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  {item.label}
                </button>
              ))}
              <hr className="border-gray-200 my-2" />
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </nav>
  );
};

export default NavBar;