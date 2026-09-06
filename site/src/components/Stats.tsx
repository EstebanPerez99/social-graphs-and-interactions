import { useEffect, useState } from "react";
import CountUp from "./bits/CountUp";

// Fila de 2–4 números clave. Cuentan hacia arriba una vez al entrar en pantalla.
type Item = { value: number; label: string; tone?: "in" | "out"; suffix?: string; prefix?: string };

export default function Stats({ items }: { items: Item[] }) {
  // SSR y sin JS: el número ya está en el HTML. Con JS: cuenta hacia arriba al entrar en pantalla.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <dl className="my-8 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 font-mono">
      {items.map((it) => (
        <div key={it.label} className="border-t-2 pt-2"
             style={{ borderColor: it.tone === "in" ? "var(--color-in)" : it.tone === "out" ? "var(--color-out)" : "var(--color-ink)" }}>
          <dd className="font-display font-bold text-2xl tracking-tight leading-none">
            {it.prefix}{mounted ? <CountUp to={it.value} separator="," duration={1.4} /> : it.value.toLocaleString("en-US")}{it.suffix}
          </dd>
          <dt className="text-[0.72rem] text-ink-muted mt-1.5 leading-snug">{it.label}</dt>
        </div>
      ))}
    </dl>
  );
}
