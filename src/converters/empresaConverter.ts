import { Empresa } from "@/types/empresa";
import { FirestoreDataConverter } from "firebase/firestore";

export const empresaConverter: FirestoreDataConverter<Empresa> = {
  toFirestore: (empresa: Empresa) => ({
    cuit: empresa.cuit.replace(/\D/g, ""),
    nombre: empresa.nombre,
    razonSocial: empresa.razonSocial || null,
    telefono: empresa.telefono || null,
    logoUrl: empresa.logoUrl || null,
    createdAt: empresa.createdAt || new Date(),
    createdBy: empresa.createdBy ?? null,
  }),
  fromFirestore: (snapshot): Empresa => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      cuit: data.cuit || "",
      nombre: data.nombre,
      razonSocial: data.razonSocial,
      telefono: data.telefono,
      logoUrl: data.logoUrl ?? undefined,
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      createdBy: data.createdBy ?? undefined,
    };
  },
};
