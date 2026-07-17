export const PV_SECTIONS = [
  { key: "saludFisica",        num: 1, title: "Salud Física",         color: "bg-green-600",  border: "border-green-200",  bg: "bg-green-50",  text: "text-green-800"  },
  { key: "familia",            num: 2, title: "Familia",              color: "bg-rose-500",   border: "border-rose-200",   bg: "bg-rose-50",   text: "text-rose-800"   },
  { key: "finanzas",           num: 3, title: "Finanzas",             color: "bg-amber-600",  border: "border-amber-200",  bg: "bg-amber-50",  text: "text-amber-800"  },
  { key: "realizacionPersonal",num: 4, title: "Realización Personal", color: "bg-purple-600", border: "border-purple-200", bg: "bg-purple-50", text: "text-purple-800" },
  { key: "redes",              num: 5, title: "Redes",                color: "bg-sky-600",    border: "border-sky-200",    bg: "bg-sky-50",    text: "text-sky-800"    },
  { key: "trabajo",            num: 6, title: "Trabajo",              color: "bg-teal-600",   border: "border-teal-200",   bg: "bg-teal-50",   text: "text-teal-800"   },
  { key: "vocacion",           num: 7, title: "Vocación",             color: "bg-orange-600", border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-800" },
  { key: "misionPersonal",     num: 8, title: "Misión Personal",      color: "bg-indigo-600", border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-800" },
] as const

export type PvSectionKey = typeof PV_SECTIONS[number]["key"]
