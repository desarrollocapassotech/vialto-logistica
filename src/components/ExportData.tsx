import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { LoadData } from "@/types/load";
import { DownloadCloud } from "lucide-react";

interface ExportDataProps {
  loads: LoadData[];
}

const ExportData = ({ loads }: ExportDataProps) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Función para eliminar duplicados basados en todos los campos
  const removeDuplicates = (data: LoadData[]) => {
    const seen = new Set();
    return data.filter((item) => {
      // Generar un identificador único combinando todos los campos
      const identifier = `${item.licensePlate}-${new Date(item.date).toISOString().split("T")[0]}-${item.liters}-${item.totalAmount}-${item.kilometers}-${item.serviceStation}-${item.driverName}`;
      if (seen.has(identifier)) {
        return false; // Si ya se ha visto este identificador, es un duplicado
      }
      seen.add(identifier); // Marcar como visto
      return true;
    });
  };

  const handleExport = () => {
    if (!startDate || !endDate) {
      toast.error("Por favor seleccione un rango de fechas");
      return;
    }

    // Filtrar cargas por rango de fechas
    const filteredLoads = loads.filter((load) => {
      const loadDate = new Date(load.date).toISOString().split("T")[0];
      const start = new Date(startDate).toISOString().split("T")[0];
      const end = new Date(endDate).toISOString().split("T")[0];

      return loadDate >= start && loadDate <= end;
    });

    if (filteredLoads.length === 0) {
      toast.error("No hay datos para exportar en el rango seleccionado");
      return;
    }

    // Eliminar duplicados
    const uniqueLoads = removeDuplicates(filteredLoads);

    if (uniqueLoads.length === 0) {
      toast.error("No hay datos únicos para exportar en el rango seleccionado");
      return;
    }

    // Crear hoja de Excel
    const worksheet = XLSX.utils.json_to_sheet(
      uniqueLoads.map((load) => ({
        "DOMINIO": load.licensePlate,
        "FECHA": new Intl.DateTimeFormat("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC"
        }).format(new Date(load.date)),
        "LITROS": load.liters,
        "MONTO": load.totalAmount,
        "KILOMETROS": load.kilometers,
        "LUGAR (NOMBRE)": load.serviceStation,
        "CHOFER": load.driverName,
        "PAGO": load.paymentMethod
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cargas");

    XLSX.writeFile(workbook, `cargas-combustible-${startDate}-${endDate}.xlsx`);
    toast.success("Datos exportados exitosamente");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Exportar Datos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Fecha Inicio</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Fecha Fin</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <Button
        onClick={handleExport}
        className="w-full bg-[#213b5d] hover:bg-[#b44d35]"
      >
        <DownloadCloud size={20} />
        Exportar a Excel
      </Button>
    </div>
  );
};

export default ExportData;