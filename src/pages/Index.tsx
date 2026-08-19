import { useState, useEffect, useMemo } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NewLoadForm from "@/components/NewLoadForm";
import { LoadViewModal } from "@/components/LoadViewModal";
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
  updateDoc,
} from "firebase/firestore";
import { userConverter } from "@/converters/userConverter";
import { loadConverter } from "@/converters/loadConverter";
import { empresaConverter } from "@/converters/empresaConverter";
import { LoadData } from "@/types/load";
import Loader from "@/components/ui/loader";
import { endOfMonth, formatISO, startOfMonth } from "date-fns";
import NavBar from "@/components/NavBar";
import { useEmpresaLogo } from "@/hooks/useEmpresaLogo";
import { apiJson, ApiError, isNetworkError } from "@/lib/api";
import { logout } from "@/lib/auth";
import { CargaApi, createCarga, resolveSyncError } from "@/lib/cargas";
import { readLastUsedPlate, writeLastUsedPlate } from "@/lib/lastUsedPlate";
import { writeLastKnownKm } from "@/lib/lastKnownKm";
import { extractApiErrorMessage, fmtMensajeError } from "@/lib/loadFormat";
import {
  addPendingLoad,
  deletePendingLoad,
  getPendingLoads,
  resolvePendingPhotoUrl,
  updatePendingLoad,
  PendingLoad,
} from "@/lib/offlineQueue";
import { retryPendingLoad } from "@/lib/offlineSync";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { MonthFilterControl, currentMonthValue } from "@/components/MonthFilterControl";
import { CombustiblesOrdenamientoMenu } from "@/components/CombustibleOrdenamientoMenu";
import {
  CombustibleSortField,
  CombustibleSortDir,
  COMBUSTIBLE_SORT_DEFAULT,
} from "@/lib/combustibleOrdenamiento";

function parseIsoDateToLocal(isoString: string): Date {
  if (!isoString) return new Date();
  
  // Extraemos año, mes y día explícitamente para evitar parseos UTC del navegador
  const [y, m, d] = isoString.split("T")[0].split("-").map(Number);
  
  if (y && m && d) {
    // Al usar new Date(año, mes, día), JS asume la zona horaria local.
    // Esto es el estándar más limpio para construir una fecha sin arrastrar diferencias de UTC.
    return new Date(y, m - 1, d);
  }
  
  return new Date(isoString);
}

function mapCargaToLoadData(c: CargaApi): LoadData {
  return {
    id: c.id,
    driverName: c.chofer?.nombre ?? "",
    licensePlate: c.vehiculo?.patente ?? c.vehiculoId,
    driverDni: c.chofer?.dni ? Number(c.chofer.dni) : 0,
    date: parseIsoDateToLocal(c.fecha),
    // Nombres del modelo (LoadData)
    litros: c.litros,
    importe: c.importe,
    estacion: c.estacion,
    km: c.km,
    formaPago: c.formaPago ?? undefined,
    empresaId: c.tenantId,
    // Aliases que usa LoadHistory (nombres del formulario legacy)
    liters: c.litros,
    pricePerLiter: c.precioPorLitro,
    totalAmount: c.importe,
    kilometers: c.km,
    serviceStation: c.estacion,
    paymentMethod: c.formaPago ?? undefined,
    fotoTacometro: c.fotoTacometro ?? undefined,
    fotoTicket: c.fotoTicket ?? undefined,
  } as LoadData;
}

