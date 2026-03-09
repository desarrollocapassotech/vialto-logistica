import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NewLoadForm from "@/components/NewLoadForm";
import LoadHistory from "@/components/LoadHistory";
import ExportData from "@/components/ExportData";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PlusCircle, Truck, Calendar, Building2 } from "lucide-react";
import { auth, db } from "@/firebase";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  addDoc,
  updateDoc
} from "firebase/firestore";
import { userConverter } from "@/converters/userConverter";
import { loadConverter } from "@/converters/loadConverter";
import { empresaConverter } from "@/converters/empresaConverter";
import { LoadData } from "@/types/load";
import Loader from "@/components/ui/loader";
import { endOfMonth, formatISO, startOfMonth } from "date-fns";
import NavBar from "@/components/NavBar";
import { useEmpresaLogo } from "@/hooks/useEmpresaLogo";

const SUPER_ADMIN_EMPRESA_KEY = "superAdminEmpresaId";
const SUPER_ADMIN_EMPRESA_NOMBRE_KEY = "superAdminEmpresaNombre";

type UserRole = "CHOFER" | "ADMIN" | "SUPER_ADMIN";

interface EmpresaItem {
  id: string;
  nombre: string;
}

const Index = () => {
  const [loads, setLoads] = useState<LoadData[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editLoad, setEditLoad] = useState<LoadData | null>(null);
  const [filter, setFilter] = useState("");
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userDni, setUserDni] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userLicensePlate, setUserLicensePlate] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [driverCount, setDriverCount] = useState<number | null>(null);
  const [monthlyLoadCount, setMonthlyLoadCount] = useState<number | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const navigate = useNavigate();
  const logoUrl = useEmpresaLogo(empresaId);

  useEffect(() => {
    const fetchUserRole = async () => {
      setIsLoading(true);
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUserRole(userData.role);
          setUserDni(userData.dni);
          setUserName(`${userData.name} ${userData.lastName}`);
          setUserLicensePlate(userData.patente);
          setEmpresaId(userData.empresaId ?? null);

          if (userData.role === "SUPER_ADMIN") {
            const sid = sessionStorage.getItem(SUPER_ADMIN_EMPRESA_KEY);
            if (sid) setEmpresaId(sid);
            setIsLoading(false);
            return;
          }
          setIsLoading(false);
          return;
        }

        const user = auth.currentUser;
        if (user) {
          const userDocRef = doc(db, "usuarios", user.uid).withConverter(userConverter);
          const userDocSnapshot = await getDoc(userDocRef);

          if (userDocSnapshot.exists()) {
            const userData = userDocSnapshot.data();
            setUserRole(userData.role);
            setUserDni(userData.dni);
            setUserName(`${userData.name} ${userData.lastName}`);
            setUserLicensePlate(userData.patente);
            setEmpresaId(userData.empresaId ?? null);

            localStorage.setItem("user", JSON.stringify({ ...userData, id: user.uid }));

            if (userData.role === "SUPER_ADMIN") {
              const sid = sessionStorage.getItem(SUPER_ADMIN_EMPRESA_KEY);
              if (sid) setEmpresaId(sid);
              setIsLoading(false);
              return;
            }
          } else {
            toast.error("Usuario no registrado.");
            navigate("/login");
          }
        } else {
          navigate("/login");
        }
      } catch (error) {
        console.error("Error al obtener usuario:", error);
        toast.error("Error al cargar los datos del usuario");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, [navigate]);


  useEffect(() => {
    const fetchLoads = async () => {
      if (!empresaId) return;
      setIsLoading(true);
      try {
        let loadsQuery;

        if (userRole === "CHOFER") {
          loadsQuery = query(
            collection(db, "cargas").withConverter(loadConverter),
            where("empresaId", "==", empresaId),
            where("driverDni", "==", userDni),
            orderBy("date", "desc")
          );
        } else {
          loadsQuery = query(
            collection(db, "cargas").withConverter(loadConverter),
            where("empresaId", "==", empresaId),
            orderBy("date", "desc")
          );
        }

        const querySnapshot = await getDocs(loadsQuery);
        const loadsData = querySnapshot.docs.map((d) => d.data());
        setLoads(loadsData);
      } catch (error) {
        console.error("Error al obtener las cargas:", error);
        toast.error("Error al cargar las cargas");
      } finally {
        setIsLoading(false);
      }
    };

    if (userRole && empresaId) fetchLoads();
  }, [userRole, userDni, empresaId]);

  useEffect(() => {
    const fetchEmpresas = async () => {
      if (userRole !== "SUPER_ADMIN") return;
      try {
        const q = query(
          collection(db, "empresas").withConverter(empresaConverter),
          orderBy("nombre")
        );
        const snapshot = await getDocs(q);
        setEmpresas(snapshot.docs.map((d) => ({ id: d.id, nombre: d.data().nombre })));
      } catch (error) {
        console.error("Error al cargar empresas:", error);
      }
    };
    fetchEmpresas();
  }, [userRole]);

  useEffect(() => {
    const fetchDriverCount = async () => {
      if ((userRole === "ADMIN" || userRole === "SUPER_ADMIN") && empresaId) {
        try {
          const driversQuery = query(
            collection(db, "usuarios"),
            where("empresaId", "==", empresaId),
            where("role", "==", "CHOFER")
          );
          const querySnapshot = await getDocs(driversQuery);
          setDriverCount(querySnapshot.size);
        } catch (error) {
          console.error("Error al obtener choferes:", error);
          toast.error("Error al cargar choferes");
        }
      }
    };
    fetchDriverCount();
  }, [userRole, empresaId]);

  useEffect(() => {
    const fetchMonthlyLoadCount = async () => {
      if (userRole && empresaId) {
        try {
          const now = new Date();
          const startOfThisMonth = formatISO(startOfMonth(now));
          const endOfThisMonth = formatISO(endOfMonth(now));

          const monthlyLoadsQuery = query(
            collection(db, "cargas"),
            where("empresaId", "==", empresaId),
            where("date", ">=", startOfThisMonth),
            where("date", "<=", endOfThisMonth)
          );

          const querySnapshot = await getDocs(monthlyLoadsQuery);
          setMonthlyLoadCount(querySnapshot.size);
        } catch (error) {
          console.error("Error al obtener cargas del mes:", error);
          toast.error("Error al cargar cargas del mes");
        }
      }
    };
    fetchMonthlyLoadCount();
  }, [userRole, empresaId]);

  // Filtrar las cargas según el término de búsqueda
  const filteredLoads = loads.filter((load) => {
    const searchTerm = filter.toLowerCase();
    return (
      load.driverName.toLowerCase().includes(searchTerm) ||
      load.licensePlate.toLowerCase().includes(searchTerm)
    );
  });

  const handleNewLoad = async (data: Omit<LoadData, "id" | "empresaId">) => {
    if (!empresaId) return;
    try {
      const payload = {
        ...data,
        driverDni: data.driverDni ?? userDni!,
        empresaId,
      } as LoadData;
      if (editLoad) {
        const loadDocRef = doc(db, "cargas", editLoad.id!).withConverter(loadConverter);
        await updateDoc(loadDocRef, payload);
        setLoads((prev) =>
          prev.map((l) => (l.id === editLoad.id ? { ...l, ...payload } : l))
        );
        toast.success("Carga actualizada exitosamente");
      } else {
        const newLoadRef = await addDoc(
          collection(db, "cargas").withConverter(loadConverter),
          payload
        );
        setLoads((prev) => [...prev, { id: newLoadRef.id, ...payload }]);
        toast.success("Carga registrada exitosamente");
      }
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error al manejar la carga:", error);
      toast.error("Error al registrar o actualizar la carga");
    }
  };

  // Eliminar una carga
  const handleDeleteLoad = async (id: string) => {
    try {
      const loadDocRef = doc(db, "cargas", id).withConverter(loadConverter);
      await deleteDoc(loadDocRef);
      setLoads((prev) => prev.filter((load) => load.id !== id));
      toast.success("Carga eliminada exitosamente");
    } catch (error) {
      console.error("Error al eliminar la carga:", error);
      toast.error("Error al eliminar la carga");
    }
  };

  const handleSalirEmpresa = () => {
    sessionStorage.removeItem(SUPER_ADMIN_EMPRESA_KEY);
    sessionStorage.removeItem(SUPER_ADMIN_EMPRESA_NOMBRE_KEY);
    setEmpresaId(null);
    setLoads([]);
    setDriverCount(null);
    setMonthlyLoadCount(null);
  };

  const handleEntrarEmpresa = (id: string, nombre: string) => {
    sessionStorage.setItem(SUPER_ADMIN_EMPRESA_KEY, id);
    sessionStorage.setItem(SUPER_ADMIN_EMPRESA_NOMBRE_KEY, nombre);
    setEmpresaId(id);
  };

  // Mostrar el loader mientras se carga la autenticación
  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userRole={userRole}
        userName={userName}
        showChoferesLink={!!(userRole === "ADMIN" || (userRole === "SUPER_ADMIN" && empresaId))}
        logoUrl={logoUrl ?? undefined}
      />

      <main className="mx-auto w-full px-4 py-6 space-y-6 max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-6xl mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Bienvenida */}
          {userName && (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800">Bienvenido, {userName}</h1>
              <p className="text-sm text-gray-500">
                {userRole === "CHOFER"
                  ? "Chofer"
                  : userRole === "ADMIN"
                    ? "Administrador"
                    : userRole === "SUPER_ADMIN"
                      ? "Super Administrador"
                      : "Rol desconocido"}
              </p>
            </div>
          )}

          {/* Super Admin: sin empresa seleccionada - listar empresas para entrar */}
          {userRole === "SUPER_ADMIN" && !empresaId && (
            <div className="space-y-4">
              <div
                onClick={() => navigate("/admin/empresas")}
                className="bg-white rounded-lg shadow-md p-4 flex items-center justify-start space-x-4 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <Building2 className="h-8 w-8 text-[#213b5d]" />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500">Gestión de Empresas</span>
                  <span className="text-base text-[#213b5d]">Crear y administrar empresas</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Ingresar a una empresa</h3>
              <div className="space-y-2">
                {empresas.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => handleEntrarEmpresa(e.id, e.nombre)}
                    className="bg-white rounded-lg shadow-md p-4 flex items-center justify-between cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <span className="font-medium">{e.nombre}</span>
                    <span className="text-sm text-[#213b5d]">Entrar →</span>
                  </div>
                ))}
                {empresas.length === 0 && (
                  <p className="text-gray-500 text-sm">No hay empresas registradas.</p>
                )}
              </div>
            </div>
          )}

          {/* Super Admin: con empresa seleccionada - botón salir */}
          {userRole === "SUPER_ADMIN" && empresaId && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSalirEmpresa}
              className="mb-2"
            >
              ← Salir de empresa
            </Button>
          )}

          {/* Tarjetas Admin (o Super Admin dentro de empresa) */}
          {(userRole === "ADMIN" || (userRole === "SUPER_ADMIN" && empresaId)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {driverCount !== null && (
                <div
                  onClick={() => navigate("/admin/choferes")}
                  className="bg-white rounded-lg shadow-md p-4 flex items-center justify-start space-x-4 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <Truck className="h-8 w-8 text-[#213b5d]" />
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Choferes Registrados</span>
                    <span className="text-2xl font-bold text-[#213b5d]">{driverCount}</span>
                  </div>
                </div>
              )}
              {monthlyLoadCount !== null && (
                <a
                  href="#historial"
                  className="bg-white rounded-lg shadow-md p-4 flex items-center justify-start space-x-4 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <Calendar className="h-8 w-8 text-[#213b5d]" />
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">Cargas este mes</span>
                    <span className="text-2xl font-bold text-[#213b5d]">{monthlyLoadCount}</span>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Botón nueva carga */}
          {userRole === "CHOFER" && (
            <div className="flex justify-center md:justify-start">
              <Button
                onClick={() => {
                  setEditLoad(null);
                  setIsFormOpen(true);
                }}
                className="w-full sm:w-auto bg-[#213b5d] hover:bg-[#b44d35]"
              >
                <PlusCircle size={20} className="mr-2" />
                Nueva Carga
              </Button>
            </div>
          )}

          {/* Exportación de datos */}
          {(userRole === "ADMIN" || (userRole === "SUPER_ADMIN" && empresaId)) && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <ExportData loads={filteredLoads} />
            </div>
          )}

          {/* Filtro */}
          {(userRole === "ADMIN" || (userRole === "SUPER_ADMIN" && empresaId)) && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <Input
                type="text"
                placeholder="Buscar por chofer o patente..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {/* Historial de cargas (no para super admin sin empresa) */}
          {(userRole !== "SUPER_ADMIN" || empresaId) && (
          <div id="historial" className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Historial de Cargas</h2>
            <LoadHistory
              loads={filteredLoads}
              filter={filter}
              onEdit={(load) => {
                setEditLoad(load);
                setIsFormOpen(true);
              }}
              onDelete={handleDeleteLoad}
            />
          </div>
          )}
        </motion.div>
      </main>

      {/* Diálogo para formulario */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <NewLoadForm
          onSubmit={handleNewLoad}
          onCancel={() => {
            setIsFormOpen(false);
            setEditLoad(null);
          }}
          defaultValues={editLoad}
          driverName={userName || ""}
          licensePlate={userLicensePlate || ""}
        />
      </Dialog>
    </div>
  );
}

export default Index;