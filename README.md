# Finanzas

App personal (PWA) para registrar gastos e ingresos, importarlos automáticamente desde los correos del banco en Gmail y ver estadísticas por categoría, tarjeta/cuenta, comercio y mes.

**Stack:** Next.js 16 · Postgres (Drizzle ORM) · Tailwind 4 · Recharts · IMAP IDLE (Gmail).

## Funciones

- **Primer uso:** al abrir la app por primera vez aparece un asistente para crear tu cuenta (nombre, email, contraseña, moneda principal, zona horaria y otras monedas). Después de eso **el registro queda cerrado**.
- **Resumen:** gastos, ingresos, balance, tasa de ahorro, promedio diario y proyección. Incluye ingresos vs gastos de 12 meses, gasto diario, y gastos por categoría, por tarjeta/cuenta, por comercio y por moneda, además de presupuestos y saldos. Por defecto **todo se convierte a tu moneda principal**; también puedes ver cada moneda por separado.
- **Monedas dinámicas** (Ajustes → Monedas): agrega las que uses (HNL, USD…), cada una con su símbolo y sus **alias**, que es como aparece en los correos (`L.`, `Lps`, `US$`, `$`…). Las tasas se actualizan solas cada 12 h (open.er-api.com) o las fijas a mano. Si llega un correo en una moneda nueva, se agrega automáticamente.
- **Movimientos:** alta manual (gasto, ingreso o transferencia entre cuentas), filtros y cambio rápido de categoría.
- **Cuentas y tarjetas:** cada una con su moneda y sus **últimos 4 dígitos**, que sirven para asignarle los correos.
- **Categorías:** con palabras clave para auto-categorizar.
- **Presupuesto:**
  - Límite de gasto mensual, límites por categoría y meta de ahorro mensual, más una meta a largo plazo opcional (ej. "Fondo de emergencia").
  - Las cuentas marcadas como "Cuenta de ahorro" son la base: sus depósitos y retiros (por correo, gracias a los últimos dígitos, o manuales) se reflejan solos. Desde Presupuesto puedes depositar, retirar o ajustar el saldo real.
  - **Rachas** de meses cumpliendo el presupuesto y la meta de ahorro, con tu mejor racha y el historial de 12 meses. Si cambias el plan, los meses anteriores conservan el límite con que se evaluaron.
- **Varios correos en tiempo real:** conecta tantos Gmail como quieras (por ejemplo uno por banco). Cada uno mantiene su propia conexión **IMAP IDLE**, así que cada correo que cae en la etiqueta se convierte en movimiento en ~2 segundos. Si una conexión se cae, se reconecta sola, y hay una sincronización periódica de respaldo. Todos los correos pasan por las mismas reglas, que son configurables y traen un probador en vivo.
- **Interfaz:** monocromática y con modo oscuro automático. Los formularios se abren como paneles que suben desde abajo (se cierran arrastrando hacia abajo). Los ajustes están en pestañas: General, Monedas, Correos y Cuenta.
- **PWA:** se instala en el móvil y tiene página sin conexión. Los datos financieros nunca se guardan en caché.

## Despliegue en Dokploy

