// types/user.ts
export type UserRole = "CHOFER" | "ADMIN" | "SUPER_ADMIN";

export interface User {
  name: string;
  lastName: string;
  patente?: string; // Solo choferes
  dni?: number; // Choferes y algunos admins
  role: UserRole;
  empresaId: string | null; // null solo para SUPER_ADMIN
  email?: string;
  pass?: string; // Solo choferes con login DNI+pass
}