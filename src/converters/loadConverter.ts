import { LoadData } from "@/types/load";
import { FirestoreDataConverter } from "firebase/firestore";

export const loadConverter: FirestoreDataConverter<LoadData> = {
  toFirestore: (load: LoadData) => ({
    empresaId: load.empresaId,
    driverName: load.driverName,
    driverDni: load.driverDni,
    licensePlate: load.licensePlate,
    serviceStation: load.serviceStation,
    totalAmount: load.totalAmount,
    liters: load.liters,
    kilometers: load.kilometers,
    date: load.date,
    paymentMethod: load.paymentMethod ?? null,
  }),
  fromFirestore: (snapshot): LoadData => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      empresaId: data.empresaId,
      driverName: data.driverName,
      driverDni: data.driverDni,
      licensePlate: data.licensePlate,
      serviceStation: data.serviceStation,
      totalAmount: data.totalAmount,
      liters: data.liters,
      kilometers: data.kilometers,
      date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
      paymentMethod: data.paymentMethod || undefined,
    };
  },
};