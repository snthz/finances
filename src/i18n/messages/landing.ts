// Textos de la landing pública (/welcome). `en` es la fuente de verdad; `es` debe tener la misma forma.

const en = {
  metaTitle: "Finances · Your money, sorted automatically",
  metaDescription:
    "Finances by FallxnStudio reads the notification emails your bank already sends you and turns them into transactions, budgets and stats. Installable as an app on your phone.",
  signIn: "Sign in",
  createAccount: "Create account",
  openApp: "Open the app",
  install: "Install app",
  hero: {
    eyebrow: "Personal finance · Automatic · Installable",
    title: "Your money, sorted automatically.",
    subtitle:
      "Finances reads the notification emails your bank already sends you and turns every purchase, deposit and payment into a categorized transaction — in real time, without typing a thing.",
    note: "Your data stays private to your account. No ads, ever.",
  },
  demo: {
    emailFrom: "Bank alert",
    emailSubject: "Purchase authorized",
    emailBody: "Card ending 4821 · L 450.00 at SUPERMARKET LA COLONIA",
    arrow: "imported in seconds",
    txMerchant: "Supermarket La Colonia",
    txMeta: "Groceries · Card 4821",
    budgetLabel: "Groceries budget",
    budgetValue: "62% used",
  },
  how: {
    title: "How it works",
    subtitle: "Three steps, once. After that it runs by itself.",
    steps: [
      {
        title: "Connect your email",
        body: "Create your account and add the Gmail account that receives your bank alerts, using a Gmail app password. A generated Gmail filter moves those alerts into a label you choose — only that label is read.",
      },
      {
        title: "Emails become transactions",
        body: "The app stays connected over IMAP IDLE, so a new alert is parsed the moment it arrives. Built-in rules cover common banks; for an unknown format, AI can write a rule, test it against the email, and only save it if it works.",
      },
      {
        title: "See where it goes",
        body: "Each transaction is matched to the right card or account by its last 4 digits, categorized by keywords, and converted to your main currency for the overview, budget and charts.",
      },
    ],
  },
  features: {
    title: "Everything in one place",
    items: [
      { title: "Real-time import", body: "Bank emails are processed as soon as they land, with a periodic sync as a backup." },
      { title: "Multiple currencies", body: "Track lempiras, dollars or any currency. Exchange rates update automatically every 12 hours, or set them by hand." },
      { title: "Budgets & savings", body: "Monthly spending limits, category budgets, a savings goal and streaks for months you stayed on track." },
      { title: "Scheduled payments", body: "Loans, financing, subscriptions and deposits with their due dates, so you know what's coming." },
      { title: "Cards & accounts", body: "Credit cards, debit cards, bank accounts, cash and wallets, each with its own balance and history." },
      { title: "Smart categories", body: "Keywords auto-categorize new transactions, and you can re-apply them to everything uncategorized in one tap." },
      {
        title: "Bring your own AI key",
        body: "Optional: add your own Claude or OpenAI key and, when an email doesn't match any rule, AI drafts one and validates it before it's used.",
      },
      { title: "Bilingual", body: "Use the app in English or Spanish — switch any time." },
    ],
  },
  pwa: {
    title: "An app on your phone, no app store",
    subtitle:
      "Finances is a Progressive Web App (PWA): install it from the browser and it opens full-screen with its own icon, just like a native app.",
    facts: [
      { title: "Home screen icon", body: "Launches full-screen, without the browser bar, and shows up in your app switcher." },
      { title: "Quick actions", body: "Long-press the icon to jump straight to “New transaction” or your transaction list." },
      { title: "Works offline gracefully", body: "Static files are cached for fast loads; without a connection you get a friendly offline screen." },
      { title: "Your data is never cached", body: "Pages with financial data always come fresh from the server and are never stored on the device." },
    ],
    installTitle: "How to install",
    platforms: [
      { name: "iPhone / iPad", steps: "Open the site in Safari, tap Share, then “Add to Home Screen”." },
      { name: "Android", steps: "Open the site in Chrome, tap the ⋮ menu, then “Install app”." },
      { name: "Desktop", steps: "In Chrome or Edge, click the install icon in the address bar." },
    ],
  },
  privacy: {
    title: "Private by design",
    body: "Finances is a hosted service by FallxnStudio. Your financial data is yours, and we only use it to run the app for you.",
    items: [
      "Your data is isolated per account — nobody else can see your transactions, cards or emails.",
      "Passwords are stored as scrypt hashes; email app passwords and AI keys are encrypted with AES-256-GCM and never shown again.",
      "Only the Gmail label you choose is read, in read-only mode — never your inbox or other folders.",
      "No ads, no tracking cookies, and we never sell your data. Exchange rates only send your main currency code.",
      "Delete your account and all of its data anytime from Settings — it's immediate and permanent.",
    ],
    link: "Read the Privacy Policy",
  },
  cta: {
    title: "Ready to see your finances clearly?",
    body: "Create your account in a minute, or sign in to pick up where you left off.",
  },
  footer: {
    tagline: "Finances · a FallxnStudio product",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    contact: "Contact",
  },
};

