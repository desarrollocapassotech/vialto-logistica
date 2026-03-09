import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import { Check, Loader, PlusCircle } from "lucide-react";

interface UserData {
  id?: string;
  patente: string;
  dni: number;
  lastName: string;
  name: string;
  pass: string;
  role: string;
  empresaId?: string;
}

interface UserManagementProps {
  filter: string;
  empresaId: string | null;
}

const UserManagement = ({ filter, empresaId }: UserManagementProps) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editUser, setEditUser] = useState<UserData | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false); // Estado para el diálogo de confirmación
    const [formData, setFormData] = useState<Omit<UserData, "id"> | null>(null); // Datos del formulario para confirmación
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false); // Estado para el diálogo de eliminación
    const [userToDelete, setUserToDelete] = useState<string | null>(null); // ID del chofer a eliminar
    const [isLoading, setIsLoading] = useState(true); // Estado de carga

    useEffect(() => {
        const fetchUsers = async () => {
            if (!empresaId) return;
            setIsLoading(true);
            try {
                const usersQuery = query(
                    collection(db, "usuarios"),
                    where("empresaId", "==", empresaId),
                    where("role", "==", "CHOFER")
                );
                const querySnapshot = await getDocs(usersQuery);
                const usersData = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as UserData[];
                setUsers(usersData);
            } catch (error) {
                console.error("Error al obtener choferes:", error);
                toast.error("Error al cargar choferes");
            } finally {
                setIsLoading(false);
            }
        };
        fetchUsers();
    }, [empresaId]);

    // Filtrar choferes según el término de búsqueda
    const filteredUsers = users.filter(
        (user) =>
            user.name.toLowerCase().includes(filter.toLowerCase()) ||
            user.lastName.toLowerCase().includes(filter.toLowerCase()) ||
            user.dni!.toString().toLowerCase().includes(filter.toLowerCase())
    );

    const validateDni = async (dni: number) => {
        if (!empresaId) return false;
        try {
            const dniQuery = query(
                collection(db, "usuarios"),
                where("empresaId", "==", empresaId),
                where("dni", "==", dni)
            );
            const querySnapshot = await getDocs(dniQuery);
            return querySnapshot.empty;
        } catch (error) {
            console.error("Error al validar DNI:", error);
            toast.error("Error al validar DNI");
            return false;
        }
    };

    const validatePatente = async (patente: string) => {
        if (!empresaId) return false;
        try {
            const patenteQuery = query(
                collection(db, "usuarios"),
                where("empresaId", "==", empresaId),
                where("patente", "==", patente)
            );
            const querySnapshot = await getDocs(patenteQuery);
            return querySnapshot.empty;
        } catch (error) {
            console.error("Error al validar patente:", error);
            toast.error("Error al validar patente");
            return false;
        }
    };

    // Manejar el alta o edición de un chofer
    const handleSaveUser = async (data: Omit<UserData, "id">) => {
        setIsLoading(true);
        setIsFormOpen(false); 
        try {
            // Validar el DNI solo si es un nuevo registro
            if (!editUser) {
                const isDniValid = await validateDni(data.dni);
                if (!isDniValid) {
                    toast.error("El DNI ingresado ya está registrado");
                    return; // Detener el proceso si el DNI ya existe
                }

                // Validar la patente y mostrar mensaje de confirmación si ya existe
                const isPatenteValid = await validatePatente(data.patente);
                if (!isPatenteValid) {
                    // Mostrar el diálogo de confirmación
                    setFormData(data);
                    setShowConfirmation(true);
                    return;
                }
            }

            // Continuar con el guardado si no hay problemas
            saveUserData(data);
        } catch (error) {
            console.error("Error al manejar el chofer:", error);
            toast.error("Error al registrar o actualizar el chofer");
        } finally {
            setIsLoading(false);
        }
    };

    // Guardar los datos del usuario
    const saveUserData = async (data: Omit<UserData, "id">) => {
        try {
            if (editUser) {
                // Modificar un chofer existente
                const userDocRef = doc(db, "usuarios", editUser.id!);
                await updateDoc(userDocRef, data);
                setUsers((prev) => prev.map((user) => (user.id === editUser.id ? { ...user, ...data } : user)));
                toast.success("Chofer actualizado exitosamente");
            } else {
                if (!empresaId) {
                    toast.error("No hay empresa seleccionada");
                    return;
                }
                const newUser = { ...data, role: "CHOFER", empresaId };
                const newUserRef = await addDoc(collection(db, "usuarios"), newUser);
                setUsers((prev) => [...prev, { id: newUserRef.id, ...newUser }]);
                toast.success("Chofer registrado exitosamente");
            }

            setIsFormOpen(false);
            setEditUser(null);
        } catch (error) {
            console.error("Error al guardar el chofer:", error);
            toast.error("Error al registrar o actualizar el chofer");
        }
    };

    // Manejar la eliminación de un chofer
    const handleDeleteUser = async () => {
        try {
            if (userToDelete) {
                const userDocRef = doc(db, "usuarios", userToDelete);
                await deleteDoc(userDocRef);
                setUsers((prev) => prev.filter((user) => user.id !== userToDelete));
                toast.success("Chofer eliminado exitosamente");
            }
        } catch (error) {
            console.error("Error al eliminar el usuario:", error);
            toast.error("Error al eliminar el usuario");
        } finally {
            setDeleteConfirmationOpen(false);
            setUserToDelete(null);
        }
    };

    if (!empresaId) {
        return <p className="text-center text-gray-500">Cargando...</p>;
    }
    if (isLoading) {
        return <p>Cargando choferes...</p>;
    }

    return (
        <div className="space-y-4">
            {/* Botón para agregar un nuevo chofer */}
            <Button
                onClick={() => {
                    setEditUser(null);
                    setIsFormOpen(true);
                }}
                className="w-full bg-[#213b5d] hover:bg-[#b44d35]"
            >
                <PlusCircle size={20} />
                Agregar Chofer
            </Button>

            {/* Lista de choferes */}
            {filteredUsers.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No hay choferes registrados</div>
            ) : (
                filteredUsers.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-medium text-gray-900">{`${user.name} ${user.lastName}`}</h3>
                                <p className="text-sm text-gray-500">{user.dni}</p>
                                <p className="text-sm text-gray-500">{user.patente}</p> {/* Mostrar la patente */}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{user.role}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                className="text-blue-600 hover:underline"
                                onClick={() => {
                                    setEditUser(user);
                                    setIsFormOpen(true);
                                }}
                            >
                                Editar
                            </button>
                            <button
                                className="text-red-600 hover:underline"
                                onClick={() => {
                                    setUserToDelete(user.id!);
                                    setDeleteConfirmationOpen(true);
                                }}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                ))
            )}

            {/* Modal para el formulario */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editUser ? "Editar Chofer" : "Nuevo Chofer"}</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            let name: any = e.currentTarget.name;
                            const formData: any = {
                                dni: parseInt(e.currentTarget.dni.value, 10),
                                lastName: e.currentTarget.lastName.value,
                                name: name.value,
                                pass: e.currentTarget.pass.value,
                                patente: e.currentTarget.patente.value,
                            };
                            handleSaveUser(formData);
                        }}
                    >
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">DNI del chofer</label>
                            <Input
                                type="text"
                                name="dni"
                                defaultValue={editUser?.dni || ""}
                                required
                                className="mt-1 block w-full border-gray-300 focus:border-[#213b5d]"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">Apellido del chofer</label>
                            <Input
                                type="text"
                                name="lastName"
                                defaultValue={editUser?.lastName || ""}
                                required
                                className="mt-1 block w-full border-gray-300 focus:border-[#213b5d]"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">Nombre del chofer</label>
                            <Input
                                type="text"
                                name="name"
                                defaultValue={editUser?.name || ""}
                                required
                                className="mt-1 block w-full border-gray-300 focus:border-[#213b5d]"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">Patente del vehículo asignado</label>
                            <Input
                                type="text"
                                name="patente"
                                defaultValue={editUser?.patente || ""}
                                required
                                className="mt-1 block w-full border-gray-300 focus:border-[#213b5d]"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">PIN para iniciar sesión (4 dígitos) </label>
                            <Input
                                type="text" // Mantenemos "text" para tener más control sobre la validación
                                name="pass"
                                defaultValue={editUser?.pass || ""}
                                required
                                inputMode="numeric" // Indica que el teclado debe ser numérico en dispositivos móviles
                                pattern="\d{1,4}" // Asegura que solo se ingresen números y máximo 4 dígitos
                                maxLength={4} // Limita la longitud a 4 caracteres
                                onChange={(e) => {
                                    // Validar que solo se ingresen números y máximo 4 dígitos
                                    const value = e.target.value;
                                    if (!/^\d*$/.test(value)) {
                                        e.target.value = value.replace(/\D/g, ""); // Eliminar caracteres no numéricos
                                    }
                                    if (value.length > 4) {
                                        e.target.value = value.slice(0, 4); // Limitar a 4 dígitos
                                    }
                                }}
                                className="mt-1 block w-full border-gray-300 focus:border-[#213b5d]"
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" className="px-4 py-2 bg-[#213b5d] text-white rounded" disabled={isLoading}>
                                Guardar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Diálogo de confirmación para eliminar un chofer */}
            <Dialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmación</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-700">
                        ¿Estás seguro de que deseas eliminar este chofer?
                    </p>
                    <DialogFooter>
                        <Button
                            onClick={handleDeleteUser}
                            className="bg-red-600 text-white"
                        >
                            Eliminar
                        </Button>
                        <Button
                            onClick={() => {
                                setDeleteConfirmationOpen(false);
                                setUserToDelete(null);
                            }}
                            className="bg-gray-300 text-black"
                        >
                            Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo de confirmación de patente duplicada */}
            <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmación</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-700">
                        Ya existe un chofer con la patente ingresada. ¿Desea continuar?
                    </p>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                setShowConfirmation(false);
                                if (formData) saveUserData(formData); // Continuar con el guardado
                            }}
                            className="bg-[#213b5d] text-white"
                        >
                            <Check size={20} />
                            Continuar
                        </Button>
                        <Button
                            onClick={() => setShowConfirmation(false)}
                            className="bg-gray-300 text-black"
                        >
                            Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagement;