import BlurText from "./bits/BlurText";

// Un solo reveal por página, en el h1 del post (DESIGN.md → Motion).
export default function PostTitle({ text }: { text: string }) {
  return (
    <div role="heading" aria-level={1}
         className="font-display font-extrabold text-[2.2rem] sm:text-[3rem] leading-[1.02] tracking-[-0.02em] mt-2">
      <BlurText text={text} animateBy="words" direction="top" delay={70} stepDuration={0.28} className="flex flex-wrap" />
    </div>
  );
}