const es: typeof en = {
  metaTitle: "Finances · Tu dinero, ordenado solo",
  metaDescription:
    "Finances de FallxnStudio lee los correos de notificación que tu banco ya te envía y los convierte en movimientos, presupuestos y estadísticas. Se instala como app en tu teléfono.",
  signIn: "Entrar",
  createAccount: "Crear cuenta",
  openApp: "Abrir la app",
  install: "Instalar app",
  hero: {
    eyebrow: "Finanzas personales · Automática · Instalable",
    title: "Tu dinero, ordenado solo.",
    subtitle:
      "Finances lee los correos de notificación que tu banco ya te envía y convierte cada compra, depósito y pago en un movimiento categorizado — en tiempo real, sin escribir nada.",
    note: "Tus datos son privados de tu cuenta. Sin anuncios, nunca.",
  },
  demo: {
    emailFrom: "Alerta del banco",
    emailSubject: "Compra autorizada",
    emailBody: "Tarjeta terminada en 4821 · L 450.00 en SUPERMERCADO LA COLONIA",
    arrow: "importado en segundos",
    txMerchant: "Supermercado La Colonia",
    txMeta: "Supermercado · Tarjeta 4821",
    budgetLabel: "Presupuesto de súper",
    budgetValue: "62% usado",
  },
  how: {
    title: "Cómo funciona",
    subtitle: "Tres pasos, una sola vez. Después funciona solo.",
    steps: [
      {
        title: "Conecta tu correo",
        body: "Crea tu cuenta y agrega la cuenta de Gmail que recibe las alertas del banco con una contraseña de aplicación. Un filtro de Gmail generado por la app mueve esas alertas a una etiqueta que eliges — sólo se lee esa etiqueta.",
      },
      {
        title: "Los correos se vuelven movimientos",
        body: "La app se mantiene conectada por IMAP IDLE, así que cada alerta se procesa en cuanto llega. Trae reglas para bancos comunes; si el formato es nuevo, la IA puede escribir una regla, probarla con el correo y guardarla sólo si funciona.",
      },
      {
        title: "Mira a dónde se va",
        body: "Cada movimiento se asigna a la tarjeta o cuenta correcta por sus últimos 4 dígitos, se categoriza por palabras clave y se convierte a tu moneda principal para el resumen, el presupuesto y las gráficas.",
      },
    ],
  },
  features: {
    title: "Todo en un solo lugar",
    items: [
      { title: "Importación en tiempo real", body: "Los correos del banco se procesan apenas llegan, con una sincronización periódica de respaldo." },
      { title: "Varias monedas", body: "Lleva lempiras, dólares o cualquier moneda. Las tasas se actualizan solas cada 12 horas, o puedes fijarlas a mano." },
      { title: "Presupuesto y ahorro", body: "Límite de gasto mensual, presupuesto por categoría, meta de ahorro y rachas de meses cumplidos." },
      { title: "Pagos programados", body: "Préstamos, financiamientos, suscripciones y depósitos con sus fechas, para saber qué viene." },
      { title: "Tarjetas y cuentas", body: "Tarjetas de crédito y débito, cuentas bancarias, efectivo y billeteras, cada una con su saldo e historial." },
      { title: "Categorías inteligentes", body: "Las palabras clave categorizan los movimientos nuevos, y puedes aplicarlas a todo lo pendiente con un toque." },
      {
        title: "Usa tu propia clave de IA",
        body: "Opcional: agrega tu clave de Claude u OpenAI y, cuando un correo no coincide con ninguna regla, la IA redacta una y la valida antes de usarla.",
      },
      { title: "Bilingüe", body: "Usa la app en inglés o en español — cámbialo cuando quieras." },
    ],
  },
  pwa: {
    title: "Una app en tu teléfono, sin tienda de apps",
    subtitle:
      "Finances es una Progressive Web App (PWA): se instala desde el navegador y abre a pantalla completa con su propio ícono, igual que una app nativa.",
    facts: [
      { title: "Ícono en la pantalla de inicio", body: "Abre a pantalla completa, sin la barra del navegador, y aparece en el selector de apps." },
      { title: "Accesos rápidos", body: "Mantén presionado el ícono para ir directo a “Nuevo movimiento” o a tus movimientos." },
      { title: "Sin conexión, con elegancia", body: "Los archivos estáticos se guardan para cargar rápido; sin internet ves una pantalla amigable." },
      { title: "Tus datos nunca se guardan en caché", body: "Las páginas con datos financieros siempre vienen del servidor y nunca se almacenan en el dispositivo." },
    ],
    installTitle: "Cómo instalarla",
    platforms: [
      { name: "iPhone / iPad", steps: "Abre el sitio en Safari, toca Compartir y luego “Agregar a inicio”." },
      { name: "Android", steps: "Abre el sitio en Chrome, toca el menú ⋮ y luego “Instalar app”." },
      { name: "Computadora", steps: "En Chrome o Edge, haz clic en el ícono de instalar de la barra de direcciones." },
    ],
  },
  privacy: {
    title: "Privada desde el diseño",
    body: "Finances es un servicio de FallxnStudio. Tus datos financieros son tuyos, y sólo los usamos para hacer funcionar la app para ti.",
    items: [
      "Los datos de cada cuenta están aislados — nadie más puede ver tus movimientos, tarjetas ni correos.",
      "Las contraseñas se guardan como hashes scrypt; las contraseñas de correo y las claves de IA se cifran con AES-256-GCM y nunca se vuelven a mostrar.",
      "Sólo se lee la etiqueta de Gmail que eliges, en modo de sólo lectura — nunca tu bandeja de entrada ni otras carpetas.",
      "Sin anuncios ni cookies de rastreo, y nunca vendemos tus datos. Para las tasas de cambio sólo se envía el código de tu moneda principal.",
      "Elimina tu cuenta y todos sus datos cuando quieras desde Ajustes — es inmediato y permanente.",
    ],
    link: "Leer la Política de privacidad",
  },
  cta: {
    title: "¿Listo para ver tus finanzas con claridad?",
    body: "Crea tu cuenta en un minuto, o entra para seguir donde te quedaste.",
  },
  footer: {
    tagline: "Finances · un producto de FallxnStudio",
    terms: "Términos del servicio",
    privacy: "Política de privacidad",
    contact: "Contacto",
  },
};

export default { en, es };
