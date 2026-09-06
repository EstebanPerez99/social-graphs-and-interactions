import SpotlightCard from "./bits/SpotlightCard";
import DecryptedText from "./bits/DecryptedText";

// La secuencia real del curso como cuadrícula. Desbloqueada → link al post; bloqueada → tema cifrado + fecha.
export type WeekCard = {
  week: number | string; topic: string; date: string; unlock: string;
  locked: boolean; href?: string; title?: string; description?: string;
};

const Lock = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="inline-block -mt-0.5">
    <rect x="2" y="5" width="8" height="6" rx="1" fill="currentColor" />
    <path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

export default function WeekGrid({ cards }: { cards: WeekCard[] }) {
  return (
    <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
      {cards.map((c) => (
        <li key={String(c.week)} className="min-h-[11rem]">
          {c.locked ? (
            <SpotlightCard className="panel h-full p-5 sm:p-6 text-ink-faint" spotlightColor="rgba(15, 23, 42, 0.05)">
              <div aria-disabled="true" className="flex h-full flex-col">
                <p className="font-mono text-[0.72rem] text-ink-faint">Week {c.week} · {c.date}</p>
                <p className="font-display font-bold text-[1.35rem] leading-tight tracking-tight mt-2 text-ink-muted">
                  <DecryptedText text={c.topic} animateOn="view" sequential revealDirection="start" speed={45}
                                 encryptedClassName="text-ink-faint" />
                </p>
                <p className="font-mono text-[0.72rem] mt-auto pt-5 text-ink-faint flex items-center gap-1.5">
                  <Lock /> Unlocks {c.unlock}
                </p>
              </div>
            </SpotlightCard>
          ) : (
            <a href={c.href} className="block h-full group no-underline">
              <SpotlightCard className="panel h-full p-5 sm:p-6 transition-colors group-hover:border-ink" spotlightColor="rgba(209, 73, 91, 0.16)">
                <div className="flex h-full flex-col">
                  <p className="font-mono text-[0.72rem] text-ink-muted">Week {c.week} · {c.topic} · {c.date}</p>
                  <p className="font-display font-bold text-[1.35rem] leading-tight tracking-tight mt-2 text-ink group-hover:text-in transition-colors">{c.title}</p>
                  <p className="font-body text-[0.95rem] text-ink-muted mt-2 leading-snug">{c.description}</p>
                  <p className="font-mono text-[0.75rem] mt-auto pt-5 text-ink underline underline-offset-4">Read the post →</p>
                </div>
              </SpotlightCard>
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
