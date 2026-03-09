import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/firebase";
import Loader from "./ui/loader";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const [isLoading, setIsLoading] = useState(true); // Estado para controlar la carga inicial
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Estado para verificar la autenticación
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        // 1. Verificar si los datos del usuario están en localStorage
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          setIsAuthenticated(true);
          setIsLoading(false);
          return; // Terminar la ejecución si los datos están en localStorage
        }

        // 2. Verificar si el usuario está autenticado en Firebase Authentication
        const unsubscribe = auth.onAuthStateChanged((user) => {
          if (user) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
          setIsLoading(false); // Finalizar la carga inicial
        });

        return () => unsubscribe(); // Limpiar el listener cuando el componente se desmonta
      } catch (error) {
        console.error("Error al verificar la autenticación:", error);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, [navigate]);

  // Mientras se carga, mostrar un loader
  if (isLoading) {
    return <Loader />
  }

  // Si no está autenticado después de la carga inicial, redirigir al login
  if (!isAuthenticated) {
    navigate("/login", { replace: true });
    return null; // No renderizar nada mientras se redirige
  }

  // Si está autenticado, renderizar los hijos
  return children;
};

export default ProtectedRoute;