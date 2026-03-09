// types/empresa.ts
export interface Empresa {
  id?: string;
  cuit: string;
  nombre: string;
  razonSocial?: string;
  telefono?: string;
  logoUrl?: string;
  createdAt?: Date;
  createdBy?: string;
}
