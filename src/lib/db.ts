import { DocumentoVehiculo } from "../types";

// Pequeño wrapper sobre IndexedDB para guardar documentos (metadata + PDF) 100% local.
// No se sube nada a ningún servidor: todo vive en el navegador del usuario.

const DB_NAME = "autodata_mg350";
const DB_VERSION = 1;
const STORE_META = "documentos";
const STORE_FILES = "archivos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES); // key = documento.id, value = Blob
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarDocumento(meta: DocumentoVehiculo, archivo: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_FILES], "readwrite");
    tx.objectStore(STORE_META).put(meta);
    tx.objectStore(STORE_FILES).put(archivo, meta.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listarDocumentos(): Promise<DocumentoVehiculo[]> {
  const db = await openDb();
  const result = await new Promise<DocumentoVehiculo[]>((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readonly");
    const req = tx.objectStore(STORE_META).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result.sort((a, b) => (a.fechaVencimiento || "9999").localeCompare(b.fechaVencimiento || "9999"));
}

export async function obtenerArchivo(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  const result = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, "readonly");
    const req = tx.objectStore(STORE_FILES).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function eliminarDocumento(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_META, STORE_FILES], "readwrite");
    tx.objectStore(STORE_META).delete(id);
    tx.objectStore(STORE_FILES).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
