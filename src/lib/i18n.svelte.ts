// Label dua bahasa sederhana: L("Teks Indonesia", "English text").

export type Lang = "id" | "en";
const KEY = "ilovelnsw.lang";

function initial(): Lang {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "en") return "en";
  } catch {
    /* mode privat */
  }
  return "id";
}

export const i18n = $state<{ lang: Lang }>({ lang: initial() });

export function setLang(lang: Lang) {
  i18n.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* abaikan */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

export const L = (id: string, en: string) => (i18n.lang === "en" ? en : id);
