import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom"; // Si usas React Router
import { toast } from "sonner";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore"; // Importar Firestore utilities
import { auth, db } from "@/firebase";
import AppLogo from "@/components/AppLogo";

const LoginAdmin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate(); // Para redirigir al usuario

  // Proveedor de autenticación de Google
  const googleProvider = new GoogleAuthProvider();

  const fetchAndStoreUser = async (uid: string) => {
    const userDocRef = doc(db, "usuarios", uid);
    const userDocSnapshot = await getDoc(userDocRef);
    if (!userDocSnapshot.exists()) return null;
    const userData = userDocSnapshot.data();
    const stored = { ...userData, id: uid };
    localStorage.setItem("user", JSON.stringify(stored));
    return stored;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userData = await fetchAndStoreUser(user.uid);
      if (!userData) {
        toast.error("Usuario no registrado. Registrá tu empresa primero.");
        navigate("/registro-empresa");
        return;
      }
      if (userData.role !== "ADMIN" && userData.role !== "SUPER_ADMIN") {
        toast.error("Acceso denegado. Esta ruta es solo para administradores.");
        return;
      }
      toast.success(`Bienvenido, ${userData.name || user.email}`);
      navigate("/inicio");
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      toast.error("Credenciales incorrectas o usuario no registrado");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userData = await fetchAndStoreUser(user.uid);
      if (!userData) {
        toast.error("Usuario no registrado. Registrá tu empresa primero.");
        navigate("/registro-empresa");
        return;
      }
      if (userData.role !== "ADMIN" && userData.role !== "SUPER_ADMIN") {
        toast.error("Acceso denegado. Esta ruta es solo para administradores.");
        return;
      }
      toast.success(`Bienvenido, ${userData.name || user.email}`);
      navigate("/inicio");
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
      toast.error("Error al iniciar sesión con Google");
    }
  };

  // Manejar el restablecimiento de contraseña
  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Por favor, ingresa tu correo electrónico.");
      return;
    }

    try {
      // Enviar correo de restablecimiento de contraseña
      await sendPasswordResetEmail(auth, email);
      toast.success(
        `Se ha enviado un correo de restablecimiento de contraseña a ${email}.`
      );
    } catch (error) {
      console.error("Error al enviar el correo de restablecimiento:", error);
      toast.error("No se pudo enviar el correo de restablecimiento. Verifica el correo.");
    }
  };

  return (
    <div className="min-h-screen bg-[#213b5d] flex flex-col items-center justify-center px-4">
      {/* Logo, título y subtítulo */}
      <div className="text-center mb-8">
        <AppLogo alt="Logo" className="w-32 mx-auto mb-4 sm:w-40" />
        <h2 className="text-xl font-bold text-white sm:text-2xl">Iniciar Sesión</h2>
        <p className="text-sm text-gray-300">Sistema de registro de cargas de combustible</p>
      </div>

      {/* Contenedor principal (formulario) */}
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md space-y-4">
        {/* Formulario de inicio de sesión */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Campo de correo electrónico */}
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-gray-300 focus:border-[#213b5d]"
            required
          />
          {/* Campo de contraseña */}
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-gray-300 focus:border-[#213b5d]"
            required
          />
          {/* Botón de inicio de sesión */}
          <Button
            type="submit"
            className="w-full bg-[#213b5d] hover:bg-[#b44d35] text-white transition-colors py-2"
          >
            Iniciar Sesión
          </Button>
        </form>

        {/* Enlace para restablecer la contraseña */}
        <div className="text-center">
          <button
            onClick={handleForgotPassword}
            className="text-[#213b5d] font-medium hover:underline text-sm"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {/* Separador */}
        <div className="flex items-center gap-4">
          <hr className="flex-grow border-gray-300" />
          <span className="text-gray-500 text-sm">O</span>
          <hr className="flex-grow border-gray-300" />
        </div>

        {/* Botón de inicio de sesión con Google */}
        <Button
          onClick={handleGoogleLogin}
          className="w-full bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 transition-colors py-2 flex items-center justify-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            className="w-6 h-6"
          >
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303a12 12 0 0 1-4.645 8.742l7.498 6.453C39.415 37.252 43.611 30.751 43.611 20.083z"
            />
          </svg>
          Iniciar Sesión con Google
        </Button>

        <div className="text-center mt-4 space-y-2">
          <p className="text-sm text-gray-600">
            ¿No tenés una cuenta?{" "}
            <button
              type="button"
              onClick={() => navigate("/registro-empresa")}
              className="text-[#213b5d] font-medium hover:underline"
            >
              Registrar empresa
            </button>
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-[#213b5d] font-medium hover:underline"
          >
            ← Volver
          </button>
        </div>
      </div>

      {/* Texto de desarrollo y enlace */}
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

export default LoginAdmin;