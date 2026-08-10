import { useState, useEffect, useRef } from "react";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiJson, isNetworkError } from "@/lib/api";
import { uploadFoto } from "@/lib/cargas";
import { readLastKnownKm, writeLastKnownKm } from "@/lib/lastKnownKm";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadData } from "@/types/load";

function formatAmount(value: string, prefix = ""): string {
  const onlyDigitsAndComma = value.replace(/[^\d,]/g, "");
  const [intPart = "", decPart = ""] = onlyDigitsAndComma.split(",");
  const intClean = intPart.replace(/\D/g, "");
  const decClean = decPart.replace(/\D/g, "").slice(0, 2);
  const intFormatted = intClean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const result = decClean ? `${intFormatted},${decClean}` : intFormatted;
  return result ? `${prefix}${result}` : "";
}

function formatAmountFromNumber(n: number, prefix = ""): string {
  if (!Number.isFinite(n)) return "";
  const fixed = n.toFixed(2);
  const [int, dec] = fixed.split(".");
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${prefix}${intFormatted},${dec}`;
}

function parseAmount(formatted: string): number {
  const normalized = formatted
    .replace(/^\$/, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(normalized) || 0;
}

function formatInteger(value: string): string {
  const onlyDigits = value.replace(/\D/g, "");
  return onlyDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatIntegerFromNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const int = Math.floor(n).toString();
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseInteger(formatted: string): number {
  const normalized = formatted.replace(/\./g, "");
  return parseInt(normalized, 10) || 0;
}

function formatPatente(value: string): string {
  const raw = value
    .replace(/\s/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 7);
  if (!raw) return "";
  const letters = raw.replace(/\d/g, "");
  const digits = raw.replace(/\D/g, "");
  const firstDigitIdx = raw.search(/\d/);

  // AB 123 CD: la posición del primer dígito es 2 (AB|123)
  // ABC 123: la posición del primer dígito es 3 (ABC|123) o 0 si empieza con números (123|ABC)
  if (firstDigitIdx === 2 && digits.length >= 1) {
    const p1 = letters.slice(0, 2);
    const p2 = digits.slice(0, 3);
    const p3 = letters.slice(2, 4);
    const parts = [p1, p2, p3].filter(Boolean);
    return parts.join(" ");
  }
  // ABC 123 (o parcial): 3 letras + 3 números
  const l = letters.slice(0, 3);
  const d = digits.slice(0, 3);
  if (!l) return d;
  return d ? `${l} ${d}` : l;
}

function parsePatente(formatted: string): string {
  return formatted.replace(/\s/g, "").toUpperCase();
}

function isPatenteMercosur(value: string): boolean {
  const raw = value
    .replace(/\s/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  const firstDigitIdx = raw.search(/\d/);
  return firstDigitIdx === 2 || (raw.length === 2 && /^[A-Z]{2}$/.test(raw));
}

function isPatenteAbc123(value: string): boolean {
  const raw = value
    .replace(/\s/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (!raw) return false;
  const firstDigitIdx = raw.search(/\d/);
  return firstDigitIdx === 3 || firstDigitIdx === 0;
}

function showPlateDesign(value: string): boolean {
  if (!value.trim()) return true; // vacío: por defecto diseño tipo 1 (Mercosur)
  return !isPatenteAbc123(value);
}

interface NewLoadFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  defaultValues?: LoadData;
  driverName?: string;
  licensePlate?: string;
  /** Tenant del chofer autenticado — particiona el cache local de último km (COMB-07-T6). */
  empresaId: string;
  kmError?: string | null;
  onClearKmError?: () => void;
  /**
   * true: el precio por litro se calcula solo (monto ÷ litros) y no se puede
   * editar a mano — flujo del chofer (COMB-03-T5). false/undefined: precio
   * editable manualmente, comportamiento sin cambios — panel de administración.
   */
  autoCalculatePrice?: boolean;
}

interface PhotoUploaderProps {
  label: string;
  previewUrl: string | null;
  onFileSelect: (file: File | null) => void;
  onClear: () => void;
  isReadOnly: boolean;
}

/** Formatos aceptados para foto de tacómetro/ticket (VTO-194). */
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PhotoUploader = ({
  label,
  previewUrl,
  onFileSelect,
  onClear,
  isReadOnly,
}: PhotoUploaderProps) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isSourceSheetOpen, setIsSourceSheetOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast.error("La imagen debe ser JPG, PNG o WEBP");
      } else if (file.size > 10 * 1024 * 1024) {
        toast.error("La imagen no debe superar 10 MB");
      } else {
        onFileSelect(file);
      }
    }
    // Permite volver a elegir el mismo archivo dos veces seguidas: sin esto,
    // el navegador no dispara onChange si el path no cambió desde la
    // selección anterior.
    e.target.value = "";
  };

  return (
    <div className="flex flex-col space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {!isReadOnly && <span className="text-red-500">*</span>}
      </label>

      {previewUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-video bg-gray-50 flex items-center justify-center group">
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-full object-contain"
          />
          {!isReadOnly && (
            <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 shadow-md transition-all active:scale-95"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : isReadOnly ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-6 aspect-video text-gray-400 space-y-1">
          <span className="text-sm font-medium">Sin foto registrada</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsSourceSheetOpen(true)}
          className="rounded-xl border-2 border-dashed border-gray-300 hover:border-[#E8470A] hover:bg-[#E8470A]/5 active:bg-[#E8470A]/10 transition-all flex flex-col items-center justify-center p-6 aspect-video bg-white text-gray-500 space-y-2 group"
        >
          <Camera className="h-8 w-8 text-gray-400 group-hover:text-[#E8470A]" />
          <span className="text-sm font-medium">Capturar o subir foto</span>
          <span className="text-xs text-gray-400">
            JPG, PNG o WEBP de hasta 10 MB
          </span>
        </button>
      )}

      {/* Input oculto para tomar una foto nueva con la cámara (VTO-194). */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Input oculto para elegir una foto existente de la galería (VTO-194). */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Sheet open={isSourceSheetOpen} onOpenChange={setIsSourceSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-3 mt-6 pb-8">
            <button
              type="button"
              onClick={() => {
                setIsSourceSheetOpen(false);
                cameraInputRef.current?.click();
              }}
              className="min-h-[88px] rounded-xl border-2 border-gray-200 bg-white text-gray-600 hover:border-[#E8470A] hover:bg-[#E8470A]/5 active:bg-[#E8470A]/10 transition-colors flex items-center gap-4 px-4 touch-manipulation"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8470A]/10 text-[#E8470A]">
                <Camera className="h-6 w-6" />
              </span>
              <span className="text-base font-medium text-left">
                Sacar una foto
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSourceSheetOpen(false);
                galleryInputRef.current?.click();
              }}
              className="min-h-[88px] rounded-xl border-2 border-gray-200 bg-white text-gray-600 hover:border-[#E8470A] hover:bg-[#E8470A]/5 active:bg-[#E8470A]/10 transition-colors flex items-center gap-4 px-4 touch-manipulation"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8470A]/10 text-[#E8470A]">
                <ImagePlus className="h-6 w-6" />
              </span>
              <span className="text-base font-medium text-left">
                Buscar en la galería
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const NewLoadForm = ({
  onSubmit,
  onCancel,
  defaultValues,
  driverName,
  licensePlate,
  empresaId,
  kmError,
  onClearKmError,
  autoCalculatePrice = false,
}: NewLoadFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prevKmInfo, setPrevKmInfo] = useState<{
    km: number;
    fecha: string;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLicensePlateEnabled, setIsLicensePlateEnabled] = useState(false);
  const [licensePlateError, setLicensePlateError] = useState<string | null>(
    null,
  );
  const [isStationSheetOpen, setIsStationSheetOpen] = useState(false);
  const [isDateSheetOpen, setIsDateSheetOpen] = useState(false);

  // Estados para fotos y previsualización
  const [fotoTacometroFile, setFotoTacometroFile] = useState<File | null>(null);
  const [fotoTacometroPreview, setFotoTacometroPreview] = useState<
    string | null
  >(defaultValues?.fotoTacometro || null);
  const [fotoTicketFile, setFotoTicketFile] = useState<File | null>(null);
  const [fotoTicketPreview, setFotoTicketPreview] = useState<string | null>(
    defaultValues?.fotoTicket || null,
  );

  // Estado del formulario
  const [formData, setFormData] = useState({
    driverName: driverName || "",
    licensePlate: licensePlate || "",
    serviceStation: defaultValues?.serviceStation || "YPF EN RUTA",
    liters: "",
    pricePerLiter: "",
    totalAmount: "",
    kilometers: "",
    date: new Date(),
    // SOLUCIÓN: Normalizar a mayúsculas desde el inicio
    paymentMethod: defaultValues?.paymentMethod
      ? String(defaultValues.paymentMethod).toUpperCase()
      : null,
  });

  // Inicializar el formulario con los valores por defecto si existen
  useEffect(() => {
    if (defaultValues) {
      setFormData({
        driverName: defaultValues.driverName,
        licensePlate: formatPatente(defaultValues.licensePlate || ""),
        serviceStation: defaultValues.serviceStation || "YPF EN RUTA",
        liters: formatAmountFromNumber(
          typeof defaultValues.liters === "number"
            ? defaultValues.liters
            : parseFloat(String(defaultValues.liters).replace(",", ".")) || 0,
        ),
        pricePerLiter: formatAmountFromNumber(
          typeof defaultValues.pricePerLiter === "number"
            ? defaultValues.pricePerLiter
            : parseFloat(
                String(defaultValues.pricePerLiter || "").replace(",", "."),
              ) || 0,
        ),
        totalAmount: formatAmountFromNumber(
          typeof defaultValues.totalAmount === "number"
            ? defaultValues.totalAmount
            : parseFloat(String(defaultValues.totalAmount).replace(",", ".")) ||
                0,
          "$",
        ),
        kilometers: formatIntegerFromNumber(
          typeof defaultValues.kilometers === "number"
            ? defaultValues.kilometers
            : parseInt(
                String(defaultValues.kilometers || "").replace(/\./g, ""),
                10,
              ) || 0,
        ),
        date: defaultValues.date ? new Date(defaultValues.date) : new Date(),

        // SOLUCIÓN: Normalizar el dato proveniente del backend (panel admin) a mayúsculas
        paymentMethod: defaultValues.paymentMethod
          ? String(defaultValues.paymentMethod).toUpperCase()
          : null,
      });
      setFotoTacometroPreview(defaultValues.fotoTacometro || null);
      setFotoTicketPreview(defaultValues.fotoTicket || null);
      setFotoTacometroFile(null);
      setFotoTicketFile(null);
    } else {
      setFormData({
        driverName: driverName || "",
        licensePlate: formatPatente(licensePlate || ""),
        serviceStation: "YPF EN RUTA",
        liters: "",
        pricePerLiter: "",
        totalAmount: "",
        kilometers: "",
        date: new Date(),
        paymentMethod: null,
      });
      setFotoTacometroPreview(null);
      setFotoTicketPreview(null);
      setFotoTacometroFile(null);
      setFotoTicketFile(null);
    }
    setLicensePlateError(null);
  }, [defaultValues, driverName, licensePlate]);

  // Consultar el último km registrado para la patente ingresada. Semilla
  // optimista desde el cache local (COMB-07-T6) antes de esperar la red: útil
  // tanto sin conexión como con conexión lenta. El fetch de abajo la
  // reemplaza con la respuesta real del servidor si tiene éxito.
  useEffect(() => {
    const plate = parsePatente(formData.licensePlate);
    const token = localStorage.getItem("vialtoToken");
    if (!plate || !token) {
      setPrevKmInfo(null);
      return;
    }
    setPrevKmInfo(readLastKnownKm(empresaId, plate));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ patente: plate });
        if (defaultValues?.id) qs.set("excludeId", defaultValues.id);
        const y = formData.date.getFullYear();
        const m = String(formData.date.getMonth() + 1).padStart(2, "0");
        const d = String(formData.date.getDate()).padStart(2, "0");
        const yyyymmdd = `${y}-${m}-${d}`;

        qs.set("fecha", yyyymmdd);

        qs.set("_t", Date.now().toString());

        const data = await apiJson<{ km: number; fecha: string } | null>(
          `/api/combustible/chofer/ultimo-km?${qs.toString()}`,
          async () => token,
        );
        setPrevKmInfo(data ?? null);
        if (data && !defaultValues) {
          writeLastKnownKm(empresaId, plate, data);
        }
      } catch {
        // Sin conexión (u otro error): se mantiene la referencia cacheada
        // seteada arriba en vez de perderla.
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [formData.licensePlate, empresaId, formData.date]);

  // Precio por litro calculado automáticamente (COMB-03-T5, solo flujo
  // chofer): se deriva de monto ÷ litros en vez de dejarlo tipear a mano,
  // para que no puedan desincronizarse entre sí. En el panel de
  // administración (autoCalculatePrice=false) este efecto no hace nada y el
  // campo se sigue completando manualmente como hasta ahora.
  useEffect(() => {
    if (!autoCalculatePrice) return;
    const liters = parseAmount(formData.liters);
    const total = parseAmount(formData.totalAmount);
    const computed = liters > 0 ? total / liters : 0;
    setFormData((prev) => ({
      ...prev,
      pricePerLiter: computed > 0 ? formatAmountFromNumber(computed) : "",
    }));
  }, [autoCalculatePrice, formData.liters, formData.totalAmount]);

  // Cálculos en tiempo real de coherencia de importe
  const litersNum = parseAmount(formData.liters);
  const priceNum = parseAmount(formData.pricePerLiter);
  const totalNum = parseAmount(formData.totalAmount);
  const hasLitersAndPrice = litersNum > 0 && priceNum > 0;
  const expectedTotal = litersNum * priceNum;
  const difference = Math.abs(totalNum - expectedTotal);
  const maxAllowedDiff = expectedTotal * 0.01;
  // Con precio calculado automáticamente, litros × precio == monto por
  // construcción (salvo redondeo de centavos, muy por debajo del 1%): el
  // chequeo de discrepancia solo tiene sentido cuando el precio se tipea a
  // mano (panel de administración).
  const hasDiscrepancy =
    !autoCalculatePrice && hasLitersAndPrice && difference > maxAllowedDiff;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasDiscrepancy) return;

    // El input arranca disabled (isLicensePlateEnabled), y un campo disabled
    // no dispara la validación HTML5 required — por eso se valida acá.
    if (!parsePatente(formData.licensePlate)) {
      setLicensePlateError("Ingresá la patente del vehículo.");
      setIsLicensePlateEnabled(true);
      return;
    }
    setLicensePlateError(null);

    if (!formData.paymentMethod) {
      toast.error("El método de pago es obligatorio.");
      return;
    }

    if (!defaultValues && (!fotoTacometroPreview || !fotoTicketPreview)) {
      toast.error("Ambas fotos (tacómetro y ticket) son obligatorias.");
      return;
    }

    setIsSubmitting(true);

    // Solo aplica en alta de carga nueva: editar una carga ya existente
    // requiere conexión, igual que antes (fuera del alcance de COMB-07-T2).
    const isNewLoad = !defaultValues;

    // Si ya sabemos que no hay conexión, evitamos el intento de red. Si hay
    // conexión (o no podemos saberlo con certeza), intentamos subir igual y
    // solo caemos al modo offline si la request falla por un error de red.
    const canAttemptUpload = isNewLoad ? navigator.onLine : true;

    // Sube una foto o, si no hay conexión (solo en alta nueva), devuelve el
    // File crudo para que se guarde localmente en vez de perderse.
    const resolvePhoto = async (
      file: File,
      tipo: "tacometro" | "ticket",
    ): Promise<{ url: string; blob: File | null }> => {
      if (!canAttemptUpload) return { url: "", blob: file };
      try {
        const token = localStorage.getItem("vialtoToken");
        const url = await uploadFoto(file, tipo, async () => token);
        return { url, blob: null };
      } catch (error) {
        if (isNewLoad && isNetworkError(error)) return { url: "", blob: file };
        throw error;
      }
    };

    try {
      let fotoTacometroUrl = defaultValues?.fotoTacometro || "";
      let fotoTicketUrl = defaultValues?.fotoTicket || "";
      let fotoTacometroBlob: File | null = null;
      let fotoTicketBlob: File | null = null;

      if (fotoTacometroFile) {
        const result = await resolvePhoto(fotoTacometroFile, "tacometro");
        fotoTacometroUrl = result.url;
        fotoTacometroBlob = result.blob;
      }
      if (fotoTicketFile) {
        const result = await resolvePhoto(fotoTicketFile, "ticket");
        fotoTicketUrl = result.url;
        fotoTicketBlob = result.blob;
      }

      const y = formData.date.getFullYear();
      const m = String(formData.date.getMonth() + 1).padStart(2, "0");
      const d = String(formData.date.getDate()).padStart(2, "0");
      const yyyymmdd = `${y}-${m}-${d}`;

      await onSubmit({
        ...formData,
        licensePlate: parsePatente(formData.licensePlate),
        date: yyyymmdd,
        liters: parseAmount(formData.liters),
        pricePerLiter: parseAmount(formData.pricePerLiter),
        totalAmount: parseAmount(formData.totalAmount),
        kilometers: parseInteger(formData.kilometers),
        paymentMethod: formData.paymentMethod,
        fotoTacometro: fotoTacometroUrl,
        fotoTicket: fotoTicketUrl,
        fotoTacometroBlob,
        fotoTicketBlob,
      });
    } catch (error: any) {
      console.error("Error al enviar el formulario:", error);
      toast.error(
        error?.message ||
          "Ocurrió un error al subir las fotos. Intente nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBaseClass =
    "mt-2 min-h-[48px] w-full text-base py-3 px-4 touch-manipulation bg-white border-gray-300 shadow-sm focus:border-[#E8470A] focus:ring-[#E8470A]";

  return (
    <DialogContent
      aria-describedby={undefined}
      className="w-screen max-w-none h-dvh max-h-none border-0 rounded-none overflow-hidden flex flex-col gap-0 p-0 bg-white sm:w-[95vw] sm:max-w-md sm:h-auto sm:max-h-[90dvh] sm:border sm:rounded-xl sm:p-6 sm:gap-4"
    >
      <div className="flex flex-col flex-1 min-h-0">
        <DialogHeader className="flex-shrink-0 p-4 border-b border-gray-100 sm:p-0 sm:border-0 space-y-2">
          <DialogTitle className="text-center text-xl sm:text-lg">
            {defaultValues ? "Editar Carga" : "Nueva Carga"}
          </DialogTitle>
          {formData.driverName && (
            <p className="text-center text-sm text-gray-600 font-medium">
              {formData.driverName}
            </p>
          )}
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col min-h-0 sm:flex-none"
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:overflow-visible sm:flex-none">
          {/* Monto Total - estilo destacado */}
          <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Monto Total <span className="text-red-500">*</span>
            </label>
            <Input
              required
              type="text"
              inputMode="decimal"
              value={formData.totalAmount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  totalAmount: formatAmount(e.target.value, "$"),
                })
              }
              className="min-h-[64px] w-full text-2xl sm:text-3xl font-semibold py-4 px-5 touch-manipulation bg-white border-2 border-gray-200 rounded-lg shadow-sm text-center placeholder:text-gray-400 focus:border-[#E8470A] focus:ring-2 focus:ring-[#E8470A]/20"
              placeholder="$0,00"
            />
            {/* Con precio automático, monto y "total esperado" son siempre el
                mismo número por construcción: mostrarlo no aporta nada, solo
                aplica al panel de administración (precio editable a mano). */}
            {!autoCalculatePrice && hasLitersAndPrice && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-center space-y-1">
                <div className="text-sm text-gray-600">
                  Total esperado:{" "}
                  <span className="font-semibold text-gray-800">
                    ${formatAmountFromNumber(expectedTotal)}
                  </span>
                </div>
                {hasDiscrepancy && (
                  <div className="text-xs font-semibold text-red-600 flex items-center justify-center gap-1">
                    <span>
                      ⚠️ El monto ingresado difiere más del 1% del esperado.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Método de Pago - botones tipo segmented control para mobile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Método de Pago <span className="text-red-500">*</span>
            </label>
            <div
              role="group"
              aria-label="Método de pago"
              className="grid grid-cols-3 gap-2"
            >
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, paymentMethod: "EFECTIVO" })
                }
                className={`min-h-[52px] rounded-xl text-base font-medium touch-manipulation transition-colors border-2 ${
                  formData.paymentMethod === "EFECTIVO"
                    ? "border-[#E8470A] bg-[#E8470A]/10 text-[#E8470A]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 active:bg-gray-50"
                }`}
              >
                Efectivo
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, paymentMethod: "TARJETA" })
                }
                className={`min-h-[52px] rounded-xl text-base font-medium touch-manipulation transition-colors border-2 ${
                  formData.paymentMethod === "TARJETA"
                    ? "border-[#E8470A] bg-[#E8470A]/10 text-[#E8470A]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 active:bg-gray-50"
                }`}
              >
                Tarjeta
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, paymentMethod: "CUENTA_CORRIENTE" })
                }
                className={`min-h-[52px] rounded-xl text-base font-medium touch-manipulation transition-colors border-2 ${
                  formData.paymentMethod === "CUENTA_CORRIENTE"
                    ? "border-[#E8470A] bg-[#E8470A]/10 text-[#E8470A]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 active:bg-gray-50"
                }`}
              >
                Cta. Corriente
              </button>
            </div>
            {!formData.paymentMethod && (
              <p className="mt-1.5 text-xs text-red-500 font-medium">
                Seleccione un método de pago.
              </p>
            )}
          </div>

          {/* Litros Cargados */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Litros Cargados <span className="text-red-500">*</span>
            </label>
            <Input
              required
              type="text"
              inputMode="decimal"
              value={formData.liters}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  liters: formatAmount(e.target.value),
                })
              }
              className={inputBaseClass}
              placeholder="Ej: 1.234,56"
            />
            {/* Precio por litro (COMB-03-T5): en el flujo del chofer no es un
                campo del formulario, es un dato informativo derivado de monto
                ÷ litros — por eso va como texto, no como input. */}
            {autoCalculatePrice && formData.pricePerLiter && (
              <p className="mt-1.5 text-xs text-gray-500">
                Precio por litro calculado:{" "}
                <span className="font-medium text-gray-700">
                  ${formData.pricePerLiter}
                </span>
              </p>
            )}
          </div>

          {/* Precio por Litro: solo en el panel de administración. En el
              flujo del chofer se calcula solo y se muestra como texto debajo
              de Litros Cargados (arriba), no como campo editable. */}
          {!autoCalculatePrice && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio por Litro <span className="text-red-500">*</span>
              </label>
              <Input
                required
                type="text"
                inputMode="decimal"
                value={formData.pricePerLiter}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricePerLiter: formatAmount(e.target.value),
                  })
                }
                className={inputBaseClass}
                placeholder="Ej: 1.234,56"
              />
            </div>
          )}

          {/* Estación de Servicio - abre sheet al tocar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estación de Servicio
            </label>
            <button
              type="button"
              onClick={() => setIsStationSheetOpen(true)}
              className="min-h-[52px] w-full rounded-xl text-base font-medium touch-manipulation text-left px-4 py-3 bg-white border-2 border-gray-200 hover:border-gray-300 active:bg-gray-50 flex items-center justify-between"
            >
              <span
                className={
                  formData.serviceStation ? "text-gray-900" : "text-gray-500"
                }
              >
                {formData.serviceStation || "Seleccionar estación"}
              </span>
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <Sheet
              open={isStationSheetOpen}
              onOpenChange={setIsStationSheetOpen}
            >
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Estación de Servicio</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-2 mt-6 pb-8">
                  {[
                    "YPF EN RUTA",
                    "GOTTIG",
                    "AGRO",
                    "AXION",
                    "LA PAZ",
                    "SHELL FLOTA",
                    "AXION CARD",
                    "OTRA",
                  ].map(
                    (station) => (
                      <button
                        key={station}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, serviceStation: station });
                          setIsStationSheetOpen(false);
                        }}
                        className={`min-h-[52px] rounded-xl text-base font-medium touch-manipulation transition-colors border-2 ${
                          formData.serviceStation === station
                            ? "border-[#E8470A] bg-[#E8470A]/10 text-[#E8470A]"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 active:bg-gray-50"
                        }`}
                      >
                        {station}
                      </button>
                    ),
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Kilometros */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kilómetros <span className="text-red-500">*</span>
            </label>
            <Input
              required
              type="text"
              inputMode="numeric"
              value={formData.kilometers}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  kilometers: formatInteger(e.target.value),
                });
                // Si hay un error de km externo, lo limpiamos al editar
                if (kmError && onClearKmError) onClearKmError();
              }}
              className={`${inputBaseClass} ${kmError ? "border-red-400 focus:border-red-400 focus:ring-red-400" : ""}`}
              placeholder="Ej: 10.000"
            />
            {prevKmInfo && !kmError && (
              <p className="mt-1.5 text-xs text-gray-500">
                Carga anterior:{" "}
                <span className="font-medium text-gray-700">
                  {prevKmInfo.km.toLocaleString("es-AR")} km
                </span>
                {" · "}
                {new Date(prevKmInfo.fecha).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            )}
            {kmError && (
              <p className="mt-1.5 text-sm text-red-600 font-medium">
                {kmError}
              </p>
            )}
          </div>

          {/* Fecha - Sheet con calendario al tocar */}
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">
              Fecha
            </span>
            <button
              type="button"
              onClick={() => setIsDateSheetOpen(true)}
              className="min-h-[52px] w-full rounded-xl text-base font-medium touch-manipulation flex items-center justify-between px-4 py-3 bg-white border-2 border-gray-200 hover:border-gray-300 active:bg-gray-50 text-left"
            >
              <span className="text-gray-900">
                {formData.date.toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <svg
                className="h-5 w-5 text-gray-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
            <Sheet open={isDateSheetOpen} onOpenChange={setIsDateSheetOpen}>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Seleccionar fecha</SheetTitle>
                </SheetHeader>
                <div className="py-4 pb-8">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => {
                      if (date) {
                        setFormData({ ...formData, date });
                        setIsDateSheetOpen(false);
                      }
                    }}
                    classNames={{
                      cell: "h-12 w-12 p-0",
                      day: "h-12 w-12 text-base",
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Patente del vehículo - al final */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-sm font-medium text-gray-700">
                Patente del vehículo <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsLicensePlateEnabled((v) => !v)}
                className="text-xs font-medium text-[#E8470A] hover:underline touch-manipulation"
              >
                {isLicensePlateEnabled ? "Bloquear" : "Editar"}
              </button>
            </div>
            {(() => {
              const isMercosur = showPlateDesign(formData.licensePlate);
              return (
                <div
                  className={`relative overflow-hidden aspect-[2.8/1] w-full max-w-sm mx-auto shadow-md ${
                    isMercosur ? "rounded-lg" : "rounded-xl"
                  } border-2 ${
                    licensePlateError
                      ? "border-red-400"
                      : isMercosur
                        ? "border-black"
                        : "border-gray-300 bg-gradient-to-b from-gray-100 to-gray-200"
                  }`}
                >
                  {/* Capa decorativa - diseño Mercosur (AB 123 CD) */}
                  {isMercosur && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-0 left-0 right-0 h-[26%] min-h-[28px] bg-[#003366] flex items-center justify-between px-3 py-1">
                        <span className="text-white text-[9px] sm:text-[10px] font-bold tracking-[0.15em] flex-1 text-center select-none drop-shadow-sm">
                          REPÚBLICA ARGENTINA
                        </span>
                        <div className="w-6 h-4 rounded-sm overflow-hidden flex flex-col shrink-0 border border-white/50 shadow-sm">
                          <div className="h-1/3 bg-[#74ACDF]" />
                          <div className="h-1/3 bg-white flex items-center justify-center">
                            <svg
                              viewBox="0 0 32 32"
                              className="w-3.5 h-3.5 shrink-0"
                            >
                              <circle cx="16" cy="16" r="6" fill="#F4B800" />
                              {[...Array(16)].map((_, i) => {
                                const a = (i * 22.5 * Math.PI) / 180;
                                const r1 = 6;
                                const r2 = 11;
                                const x1 = 16 + r1 * Math.cos(a);
                                const y1 = 16 + r1 * Math.sin(a);
                                const x2 = 16 + r2 * Math.cos(a);
                                const y2 = 16 + r2 * Math.sin(a);
                                return i % 2 === 0 ? (
                                  <line
                                    key={i}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="#F4B800"
                                    strokeWidth="1"
                                  />
                                ) : (
                                  <path
                                    key={i}
                                    d={`M${x1} ${y1} Q${16 + 9 * Math.cos(a)} ${16 + 9 * Math.sin(a)} ${x2} ${y2}`}
                                    stroke="#F4B800"
                                    strokeWidth="1"
                                    fill="none"
                                  />
                                );
                              })}
                              <circle
                                cx="16"
                                cy="14.5"
                                r="0.6"
                                fill="#B8860B"
                              />
                              <path
                                d="M14.5 16.5 Q16 17.5 17.5 16.5"
                                stroke="#B8860B"
                                strokeWidth="0.5"
                                fill="none"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                          <div className="h-1/3 bg-[#74ACDF]" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-[74%] bg-white" />
                    </div>
                  )}
                  {/* Capa decorativa - diseño ABC 123 */}
                  {!isMercosur && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-0 left-0 right-0 h-[24%] min-h-[24px] flex items-center justify-center px-3 py-1">
                        <span className="text-[#1e5a8e] text-[11px] font-bold tracking-[0.2em] text-center uppercase">
                          Argentina
                        </span>
                      </div>
                      <div className="absolute left-3 right-3 top-[28%] bottom-[8%] bg-black rounded" />
                    </div>
                  )}
                  {/* Un solo input - centrado en el área de contenido de cada diseño */}
                  <div
                    className={`absolute left-0 right-0 flex items-center justify-center px-3 py-2 z-10 ${
                      isMercosur
                        ? "top-[26%] bottom-0"
                        : "left-3 right-3 top-[28%] bottom-[8%]"
                    }`}
                  >
                    <input
                      value={formData.licensePlate}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          licensePlate: formatPatente(e.target.value),
                        });
                        if (licensePlateError) setLicensePlateError(null);
                      }}
                      inputMode="text"
                      autoCapitalize="characters"
                      disabled={!isLicensePlateEnabled}
                      placeholder={isMercosur ? "AB 123 CD" : "ABC 123"}
                      className={`w-full h-full min-h-0 text-center font-bold tracking-[0.2em] bg-transparent border-0 outline-none disabled:bg-transparent disabled:cursor-not-allowed leading-tight ${
                        isMercosur
                          ? "text-4xl sm:text-5xl text-black placeholder:text-gray-300"
                          : "text-5xl sm:text-6xl text-white placeholder:text-gray-500"
                      }`}
                    />
                  </div>
                </div>
              );
            })()}
            {licensePlateError && (
              <p className="mt-1.5 text-sm text-red-600 font-medium text-center">
                {licensePlateError}
              </p>
            )}
          </div>

          {/* Fotos Obligatorias (VTO-44) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <PhotoUploader
              label="Foto del Tacómetro"
              previewUrl={fotoTacometroPreview}
              onFileSelect={(file) => {
                setFotoTacometroFile(file);
                if (file) setFotoTacometroPreview(URL.createObjectURL(file));
              }}
              onClear={() => {
                setFotoTacometroFile(null);
                setFotoTacometroPreview(null);
              }}
              isReadOnly={!!defaultValues}
            />
            <PhotoUploader
              label="Foto del Ticket"
              previewUrl={fotoTicketPreview}
              onFileSelect={(file) => {
                setFotoTicketFile(file);
                if (file) setFotoTicketPreview(URL.createObjectURL(file));
              }}
              onClear={() => {
                setFotoTicketFile(null);
                setFotoTicketPreview(null);
              }}
              isReadOnly={!!defaultValues}
            />
          </div>
          </div>

          {/* Botones de acción — fijos al pie, fuera del área scrolleable */}
          <DialogFooter className="flex-shrink-0 gap-3 border-t border-gray-100 px-4 py-4 sm:border-0 sm:p-0 sm:pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="w-full min-h-[48px] text-base touch-manipulation sm:w-auto sm:min-h-9"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full min-h-[48px] text-base touch-manipulation bg-[#E8470A] hover:bg-[#FF6B2B] sm:w-auto sm:min-h-9"
              disabled={
                isSubmitting ||
                hasDiscrepancy ||
                !formData.paymentMethod ||
                (!defaultValues &&
                  (!fotoTacometroPreview || !fotoTicketPreview))
              }
            >
              {isSubmitting ? "Cargando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </div>
    </DialogContent>
  );
};

export default NewLoadForm;
