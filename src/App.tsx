import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import RegisterEmpresa from "./pages/RegisterEmpresa";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginSelector from "./pages/LoginSelector";
import LoginAdmin from "./pages/LoginAdmin";
import Login from "./pages/Login";
import DriverManagement from "./pages/DriverManagement";
import AdminManagement from "./pages/AdminManagement";
import EmpresasManagement from "./pages/EmpresasManagement";
import EmpresaConfig from "./pages/EmpresaConfig";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* Selector de tipo de login */}
          <Route path="/" element={<LoginSelector />} />

          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/login-administrador" element={<LoginAdmin />} />
          <Route path="/registro-empresa" element={<RegisterEmpresa />} />

          {/* Rutas protegidas */}
          <Route
            path="/inicio"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/choferes"
            element={
              <ProtectedRoute>
                <DriverManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/empresa"
            element={
              <ProtectedRoute>
                <EmpresaConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/administradores"
            element={
              <ProtectedRoute>
                <AdminManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/empresas"
            element={
              <ProtectedRoute>
                <EmpresasManagement />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;