function mapPendingToLoadData(p: PendingLoad): LoadData {
  return {
    id: `pending-${p.localId}`,
    driverName: p.driverName,
    licensePlate: p.payload.patente,
    driverDni: p.driverDni,
    date: parseIsoDateToLocal(p.payload.fecha),
    liters: p.payload.litros,
    pricePerLiter: p.payload.precioPorLitro,
    totalAmount: p.payload.importe,
    kilometers: p.payload.km,
    serviceStation: p.payload.estacion,
    paymentMethod: p.payload.formaPago,
    fotoTacometro: resolvePendingPhotoUrl(p.fotoTacometro),
    fotoTicket: resolvePendingPhotoUrl(p.fotoTicket),
    empresaId: "",
    pending: true,
    pendingLocalId: p.localId,
    // p.lastError se guarda crudo (ver offlineSync.ts); se traduce recién acá, al
    // mostrarlo — IndexedDB y el reporte al backend siguen con el texto original.
    syncError: p.lastError ? fmtMensajeError(p.lastError) : p.lastError,
  } as LoadData;
}

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
  const [viewLoad, setViewLoad] = useState<LoadData | null>(null);
  const [kmError, setKmError] = useState<string | null>(null);
  const [lastUsedPlate, setLastUsedPlate] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userDni, setUserDni] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userLicensePlate, setUserLicensePlate] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Loading del historial (refetch por cambio de mes, etc.) — separado del
  // isLoading de arranque para no tapar toda la pantalla en cada refiltrado.
  const [isLoadsLoading, setIsLoadsLoading] = useState(false);
  const [driverCount, setDriverCount] = useState<number | null>(null);
  const [monthlyLoadCount, setMonthlyLoadCount] = useState<number | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthValue);
  const [formKey, setFormKey] = useState(0); // <-- ESTADO AGREGADO
  const [pendingLoads, setPendingLoads] = useState<PendingLoad[]>([]);
  const [sortBy, setSortBy] = useState<CombustibleSortField>(
    COMBUSTIBLE_SORT_DEFAULT.sortBy,
  );
  const [sortDir, setSortDir] = useState<CombustibleSortDir>(
    COMBUSTIBLE_SORT_DEFAULT.sortDir,
  );
  const navigate = useNavigate();
  const logoUrl = useEmpresaLogo(empresaId);

  // COMB-07-T8: actualiza memoria y localStorage juntos, para que no se desincronicen.
  const rememberLastUsedPlate = (dni: number, patente: string) => {
    setLastUsedPlate(patente);
    writeLastUsedPlate(dni, patente);
  };

  // COMB-07-T6: junto con la patente, guarda el km/fecha de esta carga como
  // referencia local para la próxima vez que se cargue este mismo vehículo
  // (mismo criterio que rememberLastUsedPlate: es solo una referencia visual).
  const rememberVehicleReference = (
    dni: number,
    patente: string,
    km: number,
    fecha: string,
  ) => {
    rememberLastUsedPlate(dni, patente);
    if (empresaId) writeLastKnownKm(empresaId, patente, { km, fecha });
  };

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
          const userDocRef = doc(db, "usuarios", user.uid).withConverter(
            userConverter,
          );
          const userDocSnapshot = await getDoc(userDocRef);

          if (userDocSnapshot.exists()) {
            const userData = userDocSnapshot.data();
            setUserRole(userData.role);
            setUserDni(userData.dni);
            setUserName(`${userData.name} ${userData.lastName}`);
            setUserLicensePlate(userData.patente);
            setEmpresaId(userData.empresaId ?? null);

            localStorage.setItem(
              "user",
              JSON.stringify({ ...userData, id: user.uid }),
            );

            if (userData.role === "SUPER_ADMIN") {
              const sid = sessionStorage.getItem(SUPER_ADMIN_EMPRESA_KEY);
              if (sid) setEmpresaId(sid);
              setIsLoading(false);
              return;
            }
          } else {
            toast.error("Usuario no registrado.");
            // Limpia también vialtoToken: si quedara vivo, App.tsx seguiría
            // creyendo que hay sesión y rebotaría de nuevo a /inicio.
            await logout();
            navigate("/login");
          }
        } else {
          await logout();
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

  // COMB-07-T8: precarga offline; el fetch online de abajo la sobreescribe si hay conexión.
  useEffect(() => {
    if (userRole !== "CHOFER" || userDni == null) return;
    const stored = readLastUsedPlate(userDni);
    if (stored) setLastUsedPlate(stored);
  }, [userRole, userDni]);

  useEffect(() => {
    if (userRole !== "CHOFER") return;
    const token = localStorage.getItem("vialtoToken");
    if (!token) return;
    apiJson<{ patente: string | null } | null>(
      "/api/combustible/chofer/ultima-carga",
      async () => token,
    )
      .then((data) => {
        // COMB-07-T8: se persiste, no solo se refleja en memoria.
        if (data?.patente && userDni != null) {
          rememberLastUsedPlate(userDni, data.patente);
        }
      })
      .catch(() => { });
  }, [userRole, userDni]);

  useEffect(() => {
    if (userRole !== "CHOFER" || userDni == null) {
      setPendingLoads([]);
      return;
    }
    getPendingLoads(userDni)
      .then((fetched) => {
        // Se mergea (no se sobreescribe) porque esta lectura es async: si el
        // chofer llega a crear una carga offline antes de que resuelva, no
        // debe desaparecer de la UI cuando finalmente resuelve con un
        // snapshot tomado antes de esa escritura.
        setPendingLoads((prev) => {
          const prevIds = new Set(prev.map((p) => p.localId));
          const onlyNew = fetched.filter((p) => !prevIds.has(p.localId));
          return [...prev, ...onlyNew].sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt),
          );
        });
      })
      .catch((error) => {
        console.error("Error al leer las cargas pendientes:", error);
      });
  }, [userRole, userDni]);

  const handleLoadSynced = (pending: PendingLoad, created: CargaApi) => {
    setPendingLoads((prev) =>
      prev.filter((p) => p.localId !== pending.localId),
    );
    setLoads((prev) => [mapCargaToLoadData(created), ...prev]);
    if (created.vehiculo?.patente) {
      rememberVehicleReference(
        pending.driverDni,
        created.vehiculo.patente,
        created.km,
        created.fecha,
      );
    }
  };

  // Refleja en el estado de React el error que ya se persistió en IndexedDB
  // (COMB-07-T4), tanto si lo marcó la sincronización automática como un
  // reintento manual — sin esto, la UI queda mostrando "Pendiente" hasta el
  // próximo reload en vez de pasar a "Error de sincronización" al instante.
  const applyPendingLoadError = (localId: string, message?: string) => {
    setPendingLoads((prev) =>
      prev.map((p) => (p.localId === localId ? { ...p, lastError: message } : p)),
    );
  };

  // Sincronización automática de la cola offline al recuperar conexión (COMB-07-T3).
  useOfflineSync({
    enabled: userRole === "CHOFER",
    driverDni: userDni,
    onLoadSynced: handleLoadSynced,
    onLoadError: (pending, message) =>
      applyPendingLoadError(pending.localId, message),
  });

  // Abre el formulario para corregir una carga pendiente con error (COMB-07-T7, botón "Editar").
  const handleEditPendingLoad = (localId: string) => {
    const pending = pendingLoads.find((p) => p.localId === localId);
    if (!pending) return;
    setEditLoad(mapPendingToLoadData(pending));
    setIsFormOpen(true);
  };

  // Reintento manual de una carga pendiente con error (COMB-07-T4, botón "Reintentar").
  const handleRetryPendingLoad = async (localId: string) => {
    const pending = pendingLoads.find((p) => p.localId === localId);
    if (!pending) return;
    const token = localStorage.getItem("vialtoToken");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const created = await retryPendingLoad(pending, async () => token);
      handleLoadSynced(pending, created);
      toast.success("Carga sincronizada exitosamente");
    } catch (error) {
      if (isNetworkError(error)) {
        // Sin marcar: la sincronización automática la retoma sola al reconectar.
        applyPendingLoadError(localId, undefined);
        toast.error(
          "No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.",
        );
        return;
      }
      // Se guarda crudo (igual que ya hace retryPendingLoad en IndexedDB) y
      // se traduce recién para el toast — mismo criterio que mapPendingToLoadData.
      const rawMessage = extractApiErrorMessage(
        error,
        "No se pudo sincronizar la carga.",
      );
      applyPendingLoadError(localId, rawMessage);
      toast.error(fmtMensajeError(rawMessage));
    }
  };

  // Eliminar una carga pendiente con error, a pedido del chofer (COMB-07-T4).
  const handleDeletePendingLoad = async (localId: string) => {
    const pending = pendingLoads.find((p) => p.localId === localId);
    try {
      await deletePendingLoad(localId);
      setPendingLoads((prev) => prev.filter((p) => p.localId !== localId));
      toast.success("Carga eliminada");
    } catch (error) {
      console.error("Error al eliminar la carga pendiente:", error);
      toast.error("No se pudo eliminar la carga");
      return;
    }

    // Si tenía un error reportado, avisamos al backend para que la alerta
    // deje de aparecerle al admin — best-effort: la carga ya se borró
    // localmente, esto no debe bloquear ni reportarse como falla al chofer.
    if (pending?.lastError) {
      const token = localStorage.getItem("vialtoToken");
      if (token) {
        try {
          await resolveSyncError(localId, async () => token);
        } catch (error) {
          console.error(
            `No se pudo notificar al backend la eliminación de la carga con error ${localId}:`,
            error,
          );
        }
      }
    }
  };

  useEffect(() => {
    const fetchLoads = async () => {
      if (!userRole) return;
      setIsLoadsLoading(true);
      try {
        if (userRole === "CHOFER") {
          // Cargas del chofer desde la API de Vialto (JWT propio en localStorage)
          const token = localStorage.getItem("vialtoToken");
          if (!token) {
            navigate("/login");
            return;
          }
          const getToken = async () => token;
          const data = await apiJson<{ cargas: CargaApi[]; count: number }>(
            `/api/combustible/chofer/mis-cargas?month=${selectedMonth}&sortBy=${sortBy}&sortDir=${sortDir}`,
            getToken,
          );
          setLoads(data.cargas.map(mapCargaToLoadData));
        } else {
          // ADMIN / SUPER_ADMIN: sigue usando Firestore (pendiente de migración)
          if (!empresaId) return;
          const loadsQuery = query(
            collection(db, "cargas").withConverter(loadConverter),
            where("empresaId", "==", empresaId),
            orderBy("date", "desc"),
          );
          const querySnapshot = await getDocs(loadsQuery);
          setLoads(querySnapshot.docs.map((d) => d.data()));
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await logout();
          navigate("/login");
          return;
        }
        console.error("Error al obtener las cargas:", error);
        toast.error("Error al cargar las cargas");
      } finally {
        setIsLoadsLoading(false);
      }
    };

    if (userRole) fetchLoads();
  }, [userRole, empresaId, selectedMonth, navigate, sortBy, sortDir]);

  useEffect(() => {
    const fetchEmpresas = async () => {
      if (userRole !== "SUPER_ADMIN") return;
      try {
        const q = query(
          collection(db, "empresas").withConverter(empresaConverter),
          orderBy("nombre"),
        );
        const snapshot = await getDocs(q);
        setEmpresas(
          snapshot.docs.map((d) => ({ id: d.id, nombre: d.data().nombre })),
        );
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
            where("role", "==", "CHOFER"),
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
            where("date", "<=", endOfThisMonth),
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

  // Object URLs para previsualizar fotos de pendientes: se recalculan solo
  // cuando cambia la lista de pendientes, y se revocan en el cleanup para no
  // acumular URLs "blob:" huérfanas en cada render.
  const pendingDisplayLoads = useMemo(
    () => pendingLoads.map(mapPendingToLoadData),
    [pendingLoads],
  );

  useEffect(() => {
    return () => {
      pendingDisplayLoads.forEach((load) => {
        if (load.fotoTacometro?.startsWith("blob:"))
          URL.revokeObjectURL(load.fotoTacometro);
        if (load.fotoTicket?.startsWith("blob:"))
          URL.revokeObjectURL(load.fotoTicket);
      });
    };
  }, [pendingDisplayLoads]);

  // Cargas pendientes de sincronización SIEMPRE primero y luego las sincronizadas
  const displayedLoads = useMemo(() => {
    const sortedLoads = [...loads].sort((a, b) => {
      const dirMult = sortDir === "asc" ? 1 : -1;
      if (sortBy === "fecha_carga") {
        const dA = a.date.getTime();
        const dB = b.date.getTime();
        if (dA !== dB) return (dA - dB) * dirMult;
      }
      return 0; // Fallback al orden natural de la API
    });

    return userRole === "CHOFER"
      ? [...pendingDisplayLoads, ...sortedLoads]
      : sortedLoads;
  }, [userRole, pendingDisplayLoads, loads, sortBy, sortDir]);

  // Filtrar las cargas según el término de búsqueda
  const filteredLoads = displayedLoads.filter((load) => {
    const searchTerm = filter.toLowerCase();
    return (
      load.driverName.toLowerCase().includes(searchTerm) ||
      load.licensePlate.toLowerCase().includes(searchTerm)
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNewLoad = async (data: any) => {
    try {
      if (userRole === "CHOFER") {
        const token = localStorage.getItem("vialtoToken");
        if (!token) {
          navigate("/login");
          return;
        }
        const getToken = async () => token;
        const apiPayload = {
          patente: data.licensePlate,
          estacion: data.serviceStation,
          litros: data.liters,
          precioPorLitro: data.pricePerLiter,
          importe: data.totalAmount,
          km: data.kilometers,
          ...(data.paymentMethod ? { formaPago: data.paymentMethod } : {}),
          fecha: data.date,
          fotoTacometro: data.fotoTacometro,
          fotoTicket: data.fotoTicket,
          createdAt: new Date().toISOString(),
        };
        // Payload sin fotos, para IndexedDB — compartido con el alta offline.
        const {
          fotoTacometro: _ft,
          fotoTicket: _tk,
          ...pendingPayload
        } = apiPayload;

        if (editLoad?.pending && editLoad.pendingLocalId) {
          // T7: corregir una carga pendiente con error, sin tocar sus fotos.
          const localId = editLoad.pendingLocalId;
          await updatePendingLoad(localId, pendingPayload);
          setPendingLoads((prev) =>
            prev.map((p) =>
              p.localId === localId ? { ...p, payload: pendingPayload } : p,
            ),
          );
          setKmError(null);
          toast.success(
            "Carga corregida. Tocá \"Reintentar\" para sincronizarla.",
          );
        } else if (editLoad) {
          // T6: editar carga vía API
          const updated = await apiJson<CargaApi>(
            `/api/combustible/chofer/cargas/${editLoad.id}`,
            getToken,
            { method: "PATCH", body: JSON.stringify(apiPayload) },
          );
          setLoads((prev) =>
            prev.map((l) =>
              l.id === editLoad.id ? mapCargaToLoadData(updated) : l,
            ),
          );
          setKmError(null);
          toast.success("Carga actualizada exitosamente");
        } else {
          // T5: crear carga vía API. Si no hay conexión (o la request falla
          // por un error de red), se guarda localmente (COMB-07-T2) en vez
          // de perder la carga.
          const canAttemptCreate = navigator.onLine;
          let savedOffline = false;

          if (canAttemptCreate) {
            try {
              const created = await createCarga(apiPayload, getToken);
              setLoads((prev) => [mapCargaToLoadData(created), ...prev]);
              if (created.vehiculo?.patente && userDni != null) {
                rememberVehicleReference(
                  userDni,
                  created.vehiculo.patente,
                  created.km,
                  created.fecha,
                );
              }
              toast.success("Carga registrada exitosamente");
            } catch (error) {
              if (!isNetworkError(error)) throw error;
              savedOffline = true;
            }
          } else {
            savedOffline = true;
          }

          if (savedOffline) {
            if (userDni == null) {
              console.error(
                "No se pudo determinar el DNI del chofer para guardar la carga sin conexión.",
              );
              toast.error(
                "No se pudo guardar la carga sin conexión: no se identificó al chofer. Intente nuevamente.",
              );
              return;
            }

            try {
              const pending = await addPendingLoad({
                createdAt: apiPayload.createdAt,
                driverDni: userDni,
                driverName: data.driverName,
                payload: pendingPayload,
                fotoTacometro: data.fotoTacometroBlob
                  ? { kind: "blob", blob: data.fotoTacometroBlob }
                  : { kind: "url", url: data.fotoTacometro },
                fotoTicket: data.fotoTicketBlob
                  ? { kind: "blob", blob: data.fotoTicketBlob }
                  : { kind: "url", url: data.fotoTicket },
              });
              setPendingLoads((prev) => [...prev, pending]);
              // COMB-07-T8/T6: precarga patente y km de esta misma sesión offline.
              rememberVehicleReference(
                userDni,
                apiPayload.patente,
                apiPayload.km,
                apiPayload.fecha,
              );
              toast.success(
                "Sin conexión: la carga se guardó en el dispositivo y se sincronizará más tarde.",
              );
            } catch (storageError) {
              // No hay red y tampoco se pudo guardar localmente (cuota
              // agotada, IndexedDB deshabilitado, etc.): la carga no quedó
              // registrada en ningún lado. Se avisa explícitamente en vez de
              // mostrar el mensaje genérico de "error al registrar", y se
              // deja el formulario abierto para que el chofer pueda reintentar.
              console.error(
                "Error al guardar la carga sin conexión:",
                storageError,
              );
              toast.error(
                "No se pudo guardar la carga en el dispositivo (sin espacio disponible o almacenamiento no accesible). Intente nuevamente.",
              );
              return;
            }
          }
          setKmError(null);
        }
        setIsFormOpen(false);
        setEditLoad(null);
        setFormKey((prev) => prev + 1); // <-- ACTUALIZACIÓN DE LA KEY ACÁ
        return;
      }

      // ADMIN / SUPER_ADMIN: Firestore (pendiente de migración)
      if (!empresaId) return;
      const payload = {
        ...data,
        driverDni: data.driverDni ?? userDni!,
        empresaId,
      } as LoadData;
      if (editLoad) {
        const loadDocRef = doc(db, "cargas", editLoad.id!).withConverter(
          loadConverter,
        );
        await updateDoc(loadDocRef, payload as any);
        setLoads((prev) =>
          prev.map((l) => (l.id === editLoad.id ? { ...l, ...payload } : l)),
        );
        toast.success("Carga actualizada exitosamente");
      } else {
        const newLoadRef = await addDoc(
          collection(db, "cargas").withConverter(loadConverter),
          payload,
        );
        setLoads((prev) => [...prev, { id: newLoadRef.id, ...payload }]);
        toast.success("Carga registrada exitosamente");
      }
      setIsFormOpen(false);
      setFormKey((prev) => prev + 1); // <-- ACTUALIZACIÓN DE LA KEY ACÁ
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
        navigate("/login");
        return;
      }
      console.error("Error al manejar la carga:", error);
      const msg = fmtMensajeError(
        extractApiErrorMessage(error, "Error al registrar o actualizar la carga"),
      );
      const isKmError =
        typeof msg === "string" && msg.toLowerCase().includes("km");
      if (isKmError) {
        setKmError(msg);
      } else {
        setKmError(null);
      }
      toast.error(msg);
    }
  };

  const handleDeleteLoad = async (id: string) => {
    try {
      if (userRole === "CHOFER") {
        const token = localStorage.getItem("vialtoToken");
        if (!token) {
          navigate("/login");
          return;
        }
        await apiJson<{ deleted: string }>(
          `/api/combustible/chofer/cargas/${id}`,
          async () => token,
          { method: "DELETE" },
        );
      } else {
        const loadDocRef = doc(db, "cargas", id).withConverter(loadConverter);
        await deleteDoc(loadDocRef);
      }
      setLoads((prev) => prev.filter((load) => load.id !== id));
      toast.success("Carga eliminada exitosamente");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
        navigate("/login");
        return;
      }
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
    <div className="min-h-screen bg-[#F8F5EE]">
      <NavBar
        userRole={userRole}
        userName={userName}
        showChoferesLink={
          !!(userRole === "ADMIN" || (userRole === "SUPER_ADMIN" && empresaId))
        }
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
              <h1 className="text-2xl font-display font-normal text-[#1A1A1A] tracking-tight">
                Bienvenido, {userName}
              </h1>
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
                <Building2 className="h-8 w-8 text-[#E8470A]" />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500">
                    Gestión de Empresas
                  </span>
                  <span className="text-base text-[#E8470A]">
                    Crear y administrar empresas
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">
                Ingresar a una empresa
              </h3>
              <div className="space-y-2">
                {empresas.map((e) => (
                  <div
                    key={e.id}
                    onClick={() => handleEntrarEmpresa(e.id, e.nombre)}
                    className="bg-white rounded-lg shadow-md p-4 flex items-center justify-between cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <span className="font-medium">{e.nombre}</span>
                    <span className="text-sm text-[#E8470A]">Entrar →</span>
                  </div>
                ))}
                {empresas.length === 0 && (
                  <p className="text-gray-500 text-sm">
                    No hay empresas registradas.
                  </p>
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
          {(userRole === "ADMIN" ||
            (userRole === "SUPER_ADMIN" && empresaId)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {driverCount !== null && (
                  <div
                    onClick={() => navigate("/admin/choferes")}
                    className="bg-white rounded-lg shadow-md p-4 flex items-center justify-start space-x-4 cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <Truck className="h-8 w-8 text-[#E8470A]" />
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">
                        Choferes Registrados
                      </span>
                      <span className="text-2xl font-bold text-[#E8470A]">
                        {driverCount}
                      </span>
                    </div>
                  </div>
                )}
                {monthlyLoadCount !== null && (
                  <a
                    href="#historial"
                    className="bg-white rounded-lg shadow-md p-4 flex items-center justify-start space-x-4 cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <Calendar className="h-8 w-8 text-[#E8470A]" />
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-500">
                        Cargas este mes
                      </span>
                      <span className="text-2xl font-bold text-[#E8470A]">
                        {monthlyLoadCount}
                      </span>
                    </div>
                  </a>
                )}
              </div>
            )}

          {/* Botón nueva carga (solo CHOFER) */}
          {userRole === "CHOFER" && (
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <Button
                onClick={() => {
                  setEditLoad(null);
                  setIsFormOpen(true);
                }}
                className="w-full sm:w-auto bg-[#E8470A] hover:bg-[#FF6B2B]"
              >
                <PlusCircle size={20} className="mr-2" />
                Nueva Carga
              </Button>
            </div>
          )}

          {/* Exportación de datos */}
          {(userRole === "ADMIN" ||
            (userRole === "SUPER_ADMIN" && empresaId)) && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <ExportData loads={filteredLoads} />
              </div>
            )}

          {/* Filtro */}
          {(userRole === "ADMIN" ||
            (userRole === "SUPER_ADMIN" && empresaId)) && (
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
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Historial de Cargas
              </h2>
              {userRole === "CHOFER" && (
                <div className="mb-4 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                  <div className="w-full sm:w-auto">
                    <p className="mb-2 text-sm text-gray-500">
                      Filtrar historial por mes
                    </p>
                    <MonthFilterControl
                      value={selectedMonth}
                      onChange={setSelectedMonth}
                    />
                  </div>
                  <div className="w-full sm:w-auto">
                    <p className="mb-2 text-sm text-gray-500">
                      Ordenar por
                    </p>
                    <div className="w-full sm:w-auto">
                      <CombustiblesOrdenamientoMenu
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onChange={(b, d) => {
                          setSortBy(b);
                          setSortDir(d);
                        }}
                        disabled={isLoadsLoading}
                      />
                    </div>
                  </div>
                </div>
              )}
              {isLoadsLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
                  <svg
                    className="h-4 w-4 animate-spin text-[#E8470A]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Actualizando historial...
                </div>
              )}
              <LoadHistory
                loads={filteredLoads}
                filter={filter}
                onView={(load) => setViewLoad(load)}
                onDelete={handleDeleteLoad}
                showDelete={userRole !== "CHOFER"}
                onEditPending={handleEditPendingLoad}
                onRetryPending={handleRetryPendingLoad}
                onDeletePending={handleDeletePendingLoad}
              />
            </div>
          )}
        </motion.div>
      </main>

      {/* Diálogo para formulario */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditLoad(null);
            setKmError(null);
          }
        }}
      >
        <NewLoadForm
          key={formKey} // <-- KEY AGREGADA ACÁ
          onSubmit={handleNewLoad}
          onCancel={() => {
            setIsFormOpen(false);
            setEditLoad(null);
            setKmError(null);
          }}
          defaultValues={editLoad}
          driverName={userName || ""}
          empresaId={empresaId || ""}
          licensePlate={
            editLoad
              ? (editLoad.licensePlate ?? "")
              : lastUsedPlate || userLicensePlate || ""
          }
          kmError={kmError}
          onClearKmError={() => setKmError(null)}
          autoCalculatePrice={userRole === "CHOFER"}
        />
      </Dialog>

      {/* Diálogo de vista (detalle de una carga, con acceso a editar) */}
      <Dialog
        open={viewLoad !== null}
        onOpenChange={(open) => {
          if (!open) setViewLoad(null);
        }}
      >
        {viewLoad && (
          <LoadViewModal
            load={viewLoad}
            onClose={() => setViewLoad(null)}
            onEdit={() => {
              setEditLoad(viewLoad);
              setIsFormOpen(true);
              setViewLoad(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
};

export default Index;
