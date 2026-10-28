# Zaza: refuerzo previo a la integración Android

Este cambio modifica el backend local. No despliega producción, no rota secretos en servicios externos y no agrega todavía Zaza a la APK.

## Comportamiento

- El envío admite una sesión JWT válida del negocio, una clave de desarrollador live con `messages:send`, una clave de la instancia exacta o un partner autorizado para ese tenant.
- Los JWT se verifican con HS256 y caducidad; identidad, rol, cuenta activa y pertenencia se consultan en la base actual. Ya no se aceptan IDs de usuario, coincidencias en contraseñas, claves en query/body ni claves enmascaradas como credenciales.
- Autorización y vigencia se comprueban antes de consultar un resultado guardado. Una clave test no envía mensajes reales ni aprovisiona tenants.
- PostgreSQL registra cada operación y reserva la cuota en una transacción. La restricción UNIQUE por usuario/instancia/clave permite un solo ganador. La huella del contenido detecta cambios de destinatario/documento con la misma clave.
- Los resultados terminales se reutilizan; un fallo de persistencia no deja avanzar sin protección. Las operaciones no caducan automáticamente a las 24 horas. Borrar explícitamente la cuenta o instancia elimina su registro asociado.
- `PROCESSING` significa operación reservada; `ACCEPTED` significa aceptada por el motor; `REJECTED` es un rechazo comprobado antes del envío; `UNKNOWN` exige revisar el resultado. Ninguno afirma entrega o lectura del destinatario. Un PROCESSING de más de dos minutos se señala para revisión, sin inferir fallo ni reenviarlo.
- Una incertidumbre conserva la reserva de cuota y no se reintenta sola. Solo los fallos de validación previos al motor devuelven la cuota; una devolución económica no demuestra no entrega. La conciliación administrativa posterior necesita evidencia del proveedor.
- La cadencia por instancia reserva turnos con una operación Lua atómica y reloj Redis. Redis no disponible o una reserva que tarda más de dos segundos detienen la operación; un exceso de turnos pendientes tampoco deja avanzar. La espera de turno está acotada a seis segundos. No se promete evitar restricciones del proveedor. Una respuesta HTTP 200 con success:false no se presenta como aceptación.
- Los PDF base64 locales se limitan a 8 MiB, con firma y cierre, y no se guardan en los logs. Se permiten las URL que ya valida el adaptador contra SSRF. La validación básica no es un escáner de PDF ni reemplaza las verificaciones del motor.
- Se exige JWT_SECRET configurado con al menos 32 bytes; se eliminan secretos de respaldo y restauración automática de claves de partners. Las credenciales públicas retiradas se rechazan también si permanecen en filas antiguas. No se imprimen ni incluyen sus valores en esta guía.
- Socket.IO requiere `handshake.auth.token` y autoriza la instancia antes de entrar a su sala. Los clientes antiguos que entraban anónimamente deben actualizarse. El permiso se vuelve a comprobar al solicitar una nueva sala; para revocación inmediata de conexiones ya establecidas se necesita además desconectarlas al cambiar sus permisos.

## Contrato para la APK

La APK debe guardar un UUID de operación antes de llamar a:

`POST /v1/messages/media`

Cabeceras: `Authorization: Bearer <sesión>` o `x-api-key`, `Content-Type: application/json`, `Idempotency-Key: <UUID persistido>`.

Campos: `instanceName`, `number` internacional, `mediatype: "document"`, `mimetype: "application/pdf"`, `media: "data:application/pdf;base64,..."`, `fileName` y `caption` opcional.

Las respuestas incluyen `operationId` y `deliveryState`; también se expone `X-Operation-Id`. Una clave nueva crea una operación distinta y puede producir otro mensaje: reutilizar la original en reintentos del mismo contenido. La deduplicación no depende únicamente del PDF porque el usuario puede querer enviarlo a otro número.

Para reconciliar un timeout:

- `GET /v1/message-operations/by-key/{instanceName}/{key}`
- `GET /v1/message-operations/{operationId}`

