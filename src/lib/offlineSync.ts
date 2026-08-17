/**
 * Sincronización de la cola offline (COMB-07-T3): sube al backend, en orden
 * cronológico (más antigua primero), las cargas guardadas localmente por
 * offlineQueue.ts. Reutiliza el mismo flujo de creación que el alta online
 * (uploadFoto/createCarga en cargas.ts) para no duplicar lógica.
 *
 * Manejo de errores (COMB-07-T4): un error propio de una carga (rechazada
 * por el backend, ej. validación de km) no bloquea al resto de la cola — se
 * marca esa carga puntual, se reporta al backend para que quede registrada
 * para revisión del administrador, y se sigue con las siguientes. Un error
 * de red sí corta todo el intento (no tiene sentido seguir pidiendo al
 * backend sin conexión, ni marcar como "error" cargas que nunca se llegaron
 * a intentar).
 */

import { isNetworkError, TokenGetter } from "./api";
import { CargaApi, CargaPayload, createCarga, reportSyncError, uploadFoto } from "./cargas";
import { extractApiErrorMessage } from "./loadFormat";
import {
  PendingLoad,
  PendingLoadPhoto,
  clearPendingLoadError,
  deletePendingLoad,
  getPendingLoads,
  markPendingLoadError,
  updatePendingLoadPhoto,
} from "./offlineQueue";

// Mensaje crudo, sin traducir: se guarda en IndexedDB y se reporta al backend
// tal cual. La traducción para mostrarle al chofer se aplica en la UI (Index.tsx).
function syncErrorMessage(error: unknown): string {
  return extractApiErrorMessage(error, "No se pudo sincronizar la carga.");
}

/**
 * Marca localmente el error y lo reporta al backend (best-effort: si el
 * reporte falla —ej. sin conexión justo en ese momento— no debe impedir que
 * la carga quede igual marcada localmente ni cortar la sincronización).
 */
async function recordSyncError(
  pending: PendingLoad,
  message: string,
  getToken: TokenGetter,
): Promise<void> {
  await markPendingLoadError(pending.localId, message);
  try {
    const payloadConLocalId = {
      ...pending.payload,
      localId: pending.localId,
      createdAt: pending.createdAt,
    };
    await reportSyncError(
      message,
      payloadConLocalId,
      getToken,
    );
  } catch (error) {
    console.error(
      `No se pudo reportar al backend el error de sincronización de la carga ${pending.localId}:`,
      error,
    );
  }
}

async function resolvePhotoUrl(
  localId: string,
  field: "fotoTacometro" | "fotoTicket",
  photo: PendingLoadPhoto,
  tipo: "tacometro" | "ticket",
  getToken: TokenGetter,
): Promise<string> {
  if (photo.kind === "url") return photo.url;
  const url = await uploadFoto(photo.blob, tipo, getToken);
  // Se persiste apenas se sube: si el paso siguiente (crear la carga) falla y
  // la sincronización se detiene, la próxima corrida no vuelve a subirla.
  await updatePendingLoadPhoto(localId, field, { kind: "url", url });
  return url;
}

async function syncOneLoad(
  pending: PendingLoad,
  getToken: TokenGetter,
): Promise<CargaApi> {
  const fotoTacometro = await resolvePhotoUrl(
    pending.localId,
    "fotoTacometro",
    pending.fotoTacometro,
    "tacometro",
    getToken,
  );
  const fotoTicket = await resolvePhotoUrl(
    pending.localId,
    "fotoTicket",
    pending.fotoTicket,
    "ticket",
    getToken,
  );

  const payload: CargaPayload = {
    ...pending.payload,
    fotoTacometro,
    fotoTicket,
    localId: pending.localId,
    createdAt: pending.createdAt,
  };

  const created = await createCarga(payload, getToken);
  try {
    await deletePendingLoad(pending.localId);
  } catch (error) {
    // La carga ya quedó creada en el backend: si no se puede borrar de la
    // cola local, la próxima sincronización la va a reintentar y puede
    // duplicarla. Se deja constancia explícita en consola porque, a
    // diferencia del resto de los errores de este loop, este no es "todavía
    // no se sincronizó" sino "se sincronizó pero quedó mal registrado local".
    console.error(
      `La carga ${pending.localId} se creó en el backend (id ${created.id}) pero no se pudo quitar de la cola local. La próxima sincronización podría reintentarla y crear un duplicado.`,
      error,
    );
    throw error;
  }
  return created;
}

/**
 * Sincroniza, en orden FIFO, las cargas pendientes del chofer, y devuelve
 * cuántas se sincronizaron con éxito.
 *
 * Por defecto (`skipErrored: true`, el usado por la sincronización
 * automática) no reintenta las cargas que ya quedaron marcadas con un error
 * propio en un intento anterior: si se reintentaran solas en cada
 * reconexión, una red inestable terminaría repitiendo contra el backend un
 * pedido que ya sabemos que va a fallar. Esas cargas solo se reintentan a
 * demanda (ver retryPendingLoad, disparado por el botón "Reintentar").
 *
 * `onLoadError` es opcional porque quien llama a esta función puede no tener
 * estado de UI que sincronizar (por ahora el único caller, useOfflineSync,
 * siempre lo pasa) — se invoca por cada carga marcada con error, para que el
 * caller pueda reflejar ese error en su propio estado sin esperar a un
 * refresh completo de la cola.
 */
export async function syncPendingLoads(
  driverDni: number,
  getToken: TokenGetter,
  onLoadSynced: (pending: PendingLoad, created: CargaApi) => void,
  options: {
    skipErrored?: boolean;
    onLoadError?: (pending: PendingLoad, message: string) => void;
  } = {},
): Promise<number> {
  const { skipErrored = true, onLoadError } = options;
  const allPending = await getPendingLoads(driverDni);
  const pendingLoads = skipErrored
    ? allPending.filter((p) => !p.lastError)
    : allPending;
  let syncedCount = 0;

  for (const pending of pendingLoads) {
    try {
      const created = await syncOneLoad(pending, getToken);
      syncedCount++;
      onLoadSynced(pending, created);
    } catch (error) {
      if (isNetworkError(error)) {
        console.error(
          "Sincronización de cargas pendientes detenida por un error de red:",
          error,
        );
        break;
      }
      // Error propio de esta carga (rechazada por el backend): se marca y se
      // sigue con el resto de la cola en vez de bloquearla por completo.
      console.error(
        `La carga ${pending.localId} no se pudo sincronizar:`,
        error,
      );
      const message = syncErrorMessage(error);
      await recordSyncError(pending, message, getToken);
      onLoadError?.(pending, message);
    }
  }

  return syncedCount;
}

/** Reintento manual de una única carga pendiente (botón "Reintentar", COMB-07-T4). */
export async function retryPendingLoad(
  pending: PendingLoad,
  getToken: TokenGetter,
): Promise<CargaApi> {
  await clearPendingLoadError(pending.localId);
  try {
    return await syncOneLoad(pending, getToken);
  } catch (error) {
    // Un error de red no es un problema de la carga en sí: se deja sin marcar
    // para que la sincronización automática la retome sola al reconectar.
    if (!isNetworkError(error)) {
      await recordSyncError(pending, syncErrorMessage(error), getToken);
    }
    throw error;
  }
}
