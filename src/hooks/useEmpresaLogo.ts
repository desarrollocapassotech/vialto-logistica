import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { empresaConverter } from "@/converters/empresaConverter";

/** Obtiene la URL del logo de una empresa. Retorna undefined mientras carga. */
export function useEmpresaLogo(empresaId: string | null): string | null | undefined {
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!empresaId) {
      setLogoUrl(null);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, "empresas", empresaId).withConverter(empresaConverter))
      .then((snap) => {
        if (cancelled) return;
        setLogoUrl(snap.exists() ? snap.data()?.logoUrl ?? null : null);
      })
      .catch(() => {
        if (!cancelled) setLogoUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [empresaId]);

  return logoUrl;
}
