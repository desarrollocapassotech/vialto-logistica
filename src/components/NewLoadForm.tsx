import { useState, useEffect } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadData } from "@/types/load";

interface NewLoadFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  defaultValues?: LoadData;
  driverName?: string;
  licensePlate?: string;
}

const NewLoadForm = ({
  onSubmit,
  onCancel,
  defaultValues,
  driverName,
  licensePlate,
}: NewLoadFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLicensePlateEnabled, setIsLicensePlateEnabled] = useState(false);

  // Estado del formulario
  const [formData, setFormData] = useState({
    driverName: driverName || "",
    licensePlate: licensePlate || "",
    serviceStation: defaultValues?.serviceStation || "YPF",
    liters: "",
    totalAmount: "",
    kilometers: "",
    date: new Date(),
    paymentMethod: defaultValues?.paymentMethod || null,
  });

  // Inicializar el formulario con los valores por defecto si existen
  useEffect(() => {
    if (defaultValues) {
      setFormData({
        driverName: defaultValues.driverName,
        licensePlate: defaultValues.licensePlate,
        serviceStation: defaultValues.serviceStation || "YPF",
        liters: defaultValues.liters.toString(),
        totalAmount: defaultValues.totalAmount.toString(),
        kilometers: defaultValues.kilometers?.toString() || "",
        date: defaultValues.date ? new Date(defaultValues.date) : new Date(),
        paymentMethod: defaultValues.paymentMethod || null,
      });
    } else {
      setFormData({
        driverName: driverName || "",
        licensePlate: licensePlate || "",
        serviceStation: "YPF",
        liters: "",
        totalAmount: "",
        kilometers: "",
        date: new Date(),
        paymentMethod: "TARJETA",
      });
    }
  }, [defaultValues, driverName, licensePlate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        ...formData,
        date: formData.date.toISOString(),
        liters: parseFloat(formData.liters),
        totalAmount: parseFloat(formData.totalAmount),
        kilometers: parseFloat(formData.kilometers),
        paymentMethod: formData.paymentMethod,
      });
    } catch (error) {
      console.error("Error al enviar el formulario:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-center text-xl sm:text-lg">
          {defaultValues ? "Editar Carga" : "Nueva Carga"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Nombre del Chofer */}
        {formData.driverName && (
          <div>
            <label className="text-sm font-medium text-gray-700">Nombre del Chofer</label>
            <Input
              value={formData.driverName}
              readOnly
              className="mt-1 cursor-not-allowed bg-gray-100"
              placeholder="Ingrese nombre completo"
            />
          </div>
        )}

        {/* Patente del Camión */}
        <div>
          <label className="text-sm font-medium text-gray-700">Patente del Camión</label>
          <div className="flex items-center space-x-2">
            <Input
              required
              value={formData.licensePlate}
              onChange={(e) =>
                setFormData({ ...formData, licensePlate: e.target.value })
              }
              className="mt-1 w-full"
              placeholder="Ej: AB123CD"
              disabled={!isLicensePlateEnabled}
            />
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isLicensePlateEnabled}
                onChange={(e) =>
                  setIsLicensePlateEnabled(e.target.checked)
                }
                className="mr-2"
              />
              <span className="text-xs sm:text-sm text-gray-700">
                Habilitar edición
              </span>
            </div>
          </div>
        </div>

        {/* Fecha */}
        <div>
          <label className="text-sm font-medium text-gray-700">Fecha</label>
          <Input
            required
            type="date"
            value={formData.date.toISOString().split("T")[0]}
            onChange={(e) =>
              setFormData({ ...formData, date: new Date(e.target.value) })
            }
            className="mt-1 w-full"
          />
        </div>

        {/* Litros Cargados */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Litros Cargados
          </label>
          <Input
            required
            type="number"
            step="0.01"
            value={formData.liters}
            onChange={(e) =>
              setFormData({ ...formData, liters: e.target.value })
            }
            className="mt-1 w-full"
            placeholder="0.00"
          />
        </div>

        {/* Monto Total */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Monto Total
          </label>
          <Input
            required
            type="number"
            step="0.1"
            value={formData.totalAmount}
            onChange={(e) =>
              setFormData({ ...formData, totalAmount: e.target.value })
            }
            className="mt-1 w-full"
            placeholder="Ej: $999"
          />
        </div>

        {/* Kilometros */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Kilómetros
          </label>
          <Input
            required
            type="number"
            step="1"
            value={formData.kilometers}
            onChange={(e) =>
              setFormData({ ...formData, kilometers: e.target.value })
            }
            className="mt-1 w-full"
            placeholder="Ej: 10000"
          />
        </div>

        {/* Estación de Servicio */}
        <div>
          <label className="text-sm font-medium text-gray-700">
            Estación de Servicio
          </label>
          <select
            required
            value={formData.serviceStation}
            onChange={(e) =>
              setFormData({ ...formData, serviceStation: e.target.value })
            }
            className="w-full mt-1 border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[#213b5d]"
          >
            <option value="YPF">YPF</option>
            <option value="GOTTIG">GOTTIG</option>
            <option value="AGRO">AGRO</option>
            <option value="AXION">AXION</option>
            <option value="LA PAZ">LA PAZ</option>
            <option value="OTRA">OTRA</option>
          </select>
        </div>

        {/* Método de Pago - Mostrar solo si es nueva carga o si ya tiene valor */}
        {(defaultValues || formData.paymentMethod) && (
          <div>
            <label className="text-sm font-medium text-gray-700">
              Método de Pago
            </label>
            <select
              required
              value={formData.paymentMethod || "TARJETA"} // Si es edición pero no tiene valor, usar "TARJETA"
              onChange={(e) =>
                setFormData({ ...formData, paymentMethod: e.target.value })
              }
              className="w-full mt-1 border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[#213b5d]"
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
            </select>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto bg-[#213b5d] hover:bg-[#b44d35]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Cargando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
};

export default NewLoadForm;