import { useNavigate } from "react-router-dom";
import AppLogo from "@/components/AppLogo";
import { Truck, Shield } from "lucide-react";

const LoginSelector = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#213b5d] flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <AppLogo alt="Logo" className="w-32 mx-auto mb-4 sm:w-40" />
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Sistema de registro de cargas de combustible
        </h2>
        <p className="text-sm text-gray-300 mt-2">¿Cómo querés ingresar?</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <button
          onClick={() => navigate("/login")}
          className="w-full bg-white hover:bg-gray-50 text-[#213b5d] rounded-lg shadow-md p-6 flex items-center gap-4 transition-colors"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#213b5d] flex items-center justify-center">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-lg">Soy chofer</span>
            <p className="text-sm text-gray-600">Iniciar sesión con DNI e ID de alarma</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/login-administrador")}
          className="w-full bg-white hover:bg-gray-50 text-[#213b5d] rounded-lg shadow-md p-6 flex items-center gap-4 transition-colors"
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#213b5d] flex items-center justify-center">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-lg">Soy administrador</span>
            <p className="text-sm text-gray-600">Iniciar sesión con correo y contraseña</p>
          </div>
        </button>
      </div>

      <div className="mt-8 text-center text-gray-400 text-sm">
        <a
          href="https://capassotech.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Desarrollado por CapassoTech
        </a>
      </div>
    </div>
  );
};

export default LoginSelector;
