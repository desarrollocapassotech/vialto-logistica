# Migración a Multi-Empresa

> **Seguridad**: Las reglas de Firestore permiten lectura/escritura sin autenticación. El control de acceso se hace en la app. Cualquiera con acceso a la consola de Firebase podría ver o modificar datos. Para entornos sensibles, conviene usar Cloud Functions y reglas más restrictivas.

## Estructura de la base de datos

### Colección `empresas`
- `cuit`: string (10-11 dígitos, identificador único)
- `nombre`: string
- `razonSocial`: string (opcional)
- `telefono`: string (opcional)
- `createdAt`: timestamp
- `createdBy`: string (uid del creador)

### Colección `usuarios`
- `name`, `lastName`, `dni`, `role`, `empresaId`
- `patente`, `pass` (solo choferes creados por admin)
- `email` (admins)
- **empresaId**: string | null (null solo para SUPER_ADMIN)

### Colección `cargas`
- Todos los campos anteriores + **empresaId**: string

## Crear el primer Super Administrador

**Opción automática (recomendada):**

1. Descargá la clave de cuenta de servicio desde [Firebase Console](https://console.firebase.google.com):
   - Proyecto → Configuración (engranaje) → Cuentas de servicio
   - Generar nueva clave privada
   - Guardá el archivo como `serviceAccountKey.json` en la raíz del proyecto

2. Ejecutá:
   ```bash
   npm run create-superadmin
   ```
   Esto crea el super admin con: `contacto@capasso.tech` / contraseña configurada en el script.

**Opción manual** (sin script):

1. Creá un usuario en **Firebase Authentication** (email/password).
2. En **Firestore**, creá un documento en `usuarios` con ID = el UID del usuario.
3. Contenido: `{ "name": "...", "lastName": "...", "role": "SUPER_ADMIN", "empresaId": null, "email": "..." }`

## Índices de Firestore

Los índices compuestos se despliegan con:

```bash
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```

## Datos existentes (migración manual)

Si tenías datos anteriores en una sola empresa:

1. Crea una empresa en la consola o desde el panel de super admin.
2. Asigna `empresaId` de esa empresa a todos los documentos en `usuarios` y `cargas`.
