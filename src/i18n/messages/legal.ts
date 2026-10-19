// Textos de las páginas legales (/terms y /privacy). `en` es la fuente de verdad; `es` debe tener la misma forma.
// Los emails y URLs dentro del texto se convierten en enlaces al mostrarse.

/** Punto de una lista: texto simple o con un título corto en negrita. */
export type LegalItem = string | { lead: string; text: string };
export type LegalSection = { id: string; title: string; body?: string[]; items?: LegalItem[]; after?: string[] };
export type LegalDoc = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  intro: string[];
  sections: LegalSection[];
};

const CONTACT = "hello@fallxnstudio.com";

const en = {
  effective: "Effective date: October 19, 2026",
  operator: "Finances is operated by FallxnStudio.",
  contents: "Contents",
  backHome: "Home",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  contact: "Contact",
  rights: "© 2026 FallxnStudio",
  privacyDoc: {
    metaTitle: "Privacy Policy",
    metaDescription: "How Finances by FallxnStudio collects, uses, protects and deletes your data.",
    title: "Privacy Policy",
    intro: [
      "This Privacy Policy explains what information Finances (the \"app\" or the \"service\") collects, how it is used, who it is shared with and the choices you have. Finances is operated by FallxnStudio (\"we\", \"us\").",
      "In short: we only use your data to run the app for you. We don't sell it, we don't show ads, and we don't use tracking or analytics cookies. You can delete your account and all of its data at any time.",
    ],
    sections: [
      {
        id: "service",
        title: "1. What the app does",
        body: [
          "Finances is a personal finance tracker. You can record transactions manually or connect your own Gmail account so the app imports the notification emails your bank sends you (purchases, deposits, transfers, payments) and turns them into transactions.",
          "The Gmail connection uses IMAP with a Gmail app password that you create, and it only reads the single label (folder) you choose — for example, a label where a Gmail filter places your bank alerts. The app also offers budgets, savings goals, scheduled payments, multiple currencies with exchange rates, and optional AI-generated email parsing rules using your own AI provider key.",
        ],
      },
      {
        id: "collect",
        title: "2. Information we collect",
        items: [
          {
            lead: "Account information.",
            text: "Your name and email address. If you register with a password, we store only a salted scrypt hash of it, never the password itself. If you use Google sign-in, we receive your basic Google profile (Google account ID, name, email address, email verification status and profile picture URL) and store your Google account ID, name and email address. We do not store your Google profile picture.",
          },
          {
            lead: "Optional avatar.",
            text: "An icon or a photo you upload, resized to 256×256 pixels and stored with your account.",
          },
          {
            lead: "Financial information.",
            text: "Data you enter or that is parsed from your bank emails: transactions (amount, currency, date, merchant or description, category, notes), your accounts and cards (name, type and the last 4 digits used to match notifications), budgets, savings goals, scheduled payments, categories, currencies and exchange rates.",
          },
          {
            lead: "Email connection.",
            text: "If you connect a Gmail account: the email address, IMAP server settings, the label you selected and your Gmail app password (encrypted, see Security).",
          },
          {
            lead: "Email messages from the selected label.",
            text: "For each message in that label: its message ID, sender, subject, date and text body. We store them so they can be parsed into transactions and re-processed later (for example, after you create or edit a rule). Messages outside the label you choose are never read.",
          },
          {
            lead: "Settings.",
            text: "Language, time zone, main currency, email parsing rules, in-app notification state and, if you add one, your AI provider and API key (encrypted).",
          },
          {
            lead: "Technical information.",
            text: "The essential cookies described below. Like most web services, the servers that host the app may keep short-lived technical logs (such as IP address and time of request) for security and troubleshooting.",
          },
        ],
      },
      {
        id: "use",
        title: "3. How we use your information",
        body: ["We use your information only to provide and protect the service:"],
        items: [
          "to create your account, sign you in and keep your session;",
          "to read the selected Gmail label, parse bank notifications and turn them into transactions;",
          "to show your balances, statistics, budgets, reminders and in-app notifications;",
          "to convert amounts between currencies;",
          "to generate email parsing rules with AI, only if you add your own AI key;",
          "to keep the service secure, prevent abuse and fix problems;",
          "to answer you when you contact us.",
        ],
        after: [
          "We do not sell your data, use it for advertising, build marketing profiles, or use it to train AI models.",
        ],
      },
      {
        id: "gmail",
        title: "4. Gmail access",
        body: [
          "The app connects to Gmail over IMAP (imap.gmail.com) using the Gmail address and app password you provide. It opens only the label you select, in read-only mode: it never sends, deletes, moves or modifies your emails, and it does not read your inbox or any other label.",
          "You can disconnect an email account at any time in Settings, and you can revoke the app password from your Google Account security settings, which immediately stops all access.",
        ],
      },
      {
        id: "google",
        title: "5. Google sign-in and Google user data",
        body: [
          "If you choose \"Continue with Google\", the app requests only the basic sign-in scopes: openid, email and profile. This information is used only to authenticate you and to create or identify your Finances account. We do not request access to your Gmail, Drive, Contacts or any other Google API through Google sign-in.",
          "The app's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements. (https://developers.google.com/terms/api-services-user-data-policy)",
          "We do not sell information received from Google, do not use it for advertising, do not transfer it to third parties except as necessary to provide the service or as required by law, and do not allow humans to read it except with your consent, for security purposes, or as required by law.",
        ],
      },
      {
        id: "ai",
        title: "6. Optional AI features",
        body: [
          "AI is optional and off unless you add your own API key from Anthropic (Claude) or OpenAI. When an email from your selected label doesn't match any existing rule, and you ask the app to create a rule (or turn on automatic AI rules), the app sends to that provider: the email's sender, subject and text body, plus your category names, account names with their last 4 digits, and your currency codes. The provider returns a parsing rule, which the app tests before saving it.",
          "These requests are made with your key, under your own account with that provider, so the provider's terms and privacy policy apply and usage is billed to you by the provider. Nothing is sent to an AI provider if you don't add a key.",
        ],
      },
      {
        id: "sharing",
        title: "7. Third parties and sharing",
        body: ["We share information only with the services needed to run the app:"],
        items: [
          { lead: "Google", text: "— Gmail over IMAP (with your credentials) and Google sign-in, if you use them." },
          { lead: "Anthropic or OpenAI", text: "— only if you add your own key, as described above." },
          {
            lead: "open.er-api.com",
            text: "— to fetch exchange rates. Only your main currency code (for example \"USD\") is sent; no personal or financial data.",
          },
          { lead: "Hosting infrastructure", text: "— the servers where the app and its database run, which process data on our behalf." },
          {
            lead: "Legal requirements",
            text: "— we may disclose information if required by law, or to protect the rights, safety and security of our users or the service.",
          },
        ],
        after: ["We never sell your personal or financial data."],
      },
      {
        id: "cookies",
        title: "8. Cookies and local storage",
        body: ["We use only essential cookies — no advertising, analytics or tracking cookies:"],
        items: [
          { lead: "fin_session", text: "— keeps you signed in (signed, httpOnly, expires after 30 days or when you sign out)." },
          { lead: "fin_lang", text: "— remembers the language you chose (1 year)." },
          { lead: "fin_oauth", text: "— protects the Google sign-in flow (httpOnly, deleted after sign-in, at most 10 minutes)." },
        ],
        after: [
          "If you install the app, your browser also stores your language preference locally and caches static files (code, icons) so it loads faster. Pages with financial data are never cached on your device.",
        ],
      },
      {
        id: "security",
        title: "9. Security",
        items: [
          "Gmail app passwords and AI API keys are encrypted at rest with AES-256-GCM. They are never shown back to you or sent to your browser after you save them.",
          "Account passwords are stored only as salted scrypt hashes.",
          "Sessions use signed, httpOnly cookies, and connections are served over HTTPS.",
          "Each account's data is isolated: every record belongs to a single user and is only accessible to that user.",
        ],
        after: [
          "No method of transmission or storage is completely secure, but we work to protect your information and will notify affected users of a breach as required by law.",
        ],
      },
      {
        id: "retention",
        title: "10. Retention and deletion",
        body: [
          "We keep your data for as long as your account exists. You can delete your account at any time from Settings → Account. Deletion is immediate and permanent: your profile, transactions, accounts, budgets, payments, stored email messages, rules, settings and encrypted credentials are all removed, and any email connections are stopped.",
          "You can also remove an email connection or your AI key at any time in Settings without deleting your account. Short-lived technical logs and backups, if any, are overwritten in the normal course of operations.",
        ],
      },
      {
        id: "rights",
        title: "11. Your choices and rights",
        body: [
          "You can view and edit your information in the app at any time, disconnect email accounts, remove your AI key and delete your account. Depending on where you live, you may have additional rights, such as requesting a copy of your data or objecting to certain processing. To exercise them, contact us at hello@fallxnstudio.com.",
        ],
      },
      {
        id: "children",
        title: "12. Children",
        body: [
          "Finances is not directed to children. You must be at least 13 years old to use it, or at least 16 where local law requires it (for example, in parts of the European Union). We do not knowingly collect data from children; if you believe a child has created an account, contact us and we will delete it.",
        ],
      },
      {
        id: "international",
        title: "13. International users",
        body: [
          "The service may store and process your information in countries other than the one where you live. By using the service, you understand that your information may be transferred to those countries, where data protection laws may differ. We apply the protections described in this policy wherever your data is processed.",
        ],
      },
      {
        id: "changes",
        title: "14. Changes to this policy",
        body: [
          "We may update this policy from time to time. We will change the effective date above and, for material changes, give notice in the app or on this page before they take effect.",
        ],
      },
      {
        id: "contact",
        title: "15. Contact",
        body: [`Questions or requests about privacy: ${CONTACT}. FallxnStudio, operator of Finances.`],
      },
    ],
  } as LegalDoc,
  termsDoc: {
    metaTitle: "Terms of Service",
    metaDescription: "The terms that apply when you use Finances by FallxnStudio.",
    title: "Terms of Service",
    intro: [
      "These Terms of Service (\"Terms\") govern your use of Finances (the \"service\"), a personal finance app operated by FallxnStudio (\"we\", \"us\"). Please read them together with our Privacy Policy.",
    ],
    sections: [
      {
        id: "acceptance",
        title: "1. Acceptance",
        body: [
          "By creating an account or using the service, you agree to these Terms and to the Privacy Policy. If you don't agree, don't use the service.",
        ],
      },
      {
        id: "service",
        title: "2. The service",
        body: [
          "Finances helps you track your personal finances. It can import bank notification emails from a Gmail label you choose (via IMAP and a Gmail app password you create), parse them into transactions, and offers budgets, scheduled payments, multiple currencies with automatic exchange rates, and optional AI-generated parsing rules using your own AI provider key. We may add, change or remove features over time.",
        ],
      },
      {
        id: "accounts",
        title: "3. Accounts and eligibility",
        items: [
          "You must be at least 13 years old (or 16 where local law requires it) to use the service.",
          "Provide accurate information and keep your account credentials secure. You are responsible for activity under your account.",
          "Accounts are personal. Tell us promptly at hello@fallxnstudio.com if you believe your account has been compromised.",
        ],
      },
      {
        id: "responsibilities",
        title: "4. Your responsibilities",
        items: [
          "Only connect email accounts, bank notifications and API keys that you own or are authorized to use.",
          "Keep your Gmail app passwords and AI API keys safe, and revoke them if you think they've been exposed.",
          "Make sure that using the service complies with the terms of your bank, email provider and AI provider, and with the laws that apply to you.",
          "You keep ownership of your data. You give us permission to store and process it only as needed to provide the service to you.",
        ],
      },
      {
        id: "advice",
        title: "5. Not financial advice; accuracy of data",
        body: [
          "Finances is a tracking tool. It does not provide financial, investment, tax or legal advice, and it is not a bank. Transactions parsed from emails, AI-generated rules, categories and exchange rates may be incomplete, delayed or wrong. Always check important figures against your bank's official statements before making decisions.",
        ],
      },
      {
        id: "third-parties",
        title: "6. Third-party services",
        body: [
          "The service relies on third parties such as Google (Gmail and Google sign-in), Anthropic and OpenAI (only if you add your own key) and open.er-api.com (exchange rates). Your use of those services is governed by their own terms and policies, any AI usage is billed to you by the provider, and we are not responsible for their availability, accuracy or actions.",
        ],
      },
      {
        id: "acceptable-use",
        title: "7. Acceptable use",
        body: ["You agree not to:"],
        items: [
          "access or attempt to access other users' data or accounts;",
          "connect accounts or credentials that don't belong to you, or use the service for any unlawful purpose;",
          "probe, disrupt, overload or reverse-engineer the service, or bypass its security or limits;",
          "use automated means to create accounts or send excessive requests;",
          "upload malicious code or content that infringes others' rights.",
        ],
      },
      {
        id: "availability",
        title: "8. Availability; \"as is\"",
        body: [
          "We work to keep the service running, but it is provided \"as is\" and \"as available\", without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We don't guarantee that it will be uninterrupted, error-free, or that email imports will always work, since they depend on third-party services. Keep your own records of anything important.",
        ],
      },
      {
        id: "liability",
        title: "9. Limitation of liability",
        body: [
          "To the maximum extent permitted by law, FallxnStudio will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of profits, data or funds, arising from your use of or inability to use the service, including decisions made based on information shown in the app. Our total liability for any claim related to the service is limited to the amount you paid us for it in the 12 months before the claim (if any). Some jurisdictions don't allow certain limitations, so they may not apply to you.",
        ],
      },
      {
        id: "termination",
        title: "10. Termination",
        body: [
          "You can stop using the service and delete your account at any time from Settings → Account; deletion is immediate and permanent. We may suspend or close accounts that violate these Terms or put the service or other users at risk, and we may discontinue the service with reasonable notice where possible.",
        ],
      },
      {
        id: "changes",
        title: "11. Changes to these Terms",
        body: [
          "We may update these Terms. We will change the effective date above and, for material changes, give notice in the app or on this page before they take effect. Continuing to use the service after that means you accept the updated Terms.",
        ],
      },
      {
        id: "governing",
        title: "12. Governing terms",
        body: [
          "These Terms and the Privacy Policy are the entire agreement between you and FallxnStudio about the service. If any part is found unenforceable, the rest remains in effect. Our failure to enforce a provision is not a waiver. These Terms are governed by the laws applicable at FallxnStudio's place of business, without prejudice to any mandatory consumer protections of the country where you live.",
        ],
      },
      {
        id: "contact",
        title: "13. Contact",
        body: [`Questions about these Terms: ${CONTACT}.`],
      },
    ],
  } as LegalDoc,
};

