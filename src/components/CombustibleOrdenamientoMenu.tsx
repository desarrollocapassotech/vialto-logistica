import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "lucide-react";
import {
  COMBUSTIBLE_SORT_FIELDS,
  COMBUSTIBLE_SORT_LABELS,
  etiquetaDirAsc,
  etiquetaDirDesc,
  etiquetaCombustibleOrdenamiento,
  type CombustibleSortDir,
  type CombustibleSortField,
} from "@/lib/combustibleOrdenamiento";

type Props = {
  sortBy: CombustibleSortField;
  sortDir: CombustibleSortDir;
  disabled?: boolean;
  onChange: (sortBy: CombustibleSortField, sortDir: CombustibleSortDir) => void;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function CombustiblesOrdenamientoMenu({
  sortBy,
  sortDir,
  disabled,
  onChange,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!abierto || isMobile) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto, isMobile]);

  useEffect(() => {
    if (!abierto || !isMobile) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, isMobile]);

  function seleccionarCampo(field: CombustibleSortField) {
    onChange(field, "desc");
    setAbierto(false);
  }

  function seleccionarDir(field: CombustibleSortField, dir: CombustibleSortDir) {
    onChange(field, dir);
    setAbierto(false);
  }

  const DirIcon = sortDir === "desc" ? ArrowDown : ArrowUp;

  const trigger = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setAbierto((v) => !v)}
      aria-haspopup="listbox"
      aria-expanded={abierto}
      aria-label={`Ordenar por: ${etiquetaCombustibleOrdenamiento(sortBy, sortDir)}`}
      className="inline-flex h-12 sm:h-10 w-full sm:w-auto items-center justify-between sm:justify-start gap-2 rounded-xl sm:rounded-md border-2 sm:border border-gray-200 bg-white px-4 sm:px-3 text-base sm:text-sm font-medium sm:font-normal text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <ArrowUpDown className="h-5 w-5 sm:h-4 sm:w-4 shrink-0 text-gray-400 sm:text-gray-500" aria-hidden />
        <span className="truncate">
          {COMBUSTIBLE_SORT_LABELS[sortBy]}
        </span>
      </div>
      <DirIcon className="h-5 w-5 sm:h-4 sm:w-4 shrink-0 text-[#E8470A]" aria-hidden />
    </button>
  );

  function renderOpciones(mobile: boolean) {
    return COMBUSTIBLE_SORT_FIELDS.map((field) => {
      const activo = field === sortBy;
      const pillClass = mobile
        ? "inline-flex flex-1 items-center justify-center gap-2 rounded min-h-11 px-3 text-sm transition-colors"
        : "inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors";
      return (
        <li key={field} role="option" aria-selected={activo}>
          {activo ? (
            <div className="bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[#E8470A]"
                  aria-hidden
                />
                <p className="text-sm font-medium text-gray-900">
                  {COMBUSTIBLE_SORT_LABELS[field]}
                </p>
              </div>
              <div
                className={`mt-2 flex gap-2 ${mobile ? "" : "flex-wrap gap-1.5 pl-5"}`}
              >
                <button
                  type="button"
                  onClick={() => seleccionarDir(field, "desc")}
                  className={`${pillClass} border ${
                    sortDir === "desc"
                      ? "border-[#E8470A] bg-[#E8470A] text-white"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {etiquetaDirDesc(field)}
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarDir(field, "asc")}
                  className={`${pillClass} border ${
                    sortDir === "asc"
                      ? "border-[#E8470A] bg-[#E8470A] text-white"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {etiquetaDirAsc(field)}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => seleccionarCampo(field)}
              className={`flex w-full items-center px-4 text-left text-sm text-gray-700 hover:bg-gray-50 ${
                mobile ? "min-h-14" : "py-2.5"
              }`}
            >
              {COMBUSTIBLE_SORT_LABELS[field]}
            </button>
          )}
        </li>
      );
    });
  }

  const mobileModal =
    abierto && isMobile
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
            role="presentation"
            onClick={() => setAbierto(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Ordenar combustibles"
              className="flex w-full flex-col overflow-hidden rounded-t-xl sm:rounded-xl border border-black/10 bg-white shadow-xl sm:max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Ordenar combustibles
                </h2>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="inline-flex h-11 w-11 items-center justify-center text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  ×
                </button>
              </div>

              <ul
                role="listbox"
                aria-label="Criterio de ordenamiento"
                className="divide-y divide-gray-100"
              >
                {renderOpciones(true)}
              </ul>

              <div className="shrink-0 border-t border-gray-200 p-4">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="inline-flex min-h-11 w-full items-center justify-center bg-[#E8470A] rounded-md px-4 text-sm font-semibold text-white transition-colors hover:bg-[#FF6B2B]"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const desktopDropdown =
    abierto && !isMobile ? (
      <ul
        role="listbox"
        aria-label="Criterio de ordenamiento"
        className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
      >
        {renderOpciones(false)}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {mobileModal}
      {desktopDropdown}
    </div>
  );
}
