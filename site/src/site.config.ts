// Datos del grupo y del curso. Cambia aquí y se propaga a todo el sitio.
export const site = {
  group: "Group TBD",                       // TODO: nombre del grupo
  tagline: "Weekly notes on networks, language, and what the machine gets wrong.",
  members: ["Esteban Pérez", "TBD", "TBD"], // TODO
  repo: "https://github.com/EstebanPerez99/social-graphs-and-interactions", // TODO si cambia el nombre
  course: {
    code: "02805",
    name: "Social Graphs and Interactions",
    org: "DTU · Fall 2026",
    url: "https://sunelehmann.com/socialgraphs2026-web/",
  },
  // La secuencia real del curso. Se usa para el índice: semanas con post → link; sin post → "coming".
  schedule: [
    { week: 1, topic: "Networks", date: "2026-09-02" },
    { week: 2, topic: "Models & null models", date: "2026-09-09" },
    { week: 3, topic: "Who matters, and why", date: "2026-09-16" },
    { week: 4, topic: "Communities & backbones", date: "2026-09-23" },
    { week: 5, topic: "NLP I", date: "2026-09-30" },
    { week: 6, topic: "NLP II", date: "2026-10-07" },
    { week: 7, topic: "NLP III", date: "2026-10-21" },
    { week: 8, topic: "Networks × language", date: "2026-10-28" },
  ],
};
