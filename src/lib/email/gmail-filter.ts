/** Remitentes de notificaciones que ya sabemos que usan los bancos (sugerencias del generador de filtros). */
export const KNOWN_SENDERS: { bank: string; addresses: string[] }[] = [
  { bank: "BAC Credomatic", addresses: ["notificacion_hn@baccredomatic.com", "alerta@baccredomatic.com"] },
  { bank: "Ficohsa", addresses: ["interbanca@ficohsa.com", "notificaciones_ficohsa@ficohsa.com"] },
  { bank: "Banco Atlántida", addresses: ["noreply@bancatlan.hn"] },
  { bank: "Banpaís", addresses: ["bpenlinea@banpais.hn"] },
  { bank: "Kash", addresses: ["no-reply@kashlatam.com"] },
];

export type GmailFilterOptions = {
  senders: string[];
  label: string;
  neverSpam?: boolean;
  skipInbox?: boolean;
};

/** "BAC Honduras <alerta@bac.com>" → "alerta@bac.com" */
export function extractAddress(from: string) {
  const m = from.match(/<([^>]+)>/) ?? from.match(/[^\s<>"',;]+@[^\s<>"',;]+/);
  return (m?.[1] ?? m?.[0] ?? "").trim().toLowerCase();
}

/** Acepta direcciones completas o dominios (@banco.hn) */
export function normalizeSender(s: string) {
  return s.trim().toLowerCase().replace(/^from:/, "");
}

/** Lo que se escribe en el campo "De" de Gmail */
export function gmailFromValue(senders: string[]) {
  return senders.join(" OR ");
}

/** Búsqueda equivalente para pegar en Gmail */
export function gmailSearchQuery(senders: string[]) {
  return senders.length > 1 ? `from:(${gmailFromValue(senders)})` : `from:${senders[0] ?? ""}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");

/** Archivo para Gmail → Configuración → Filtros → Importar filtros */
export function buildGmailFilterXml({ senders, label, neverSpam = true, skipInbox = false }: GmailFilterOptions) {
  const props: [string, string][] = [
    ["from", gmailFromValue(senders)],
    ["label", label],
    ...(neverSpam ? ([["shouldNeverSpam", "true"]] as [string, string][]) : []),
    ...(skipInbox ? ([["shouldArchive", "true"]] as [string, string][]) : []),
    ["sizeOperator", "s_sl"],
    ["sizeUnit", "s_smb"],
  ];
  return `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom' xmlns:apps='http://schemas.google.com/apps/2006'>
  <title>Mail Filters</title>
  <entry>
    <category term='filter'></category>
    <title>Mail Filter</title>
    <content></content>
${props.map(([k, v]) => `    <apps:property name='${k}' value='${esc(v)}'/>`).join("\n")}
  </entry>
</feed>
`;
}