La consulta es privada por cuenta/instancia/entorno. La credencial antigua de instancia puede consultar por clave; por ID se utiliza sesión JWT o clave de desarrollador autorizada. `delivered` y `read` son null mientras no exista un contrato de eventos verificados. Un 404 no prueba que una petición antigua, enviada antes del cambio, no llegara al motor.

Un 409 `DELIVERY_UNCERTAIN`/`IDEMPOTENCY_CONFLICT` obliga a consultar/revisar; `IDEMPOTENCY_PAYLOAD_MISMATCH` bloquea reutilizar la clave para otro contenido. No cambiar automáticamente al WhatsApp del teléfono ni crear otro UUID después de un timeout.

## Puesta en producción controlada — NO ejecutada

1. Revisar el diff y respaldar la base y los registros Redis existentes. Configurar o rotar JWT_SECRET, credenciales de partners y EVOLUTION_GO_API_KEY mediante el gestor de secretos. Las claves retiradas no vuelven a habilitarse por ponerlas en variables. Cambiar JWT_SECRET invalida sesiones anteriores y requiere nuevo inicio de sesión.
2. Detener entradas de envío y drenar/detener todos los procesos de la versión anterior. No mezclar versiones durante el cambio: la versión antigua no conoce el registro nuevo. Revisar las operaciones en vuelo y las claves Redis antes de que expiren.
3. Aplicar `migrations/20261027-message-operations.sql`. Es una migración aditiva; no ejecuta el inicializador completo de tablas antiguas ni envía mensajes. El servidor nuevo también exige este esquema al arrancar.
4. Compilar con `npm run build`. Antes de habilitar tráfico, ejecutar, con las conexiones correctas del despliegue, `node dist/jobs/import-legacy-message-operations.js --confirm-stopped-old-workers`. El comando es explícito, reanudable e idempotente; convierte las claves Redis presentes en registros UNKNOWN sin cobrar ni enviar. No puede reconstruir claves ya expiradas/perdidas: esos casos requieren revisión con el historial y el proveedor.
5. Iniciar solamente la nueva versión y comprobar health, login, consulta de instancias y operaciones. Verificar límites reales de proxy/motor para PDF; el JSON de 8 MiB ocupa aproximadamente 10.67 MiB en base64. No se verificaron certificados, variables ni revisión del despliegue remoto.
6. Una prueba real a un número autorizado debe comprobar aceptación, mensaje recibido y PDF íntegro. Esa prueba no se ejecutó en este trabajo. La documentación OpenAPI local se actualizó a 2.0.1.
7. Para retroceder de versión, detener tráfico y reconciliar las operaciones del registro nuevo antes de permitir envíos del código antiguo. Volver directamente al código anterior elimina las protecciones nuevas para peticiones de esa versión.

El envío al proveedor sigue siendo síncrono después de la reserva durable. Esto no es una cola de transporte con reintentos automáticos en segundo plano, ni promete entrega exactamente una vez en un sistema externo que no expone una transacción compartida. La siguiente fase Android tendrá su cola local y recuperará estos estados sin duplicar mensajes.

## Pruebas locales reproducibles

`tests/hardening.cjs` requiere PostgreSQL desechable en `127.0.0.1:65429`, usuario `zaza_test`, base `zaza_hardening_test`. Nunca usa DATABASE_URL ni la configuración del proyecto. Solo permite ejecución con `ZAZA_TEST_ALLOW_DISPOSABLE_DB=1`. Crea/trunca exclusivamente las tablas de esta base de prueba; no utilizarla con información real.

Con dependencias instaladas: definir esa variable y ejecutar `npm run test:hardening`. El compilador puede verificarse sin iniciar el servidor con `node node_modules/typescript/bin/tsc --noEmit`.

Las pruebas usan PostgreSQL real aislado, dependencias de autenticación controladas y motor simulado; no importan Redis/configuración reales ni hacen llamadas a Google, Zaza, Evolution o WhatsApp. El caso de concurrencia lanza 40 peticiones a las funciones reales del middleware. Consultar `tests/verification.json` para los casos y el resultado de la ejecución local.
