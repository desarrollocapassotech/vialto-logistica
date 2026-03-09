import { User } from "@/types/user";
import { FirestoreDataConverter } from "firebase/firestore";

export const userConverter: FirestoreDataConverter<User> = {
  toFirestore: (user: User) => ({
    name: user.name,
    lastName: user.lastName,
    patente: user.patente ?? null,
    dni: user.dni ?? null,
    role: user.role,
    empresaId: user.empresaId ?? null,
    email: user.email ?? null,
    pass: user.pass ?? null,
  }),
  fromFirestore: (snapshot): User => {
    const data = snapshot.data();
    return {
      name: data.name,
      lastName: data.lastName,
      patente: data.patente,
      dni: data.dni,
      role: data.role,
      empresaId: data.empresaId ?? null,
      email: data.email,
      pass: data.pass,
    };
  },
};