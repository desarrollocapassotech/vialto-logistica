import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, collection, addDoc, query, where, getDocs, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/firebase";
import { empresaConverter } from "@/converters/empresaConverter";
import AppLogo from "@/components/AppLogo";
import { Empresa } from "@/types/empresa";

const normalizeCuit = (v: string) => v.replace(/\D/g, "");
const isValidCuit = (v: string) => /^\d{10,11}$/.test(normalizeCuit(v));

const RegisterEmpresa = () => {
  const [empresaCuit, setEmpresaCuit] = useState("");
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [empresaRazonSocial, setEmpresaRazonSocial] = useState("");
  const [empresaTelefono, setEmpresaTelefono] = useState("");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("El archivo debe ser una imagen (PNG, JPG, etc.)");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("La imagen no debe superar 2 MB");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setLogoFile(null);
      setLogoPreview(null);
    }
  };

  const uploadLogo = async (empresaId: string): Promise<string | null> => {
    if (!logoFile) return null;
    const storageRef = ref(storage, `logos/${empresaId}/logo`);
    await uploadBytes(storageRef, logoFile);
    return getDownloadURL(storageRef);
  };

  const googleProvider = new GoogleAuthProvider();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cuitNorm = normalizeCuit(empresaCuit);
    if (!isValidCuit(empresaCuit)) {
      toast.error("El CUIT/CUIL debe tener 10 u 11 dígitos.");
      return;
    }
    const existing = await getDocs(
      query(collection(db, "empresas"), where("cuit", "==", cuitNorm))
    );
    if (!existing.empty) {
      toast.error("Ya existe una empresa registrada con ese CUIT/CUIL.");
      return;
    }
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const empresaRef = await addDoc(
        collection(db, "empresas").withConverter(empresaConverter),
        {
          cuit: cuitNorm,
          nombre: empresaNombre.trim(),
          razonSocial: empresaRazonSocial.trim() || undefined,
          telefono: empresaTelefono.trim() || undefined,
          createdAt: new Date(),
          createdBy: user.uid,
        } as Omit<Empresa, "id">
      );

      const logoUrl = await uploadLogo(empresaRef.id);
      if (logoUrl) {
        await updateDoc(doc(db, "empresas", empresaRef.id), { logoUrl });
      }

      await setDoc(doc(db, "usuarios", user.uid), {
        name,
        lastName,
        email: user.email,
        role: "ADMIN",
        empresaId: empresaRef.id,
      });

      toast.success(`Empresa ${empresaNombre} creada. Bienvenido, ${name}`);
      navigate("/inicio");
    } catch (error: unknown) {
      console.error("Error al registrar:", error);
      const err = error as { code?: string };
      if (err.code === "auth/email-already-in-use") {
        toast.error("El correo ya está registrado.");
      } else {
        toast.error("Error al registrar. Intenta de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !lastName) {
      toast.error("Nombre y apellido son obligatorios.");
      return;
    }
    if (!empresaNombre.trim()) {
      toast.error("El nombre de la empresa es obligatorio.");
      return;
    }
    const cuitNorm = normalizeCuit(empresaCuit);
    if (!isValidCuit(empresaCuit)) {
      toast.error("El CUIT/CUIL debe tener 10 u 11 dígitos.");
      return;
    }
    const existing = await getDocs(
      query(collection(db, "empresas"), where("cuit", "==", cuitNorm))
    );
    if (!existing.empty) {
      toast.error("Ya existe una empresa registrada con ese CUIT/CUIL.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const empresaRef = await addDoc(
        collection(db, "empresas").withConverter(empresaConverter),
        {
          cuit: cuitNorm,
          nombre: empresaNombre.trim(),
          razonSocial: empresaRazonSocial.trim() || undefined,
          telefono: empresaTelefono.trim() || undefined,
          createdAt: new Date(),
          createdBy: user.uid,
        } as Omit<Empresa, "id">
      );

      const logoUrl = await uploadLogo(empresaRef.id);
      if (logoUrl) {
        await updateDoc(doc(db, "empresas", empresaRef.id), { logoUrl });
      }

      await setDoc(doc(db, "usuarios", user.uid), {
        name,
        lastName,
        email: user.email,
        role: "ADMIN",
        empresaId: empresaRef.id,
      });

      toast.success(`Empresa ${empresaNombre} creada. Bienvenido, ${name}`);
      navigate("/inicio");
    } catch (error) {
      console.error("Error con Google:", error);
      toast.error("Error al registrar con Google.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#213b5d] flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <AppLogo logoUrl={logoPreview} alt="Logo" className="w-32 mx-auto mb-4 sm:w-40" />
        <h2 className="text-xl font-bold text-white sm:text-2xl">Registro de Empresa</h2>
        <p className="text-sm text-gray-300">Crear una nueva empresa</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md space-y-4">
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CUIT/CUIL *</label>
            <Input
              placeholder="Ej: 20123456789"
              value={empresaCuit}
              onChange={(e) => setEmpresaCuit(e.target.value.replace(/\D/g, "").slice(0, 11))}
              inputMode="numeric"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la empresa *</label>
            <Input
              placeholder="Ej: Transportes López"
              value={empresaNombre}
              onChange={(e) => setEmpresaNombre(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Razón social (opcional)</label>
            <Input
              placeholder="Ej: Transportes López S.A."
              value={empresaRazonSocial}
              onChange={(e) => setEmpresaRazonSocial(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (opcional)</label>
            <Input
              placeholder="Ej: 011 1234-5678"
              value={empresaTelefono}
              onChange={(e) => setEmpresaTelefono(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo de la empresa</label>
            <div className="flex flex-col items-center gap-2">
              {logoPreview ? (
                <img src={logoPreview} alt="Vista previa" className="h-20 object-contain border rounded" />
              ) : (
                <div className="h-20 w-full border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-sm">
                  PNG, JPG o WEBP (máx. 2 MB)
                </div>
              )}
              <label className="cursor-pointer">
                <span className="text-sm text-[#213b5d] hover:underline">
                  {logoFile ? "Cambiar imagen" : "Seleccionar imagen"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tu apellido</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#213b5d] hover:bg-[#b44d35]"
            disabled={isLoading}
          >
            {isLoading ? "Registrando..." : "Crear empresa"}
          </Button>
        </form>

        <div className="flex items-center gap-4">
          <hr className="flex-grow border-gray-300" />
          <span className="text-gray-500 text-sm">O</span>
          <hr className="flex-grow border-gray-300" />
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleRegister}
          disabled={isLoading}
        >
          Continuar con Google
        </Button>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">
            ¿Ya tenés cuenta?{" "}
            <button
              type="button"
              onClick={() => navigate("/login-administrador")}
              className="text-[#213b5d] font-medium hover:underline"
            >
              Iniciar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterEmpresa;