1. **Base de datos:** en Dokploy crea (o usa) un servicio **PostgreSQL** y copia su *Internal Connection URL*.
2. **Aplicación:** crea una *Application* desde tu repo con **Build Type: Dockerfile**, puerto **3000**.
3. **Variable de entorno:** sólo `DATABASE_URL`, con la URL interna del Postgres. El resto es opcional (ver [.env.example](.env.example)).
4. **Dominio** con HTTPS (Let's Encrypt) en la pestaña *Domains*. Hace falta para instalar la PWA y para la cookie de sesión segura.
5. Despliega y abre tu dominio: aparecerá el asistente para crear tu cuenta. Las migraciones se aplican solas al arrancar.

> Corre **una sola réplica**: el watcher de correo vive dentro del proceso.

### Correos (uno o varios Gmail)

Repite esto por cada cuenta de Gmail donde te lleguen notificaciones de bancos:

1. Activa la verificación en 2 pasos y crea una **contraseña de aplicación** en <https://myaccount.google.com/apppasswords>.
2. En ese Gmail crea la etiqueta `Finanzas` y un **filtro** con los remitentes del banco que aplique esa etiqueta. La app sólo lee esa etiqueta, en modo lectura.
3. En la app ve a **Ajustes → Correos → Conectar**, pega el correo y la contraseña de aplicación (se guarda cifrada) y pulsa *Conectar*. Se prueba la conexión al momento.
4. En **Correos → Bandeja** revisa los que quedaron "Sin regla" o con "Error". Usa *Crear regla desde este correo*, pruébala y pulsa *Reprocesar pendientes*.

### Instalar en el móvil

- **iPhone (Safari):** Compartir → *Añadir a pantalla de inicio*.
- **Android (Chrome):** menú ⋮ → *Instalar aplicación*.

## Desarrollo local

```bash
bun install
echo "DATABASE_URL=postgres://finances:finances@localhost:5433/finances" > .env
bun dev            # levanta Postgres en Docker (localhost:5433) y la app en http://localhost:3000
```

Si cambias el esquema en `src/db/schema.ts`, genera la migración con `bun run db:generate`. Se aplica sola al arrancar.

Si en desarrollo la página se recarga sola en bucle, borra la caché de Next: `rm -rf .next`.

## Reglas incluidas y reglas con IA

- **Bancos incluidos:**
  - BAC: compra con tarjeta, transferencia enviada y transacción rechazada (esta se ignora).
  - Ficohsa: compra con tarjeta.
  - Planilla: boleta de pago, con detección de duplicados por quincena.

  Se instalan una vez; puedes editarlas o borrarlas, y si borras una no vuelve a aparecer.
- **IA (Claude):** con `ANTHROPIC_API_KEY` definida, cuando llega un correo que ninguna regla reconoce, o que sólo reconoce una regla genérica, Claude diseña una regla específica para ese tipo de correo:
  - La app la prueba contra el propio correo antes de guardarla. Si los valores no coinciden con lo que Claude leyó, se le pide que la corrija (2 intentos como máximo).
  - Los correos que no son movimientos de dinero generan una regla para ignorarlos.
  - Límite: 40 reglas por día.
  - Se activa o desactiva en Ajustes → Correos, y en cada correo de la Bandeja hay un botón "Crear regla con IA".
- **Fecha real y duplicados:** cada regla puede leer la fecha del movimiento escrita en el correo, y tener un "identificador para duplicados" (ej. la quincena de una planilla). Además, si llega dos veces el mismo movimiento (mismo monto, comercio y tarjeta en menos de 10 minutos), el segundo se marca como duplicado.

## Cómo funcionan las reglas de correo

Las reglas se evalúan por prioridad (de menor a mayor) y la primera que coincide decide:

- **Filtros** (remitente, asunto, cuerpo): regex sin distinguir mayúsculas. Todos los que tengan valor deben coincidir.
- **Ignorar**: marca el correo como ignorado (promociones, estados de cuenta…).
- **Extracción:** regex cuyo primer grupo `( )` es el valor. Si se deja vacío, se usan patrones genéricos en español: `Monto: L. 1,234.56`, `US$ 12.99`, `1,500.00 HNL`, `terminada en 1234`, `****1234`, `Comercio: …`, `Concepto: …`. La moneda se detecta con los alias de Ajustes → Monedas.
- La **cuenta** se elige por los últimos 4 dígitos, salvo que la regla fije una. La **categoría** se elige por palabras clave, salvo que la regla fije una.
- La fecha del movimiento es la fecha del correo.

## Licencia

[MIT](LICENSE) © 2026 FallxnStudio
