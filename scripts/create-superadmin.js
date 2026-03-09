/**
 * Script para crear el super administrador.
 * Requiere: descargar la clave de cuenta de servicio desde Firebase Console
 * y guardarla como serviceAccountKey.json en la raíz del proyecto.
 *
 * Ejecutar: node scripts/create-superadmin.js
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const EMAIL = "contacto@capasso.tech";
const PASSWORD = "38442199";

const keyPath = join(rootDir, "serviceAccountKey.json");
if (!existsSync(keyPath)) {
  console.error(
    "❌ No se encontró serviceAccountKey.json.\n" +
      "Descargá la clave de cuenta de servicio desde Firebase Console:\n" +
      "1. Proyecto > Configuración > Cuentas de servicio\n" +
      "2. Generar nueva clave privada\n" +
      "3. Guardar como serviceAccountKey.json en la raíz del proyecto"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

async function createSuperAdmin() {
  try {
    let user;
    try {
      user = await auth.createUser({
        email: EMAIL,
        password: PASSWORD,
        displayName: "Super Admin",
        emailVerified: true,
      });
      console.log("✅ Usuario de Auth creado:", user.uid);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        user = await auth.getUserByEmail(EMAIL);
        await auth.updateUser(user.uid, { password: PASSWORD });
        console.log("✅ Usuario de Auth ya existía. Contraseña actualizada.");
      } else throw err;
    }

    await db.collection("usuarios").doc(user.uid).set({
      name: "Super",
      lastName: "Admin",
      email: EMAIL,
      role: "SUPER_ADMIN",
      empresaId: null,
    });
    console.log("✅ Documento en Firestore creado/actualizado.");

    console.log("\n🎉 Super admin listo. Credenciales:");
    console.log("   Email:", EMAIL);
    console.log("   Contraseña:", PASSWORD);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

createSuperAdmin();
