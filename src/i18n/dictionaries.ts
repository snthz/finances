// Diccionarios por idioma, armados a partir de un archivo por sección en ./messages.
// Para agregar textos: edita el archivo de la sección (en + es); TypeScript exige que coincidan.

import type { Locale } from "./config";
import accounts from "./messages/accounts";
import auth from "./messages/auth";
import budget from "./messages/budget";
import cards from "./messages/cards";
import categories from "./messages/categories";
import common from "./messages/common";
import dashboard from "./messages/dashboard";
import email from "./messages/email";
import forms from "./messages/forms";
import landing from "./messages/landing";
import legal from "./messages/legal";
import payments from "./messages/payments";
import settings from "./messages/settings";
import stats from "./messages/stats";
import transactions from "./messages/transactions";
import ui from "./messages/ui";

const sections = { common, landing, legal, auth, dashboard, stats, transactions, budget, accounts, categories, payments, cards, email, settings, forms, ui };

type Sections = typeof sections;
export type Dictionary = { [K in keyof Sections]: Sections[K]["en"] };

function build(locale: Locale): Dictionary {
  return Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v[locale]])) as Dictionary;
}

const dictionaries: Record<Locale, Dictionary> = { en: build("en"), es: build("es") };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}
