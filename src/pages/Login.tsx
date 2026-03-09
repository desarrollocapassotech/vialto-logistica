import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import AppLogo from "@/components/AppLogo";

interface Empresa {
  id: string;
  nombre: string;
  logoUrl?: string;
}

const LOGIN_SAVE_KEY = "loginChofer";

interface SavedLogin {
  empresaId: string;
  empresaNombre: string;
  dni: string;
  password: string;
}

const MIN_SEARCH_LENGTH = 2;

function loadSavedLogin(): Partial<SavedLogin> | null {
  try {
    const saved = localStorage.getItem(LOGIN_SAVE_KEY);
    if (saved) {
      return JSON.parse(saved) as SavedLogin;
    }
  } catch {
    // ignorar si hay error al parsear
  }
  return null;
}

const Login = () => {
  const [empresasSearchResults, setEmpresasSearchResults] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(() => {
    const s = loadSavedLogin();
    return s?.empresaId && s?.empresaNombre
      ? { id: s.empresaId, nombre: s.empresaNombre }
      : null;
  });
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [dni, setDni] = useState(() => loadSavedLogin()?.dni ?? "");
  const [password, setPassword] = useState(() => loadSavedLogin()?.password ?? "");
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [empresasSearching, setEmpresasSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  // Buscar empresas solo cuando el usuario escribe (nunca cargar todas)
  useEffect(() => {
    const term = empresaSearch.trim().toLowerCase();
    if (term.length < MIN_SEARCH_LENGTH) {
      setEmpresasSearchResults([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setEmpresasSearching(true);
      try {
        const termCap = term.charAt(0).toUpperCase() + term.slice(1);
        const runQuery = (start: string) => {
          const q = query(
            collection(db, "empresas"),
            where("nombre", ">=", start),
            where("nombre", "<=", start + "\uf8ff"),
            orderBy("nombre")
          );
          return getDocs(q);
        };
        const [snap1, snap2] = await Promise.all([runQuery(term), runQuery(termCap)]);
        const seen = new Set<string>();
        const results: Empresa[] = [];
        for (const snapshot of [snap1, snap2]) {
          snapshot.docs.forEach((d) => {
            if (seen.has(d.id)) return;
            seen.add(d.id);
            results.push({
              id: d.id,
              nombre: d.data().nombre || "",
              logoUrl: d.data().logoUrl,
            });
          });
        }
        results.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setEmpresasSearchResults(results);
      } catch (error) {
        console.error("Error al buscar empresas:", error);
        toast.error("Error al buscar");
        setEmpresasSearchResults([]);
      } finally {
        setEmpresasSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [empresaSearch]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) {
      toast.error("Seleccioná tu empresa.");
      return;
    }
    const empresaId = selectedEmpresa.id;
    setIsLoading(true);
    try {

      const usersRef = collection(db, "usuarios");
      const userQuery = query(
        usersRef,
        where("empresaId", "==", empresaId),
        where("dni", "==", parseInt(String(dni), 10)),
        where("role", "==", "CHOFER")
      );
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        toast.error("DNI no registrado en esta empresa.");
        setIsLoading(false);
        return;
      }

      const userData = userSnapshot.docs[0].data();
      if (String(userData.pass) !== String(password)) {
        toast.error("ID Usuario de alarma incorrecto.");
        setIsLoading(false);
        return;
      }

      const userWithId = {
        ...userData,
        id: userSnapshot.docs[0].id,
        empresaId,
      };
      localStorage.setItem("user", JSON.stringify(userWithId));

      if (saveCredentials) {
        localStorage.setItem(
          LOGIN_SAVE_KEY,
          JSON.stringify({
            empresaId: selectedEmpresa.id,
            empresaNombre: selectedEmpresa.nombre,
            dni,
            password,
          } satisfies SavedLogin)
        );
      } else {
        localStorage.removeItem(LOGIN_SAVE_KEY);
      }

      toast.success(`Bienvenido, ${userData.name} ${userData.lastName}`);
      navigate("/inicio");
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      toast.error("Ocurrió un error al intentar iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#213b5d] flex flex-col items-center justify-center px-4">
      {/* Logo, título y subtítulo */}
      <div className="text-center mb-8">
        <AppLogo
          logoUrl={selectedEmpresa?.logoUrl}
          alt="Logo"
          className="w-32 mx-auto mb-4 sm:w-40"
        />
        <h2 className="text-xl font-bold text-white sm:text-2xl">¡Hola, chofer!</h2>
        <p className="text-sm text-gray-300">Ingresá tus datos para registrar las cargas de combustible</p>
      </div>

      {/* Contenedor principal (formulario) */}
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md space-y-4">
        {/* Formulario de inicio de sesión */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Popover
              open={empresaOpen}
              onOpenChange={(open) => {
                setEmpresaOpen(open);
                if (!open) setEmpresaSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={empresaOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedEmpresa
                      ? selectedEmpresa.nombre
                      : "Seleccionar empresa"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Escribí al menos 2 caracteres para buscar..."
                    value={empresaSearch}
                    onValueChange={setEmpresaSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {empresasSearching
                        ? "Buscando..."
                        : !empresaSearch || empresaSearch.trim().length < MIN_SEARCH_LENGTH
                          ? "Escribí al menos 2 caracteres para buscar"
                          : "No se encontró ninguna empresa."}
                    </CommandEmpty>
                    <CommandGroup>
                      {empresasSearchResults.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={emp.nombre}
                          onSelect={() => {
                            setSelectedEmpresa(emp);
                            setEmpresaOpen(false);
                            setEmpresaSearch("");
                          }}
                        >
                          <span>{emp.nombre}</span>
                          {selectedEmpresa?.id === emp.id && (
                            <span
                              className={cn(
                                "ml-auto h-4 w-4 rounded-sm border border-primary bg-primary"
                              )}
                            />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="DNI"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            required
          />
          {/* Campo de contraseña */}
          <Input
            type="password"
            placeholder="ID Usuario de alarma"
            value={password}
            maxLength={4}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-gray-300 focus:border-[#213b5d]"
            required
          />
          <div className="flex items-center space-x-2">
            <Checkbox
              id="saveCredentials"
              checked={saveCredentials}
              onCheckedChange={(checked) => setSaveCredentials(checked === true)}
            />
            <label
              htmlFor="saveCredentials"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Guardar mis datos
            </label>
          </div>
          {/* Botón de inicio de sesión */}
          <Button
            type="submit"
            className="w-full bg-[#213b5d] hover:bg-[#b44d35] text-white transition-colors py-2"
            disabled={isLoading}
          >
            {isLoading ? "Entrando..." : "Iniciar Sesión"}
          </Button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm text-[#213b5d] font-medium hover:underline"
            >
              ← Volver
            </button>
          </div>
        </form>
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

export default Login;