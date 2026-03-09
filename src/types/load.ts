// types/load.ts
export interface LoadData {
  id?: string;
  empresaId: string;
  driverName: string;
  driverDni: number;
  licensePlate: string;
  serviceStation: string;
  totalAmount: number;
  liters: number;
  kilometers: number;
  date: Date;
  paymentMethod?: string;
}