const es: typeof en = {
  effective: "Fecha de vigencia: 19 de octubre de 2026",
  operator: "Finances es operada por FallxnStudio.",
  contents: "Contenido",
  backHome: "Inicio",
  terms: "Términos del servicio",
  privacy: "Política de privacidad",
  contact: "Contacto",
  rights: "© 2026 FallxnStudio",
  privacyDoc: {
    metaTitle: "Política de privacidad",
    metaDescription: "Cómo Finances de FallxnStudio recopila, usa, protege y elimina tus datos.",
    title: "Política de privacidad",
    intro: [
      "Esta Política de privacidad explica qué información recopila Finances (la \"app\" o el \"servicio\"), cómo se usa, con quién se comparte y qué opciones tienes. Finances es operada por FallxnStudio (\"nosotros\").",
      "En resumen: sólo usamos tus datos para hacer funcionar la app para ti. No los vendemos, no mostramos anuncios y no usamos cookies de rastreo ni de analítica. Puedes eliminar tu cuenta y todos sus datos en cualquier momento.",
    ],
    sections: [
      {
        id: "service",
        title: "1. Qué hace la app",
        body: [
          "Finances es una app para llevar tus finanzas personales. Puedes registrar movimientos a mano o conectar tu propia cuenta de Gmail para que la app importe los correos de notificación que te envía tu banco (compras, depósitos, transferencias, pagos) y los convierta en movimientos.",
          "La conexión con Gmail usa IMAP con una contraseña de aplicación de Gmail que tú creas, y sólo lee la etiqueta (carpeta) que eliges — por ejemplo, una etiqueta donde un filtro de Gmail coloca las alertas del banco. La app también ofrece presupuestos, metas de ahorro, pagos programados, varias monedas con tasas de cambio y, de forma opcional, reglas para leer correos generadas con IA usando tu propia clave.",
        ],
      },
      {
        id: "collect",
        title: "2. Información que recopilamos",
        items: [
          {
            lead: "Datos de la cuenta.",
            text: "Tu nombre y tu email. Si te registras con contraseña, sólo guardamos un hash scrypt con sal, nunca la contraseña. Si usas el inicio de sesión con Google, recibimos tu perfil básico de Google (ID de la cuenta de Google, nombre, email, si el email está verificado y la URL de tu foto de perfil) y guardamos el ID de la cuenta de Google, tu nombre y tu email. No guardamos tu foto de perfil de Google.",
          },
          {
            lead: "Avatar opcional.",
            text: "Un ícono o una foto que subes, reducida a 256×256 píxeles y guardada con tu cuenta.",
          },
          {
            lead: "Información financiera.",
            text: "Lo que ingresas o lo que se extrae de los correos de tu banco: movimientos (monto, moneda, fecha, comercio o descripción, categoría, notas), tus cuentas y tarjetas (nombre, tipo y los últimos 4 dígitos que sirven para asociar las notificaciones), presupuestos, metas de ahorro, pagos programados, categorías, monedas y tasas de cambio.",
          },
          {
            lead: "Conexión de correo.",
            text: "Si conectas una cuenta de Gmail: la dirección de email, la configuración del servidor IMAP, la etiqueta elegida y tu contraseña de aplicación de Gmail (cifrada, ver Seguridad).",
          },
          {
            lead: "Correos de la etiqueta elegida.",
            text: "De cada mensaje de esa etiqueta: su ID, remitente, asunto, fecha y cuerpo en texto. Los guardamos para convertirlos en movimientos y volver a procesarlos después (por ejemplo, al crear o editar una regla). Los correos fuera de la etiqueta que eliges nunca se leen.",
          },
          {
            lead: "Ajustes.",
            text: "Idioma, zona horaria, moneda principal, reglas de correo, estado de las notificaciones de la app y, si agregas una, tu proveedor de IA y tu clave (cifrada).",
          },
          {
            lead: "Información técnica.",
            text: "Las cookies esenciales descritas más abajo. Como la mayoría de los servicios web, los servidores donde corre la app pueden guardar registros técnicos de corta duración (como la dirección IP y la hora de la petición) por seguridad y para resolver problemas.",
          },
        ],
      },
      {
        id: "use",
        title: "3. Cómo usamos tu información",
        body: ["Usamos tu información sólo para ofrecer y proteger el servicio:"],
        items: [
          "para crear tu cuenta, iniciar tu sesión y mantenerla;",
          "para leer la etiqueta de Gmail elegida, interpretar las notificaciones del banco y convertirlas en movimientos;",
          "para mostrarte saldos, estadísticas, presupuestos, recordatorios y notificaciones dentro de la app;",
          "para convertir montos entre monedas;",
          "para generar reglas de correo con IA, sólo si agregas tu propia clave;",
          "para mantener el servicio seguro, evitar abusos y corregir problemas;",
          "para responderte cuando nos escribes.",
        ],
        after: [
          "No vendemos tus datos, no los usamos para publicidad, no creamos perfiles de marketing ni los usamos para entrenar modelos de IA.",
        ],
      },
      {
        id: "gmail",
        title: "4. Acceso a Gmail",
        body: [
          "La app se conecta a Gmail por IMAP (imap.gmail.com) con la dirección y la contraseña de aplicación que tú das. Sólo abre la etiqueta que eliges, en modo de sólo lectura: nunca envía, borra, mueve ni modifica tus correos, y no lee tu bandeja de entrada ni ninguna otra etiqueta.",
          "Puedes desconectar una cuenta de correo cuando quieras en Ajustes, y puedes revocar la contraseña de aplicación desde la seguridad de tu Cuenta de Google, lo que corta todo acceso de inmediato.",
        ],
      },
      {
        id: "google",
        title: "5. Inicio de sesión con Google y datos de usuario de Google",
        body: [
          "Si eliges \"Continuar con Google\", la app sólo pide los permisos básicos de inicio de sesión: openid, email y profile. Esa información se usa únicamente para autenticarte y para crear o identificar tu cuenta de Finances. A través del inicio de sesión con Google no pedimos acceso a Gmail, Drive, Contactos ni a ninguna otra API de Google.",
          "El uso y la transferencia por parte de la app de la información recibida de las API de Google se ajustarán a la Política de datos de usuario de los servicios de API de Google (Google API Services User Data Policy), incluidos los requisitos de Uso limitado (Limited Use). (https://developers.google.com/terms/api-services-user-data-policy)",
          "No vendemos la información recibida de Google, no la usamos para publicidad, no la transferimos a terceros salvo cuando es necesario para ofrecer el servicio o lo exige la ley, y no permitimos que personas la lean salvo con tu consentimiento, por motivos de seguridad o cuando lo exige la ley.",
        ],
      },
      {
        id: "ai",
        title: "6. Funciones opcionales de IA",
        body: [
          "La IA es opcional y está apagada a menos que agregues tu propia clave de API de Anthropic (Claude) u OpenAI. Cuando un correo de tu etiqueta no coincide con ninguna regla y le pides a la app crear una (o activas las reglas automáticas con IA), la app envía a ese proveedor: el remitente, el asunto y el cuerpo en texto del correo, más los nombres de tus categorías, los nombres de tus cuentas con sus últimos 4 dígitos y los códigos de tus monedas. El proveedor devuelve una regla, que la app prueba antes de guardarla.",
          "Estas peticiones se hacen con tu clave, bajo tu propia cuenta con ese proveedor, así que aplican sus términos y su política de privacidad, y el proveedor te cobra el uso directamente. Si no agregas una clave, no se envía nada a ningún proveedor de IA.",
        ],
      },
      {
        id: "sharing",
        title: "7. Terceros y cuándo compartimos datos",
        body: ["Sólo compartimos información con los servicios necesarios para que la app funcione:"],
        items: [
          { lead: "Google", text: "— Gmail por IMAP (con tus credenciales) y el inicio de sesión con Google, si los usas." },
          { lead: "Anthropic u OpenAI", text: "— sólo si agregas tu propia clave, como se describe arriba." },
          {
            lead: "open.er-api.com",
            text: "— para obtener las tasas de cambio. Sólo se envía el código de tu moneda principal (por ejemplo \"USD\"); ningún dato personal ni financiero.",
          },
          { lead: "Infraestructura de hosting", text: "— los servidores donde corren la app y su base de datos, que procesan datos en nuestro nombre." },
          {
            lead: "Requisitos legales",
            text: "— podemos revelar información si la ley lo exige, o para proteger los derechos y la seguridad de nuestros usuarios o del servicio.",
          },
        ],
        after: ["Nunca vendemos tus datos personales ni financieros."],
      },
      {
        id: "cookies",
        title: "8. Cookies y almacenamiento local",
        body: ["Sólo usamos cookies esenciales — ninguna de publicidad, analítica ni rastreo:"],
        items: [
          { lead: "fin_session", text: "— mantiene tu sesión iniciada (firmada, httpOnly, vence a los 30 días o al cerrar sesión)." },
          { lead: "fin_lang", text: "— recuerda el idioma que elegiste (1 año)." },
          { lead: "fin_oauth", text: "— protege el inicio de sesión con Google (httpOnly, se borra al terminar, dura como máximo 10 minutos)." },
        ],
        after: [
          "Si instalas la app, tu navegador también guarda localmente tu preferencia de idioma y una copia de los archivos estáticos (código, íconos) para cargar más rápido. Las páginas con datos financieros nunca se guardan en tu dispositivo.",
        ],
      },
      {
        id: "security",
        title: "9. Seguridad",
        items: [
          "Las contraseñas de aplicación de Gmail y las claves de API de IA se guardan cifradas con AES-256-GCM. Nunca se te vuelven a mostrar ni se envían a tu navegador después de guardarlas.",
          "Las contraseñas de las cuentas sólo se guardan como hashes scrypt con sal.",
          "Las sesiones usan cookies firmadas y httpOnly, y las conexiones se sirven por HTTPS.",
          "Los datos de cada cuenta están aislados: cada registro pertenece a un solo usuario y sólo ese usuario puede acceder a él.",
        ],
        after: [
          "Ningún método de transmisión o almacenamiento es completamente seguro, pero trabajamos para proteger tu información y avisaremos a los usuarios afectados por una brecha según lo exija la ley.",
        ],
      },
      {
        id: "retention",
        title: "10. Conservación y eliminación",
        body: [
          "Conservamos tus datos mientras tu cuenta exista. Puedes eliminar tu cuenta cuando quieras desde Ajustes → Cuenta. La eliminación es inmediata y permanente: se borran tu perfil, movimientos, cuentas, presupuestos, pagos, correos guardados, reglas, ajustes y credenciales cifradas, y se detienen las conexiones de correo.",
          "También puedes quitar una conexión de correo o tu clave de IA en cualquier momento desde Ajustes sin eliminar tu cuenta. Los registros técnicos y copias de seguridad de corta duración, si existen, se sobrescriben en el curso normal de operación.",
        ],
      },
      {
        id: "rights",
        title: "11. Tus opciones y derechos",
        body: [
          "Puedes ver y editar tu información en la app en cualquier momento, desconectar cuentas de correo, quitar tu clave de IA y eliminar tu cuenta. Según donde vivas, puedes tener derechos adicionales, como pedir una copia de tus datos u oponerte a ciertos tratamientos. Para ejercerlos, escríbenos a hello@fallxnstudio.com.",
        ],
      },
      {
        id: "children",
        title: "12. Menores",
        body: [
          "Finances no está dirigida a menores. Debes tener al menos 13 años para usarla, o al menos 16 donde la ley local lo exija (por ejemplo, en partes de la Unión Europea). No recopilamos a sabiendas datos de menores; si crees que un menor creó una cuenta, escríbenos y la eliminaremos.",
        ],
      },
      {
        id: "international",
        title: "13. Usuarios internacionales",
        body: [
          "El servicio puede guardar y procesar tu información en países distintos al tuyo. Al usar el servicio, entiendes que tu información puede transferirse a esos países, donde las leyes de protección de datos pueden ser diferentes. Aplicamos las protecciones de esta política dondequiera que se procesen tus datos.",
        ],
      },
      {
        id: "changes",
        title: "14. Cambios a esta política",
        body: [
          "Podemos actualizar esta política de vez en cuando. Cambiaremos la fecha de vigencia de arriba y, si los cambios son importantes, lo avisaremos en la app o en esta página antes de que entren en vigor.",
        ],
      },
      {
        id: "contact",
        title: "15. Contacto",
        body: [`Preguntas o solicitudes sobre privacidad: ${CONTACT}. FallxnStudio, operador de Finances.`],
      },
    ],
  },
  termsDoc: {
    metaTitle: "Términos del servicio",
    metaDescription: "Los términos que aplican al usar Finances de FallxnStudio.",
    title: "Términos del servicio",
    intro: [
      "Estos Términos del servicio (\"Términos\") regulan el uso de Finances (el \"servicio\"), una app de finanzas personales operada por FallxnStudio (\"nosotros\"). Léelos junto con nuestra Política de privacidad.",
    ],
    sections: [
      {
        id: "acceptance",
        title: "1. Aceptación",
        body: [
          "Al crear una cuenta o usar el servicio, aceptas estos Términos y la Política de privacidad. Si no estás de acuerdo, no uses el servicio.",
        ],
      },
      {
        id: "service",
        title: "2. El servicio",
        body: [
          "Finances te ayuda a llevar tus finanzas personales. Puede importar los correos de notificación del banco desde una etiqueta de Gmail que eliges (por IMAP y con una contraseña de aplicación de Gmail que tú creas), convertirlos en movimientos, y ofrece presupuestos, pagos programados, varias monedas con tasas de cambio automáticas y, de forma opcional, reglas generadas con IA usando tu propia clave. Podemos agregar, cambiar o quitar funciones con el tiempo.",
        ],
      },
      {
        id: "accounts",
        title: "3. Cuentas y requisitos",
        items: [
          "Debes tener al menos 13 años (o 16 donde la ley local lo exija) para usar el servicio.",
          "Da información correcta y mantén seguras tus credenciales. Eres responsable de la actividad en tu cuenta.",
          "Las cuentas son personales. Avísanos pronto a hello@fallxnstudio.com si crees que tu cuenta fue comprometida.",
        ],
      },
      {
        id: "responsibilities",
        title: "4. Tus responsabilidades",
        items: [
          "Conecta sólo cuentas de correo, notificaciones bancarias y claves de API que sean tuyas o que estés autorizado a usar.",
          "Mantén seguras tus contraseñas de aplicación de Gmail y tus claves de IA, y revócalas si crees que se expusieron.",
          "Asegúrate de que usar el servicio cumple con los términos de tu banco, tu proveedor de correo y tu proveedor de IA, y con las leyes que te aplican.",
          "Tus datos siguen siendo tuyos. Nos das permiso para guardarlos y procesarlos sólo en la medida necesaria para ofrecerte el servicio.",
        ],
      },
      {
        id: "advice",
        title: "5. No es asesoría financiera; exactitud de los datos",
        body: [
          "Finances es una herramienta de seguimiento. No da asesoría financiera, de inversión, fiscal ni legal, y no es un banco. Los movimientos extraídos de correos, las reglas generadas con IA, las categorías y las tasas de cambio pueden estar incompletos, atrasados o equivocados. Revisa siempre las cifras importantes contra los estados de cuenta oficiales de tu banco antes de tomar decisiones.",
        ],
      },
      {
        id: "third-parties",
        title: "6. Servicios de terceros",
        body: [
          "El servicio depende de terceros como Google (Gmail e inicio de sesión con Google), Anthropic y OpenAI (sólo si agregas tu propia clave) y open.er-api.com (tasas de cambio). El uso de esos servicios se rige por sus propios términos y políticas, el uso de IA te lo cobra el proveedor, y no somos responsables de su disponibilidad, exactitud ni acciones.",
        ],
      },
      {
        id: "acceptable-use",
        title: "7. Uso aceptable",
        body: ["Te comprometes a no:"],
        items: [
          "acceder o intentar acceder a los datos o cuentas de otros usuarios;",
          "conectar cuentas o credenciales que no te pertenecen, ni usar el servicio con fines ilegales;",
          "sondear, interrumpir, sobrecargar o hacer ingeniería inversa del servicio, ni saltarte su seguridad o sus límites;",
          "usar medios automatizados para crear cuentas o enviar peticiones excesivas;",
          "subir código malicioso o contenido que infrinja derechos de otros.",
        ],
      },
      {
        id: "availability",
        title: "8. Disponibilidad; \"tal cual\"",
        body: [
          "Trabajamos para mantener el servicio funcionando, pero se ofrece \"tal cual\" y \"según disponibilidad\", sin garantías de ningún tipo, expresas o implícitas, incluidas las de comerciabilidad, idoneidad para un fin particular y no infracción. No garantizamos que funcione sin interrupciones ni errores, ni que la importación de correos funcione siempre, ya que depende de servicios de terceros. Guarda tus propios registros de lo que sea importante.",
        ],
      },
      {
        id: "liability",
        title: "9. Limitación de responsabilidad",
        body: [
          "En la máxima medida permitida por la ley, FallxnStudio no será responsable por daños indirectos, incidentales, especiales, consecuentes o punitivos, ni por pérdida de ganancias, datos o fondos, derivados del uso o la imposibilidad de usar el servicio, incluidas las decisiones tomadas con base en la información de la app. Nuestra responsabilidad total por cualquier reclamo relacionado con el servicio se limita a lo que nos hayas pagado por él en los 12 meses anteriores al reclamo (si pagaste algo). Algunas jurisdicciones no permiten ciertas limitaciones, así que podrían no aplicarte.",
        ],
      },
      {
        id: "termination",
        title: "10. Terminación",
        body: [
          "Puedes dejar de usar el servicio y eliminar tu cuenta cuando quieras desde Ajustes → Cuenta; la eliminación es inmediata y permanente. Podemos suspender o cerrar cuentas que incumplan estos Términos o pongan en riesgo el servicio o a otros usuarios, y podemos descontinuar el servicio con un aviso razonable cuando sea posible.",
        ],
      },
      {
        id: "changes",
        title: "11. Cambios a estos Términos",
        body: [
          "Podemos actualizar estos Términos. Cambiaremos la fecha de vigencia de arriba y, si los cambios son importantes, lo avisaremos en la app o en esta página antes de que entren en vigor. Si sigues usando el servicio después, aceptas los Términos actualizados.",
        ],
      },
      {
        id: "governing",
        title: "12. Disposiciones generales",
        body: [
          "Estos Términos y la Política de privacidad son el acuerdo completo entre tú y FallxnStudio sobre el servicio. Si alguna parte resulta inaplicable, el resto sigue vigente. No hacer valer una disposición no implica renunciar a ella. Estos Términos se rigen por las leyes aplicables en el lugar de operación de FallxnStudio, sin perjuicio de las protecciones obligatorias al consumidor del país donde vives.",
        ],
      },
      {
        id: "contact",
        title: "13. Contacto",
        body: [`Preguntas sobre estos Términos: ${CONTACT}.`],
      },
    ],
  },
};

export default { en, es };
