// GitHub Pages sirve el sitio bajo /<repo>/ — todo link interno pasa por aquí.
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
export const url = (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`;

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
