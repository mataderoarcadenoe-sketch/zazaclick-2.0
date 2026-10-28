# Zaza 2.0.2: cliente Google de Syscom.click

La APK usa el cliente web OAuth `572176809201-8o2c3qpug8mkik2pvd0bcbp1nk7belks.apps.googleusercontent.com`, del proyecto donde están registrados su paquete Android y firma. La lista estática del servidor solo incluía los clientes de la web de Zaza y otro cliente anterior; aceptar el de la APK dependía de una variable opcional que podía estar destinada a otra integración.

Se añade exclusivamente esa audiencia conocida y se conservan las existentes y `GOOGLE_CLIENT_ID`. No se desactiva la validación de Google, no se aceptan comodines y no cambia la comprobación de correo verificado o estado de cuenta. Un token rechazado devuelve ahora el código público `GOOGLE_TOKEN_INVALID`; no se publica el token ni el motivo interno del verificador.

`/health` identifica esta revisión como 2.0.2 y devuelve `native_google_login: syscom-v1` calculado a partir de la configuración admitida. El registro de operaciones continúa como `durable-v1`. No cambia el protocolo de mensajes, cuotas, credenciales, cola, esquema SQL ni motores WhatsApp; no requiere migración de datos.

Pruebas aisladas: `node tests/google-audiences.cjs`. Compilación estática: `node node_modules/typescript/bin/tsc --noEmit`. El verificador de Google se simula: se comprueba la audiencia de la APK sin variables adicionales, la conservación de clientes y variables, deduplicación de audiencias y rechazo ante un error del verificador. No usa cuentas, secretos, base de datos, tráfico Google ni mensajes.

La prueba de acceso real requiere una acción del usuario en el teléfono. Este cambio no confirma vinculación de WhatsApp, cuota disponible, envío ni recepción de comprobantes.
