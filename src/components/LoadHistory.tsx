import { useState } from "react";
import { LoadData } from "@/types/load";

interface LoadHistoryProps {
  loads: LoadData[];
  filter: string;
  onEdit: (load: LoadData) => void;
  onDelete: (id: string) => void;
}

const ITEMS_PER_PAGE = 10;

const LoadHistory = ({ loads, filter, onEdit, onDelete }: LoadHistoryProps) => {
  // Filtrar las cargas según el término de búsqueda
  const filteredLoads = loads.filter(
    (load) =>
      load.driverName.toLowerCase().includes(filter.toLowerCase()) ||
      load.licensePlate.toLowerCase().includes(filter.toLowerCase())
  );

  // Si no hay cargas registradas o filtradas, mostrar un mensaje
  if (filteredLoads.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No hay cargas registradas
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vista de tabla para desktop */}
      <div className="hidden md:block overflow-x-auto">
        <TableComponent
          filteredLoads={filteredLoads}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Vista de tarjetas para móvil */}
      <div className="block md:hidden space-y-4">
        {filteredLoads.map((load) => (
          <CardItem
            key={load.id}
            load={load}
            onEdit={() => onEdit(load)}
            onDelete={() => {
              const isConfirmed = window.confirm(
                "¿Estás seguro de que deseas eliminar esta carga?"
              );
              if (isConfirmed) onDelete(load.id);
            }}
          />
        ))}
      </div>
    </div>
  );
};

// --- Componentes internos ---

// Tarjeta para móvil
const CardItem = ({
  load,
  onEdit,
  onDelete,
}: {
  load: any;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
    <div className="flex justify-between items-start">
      <div>
        <h3 className="font-medium text-gray-900">{load.driverName}</h3>
        <p className="text-sm text-gray-500">{load.licensePlate}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">
          ${load.totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 0 })}
        </p>
        <p className="text-sm text-gray-500">
          {load.liters.toLocaleString("es-ES", { minimumFractionDigits: 0 })} L
        </p>
        <p className="text-sm text-gray-500">
          {load.kilometers.toLocaleString("es-ES", { minimumFractionDigits: 0 })} Km
        </p>
      </div>
    </div>
    <p className="text-xs text-gray-500 mt-2">
      {new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(load.date))}
    </p>
    <div className="flex justify-end gap-2 mt-2">
      <button onClick={onEdit} className="text-blue-600 hover:underline">
        Editar
      </button>
      <button onClick={onDelete} className="text-red-600 hover:underline">
        Eliminar
      </button>
    </div>
  </div>
);

// Tabla para desktop
const TableComponent = ({
  filteredLoads,
  onEdit,
  onDelete,
}: {
  filteredLoads: any[];
  onEdit: (load: any) => void;
  onDelete: (id: string) => void;
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(filteredLoads.length / ITEMS_PER_PAGE);
  const paginatedLoads = filteredLoads.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <>
      <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="px-4 py-2 text-sm font-semibold text-gray-700">Chofer</th>
            <th className="px-4 py-2 text-sm font-semibold text-gray-700">Patente</th>
            <th className="px-4 py-2 text-sm font-semibold text-gray-700">Litros</th>
            <th className="px-4 py-2 text-sm font-semibold text-gray-700">Km</th>
            <th className="px-4 py-2 text-sm font-semibold text-gray-700">Monto</th>
            <th className="px-4 py-2 text-sm font-semibold text-gray-700">Fecha</th>
            <th className="px-4 py-2 text-sm font-semibold text-gray-700">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {paginatedLoads.map((load) => (
            <tr key={load.id} className="border-t hover:bg-gray-50">
              <td className="px-4 py-2">{load.driverName}</td>
              <td className="px-4 py-2">{load.licensePlate}</td>
              <td className="px-4 py-2">
                {load.liters.toLocaleString("es-ES", { minimumFractionDigits: 0 })} L
              </td>
              <td className="px-4 py-2">
                {load.kilometers.toLocaleString("es-ES", { minimumFractionDigits: 0 })} Km
              </td>
              <td className="px-4 py-2">
                ${load.totalAmount.toLocaleString("es-ES", { minimumFractionDigits: 0 })}
              </td>
              <td className="px-4 py-2">
                {new Intl.DateTimeFormat("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(load.date))}
              </td>
              <td className="px-4 py-2 flex gap-2">
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => onEdit(load)}
                >
                  Editar
                </button>
                <button
                  className="text-red-600 hover:underline"
                  onClick={() => {
                    const isConfirmed = window.confirm(
                      "¿Estás seguro de que deseas eliminar esta carga?"
                    );
                    if (isConfirmed) onDelete(load.id);
                  }}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </>
  );
};

export default LoadHistory;