import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { SiteIcon } from "./site-styles";

// Shared components for the marketing site (styles are in site-styles.ts).

/** A Material Symbols Sharp glyph, sized in px. Decorative: pair it with visible text or a label. */
export function Icon({
  name,
  size = 24,
  className,
}: {
  name: SiteIcon;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "material-symbols-sharp inline-block shrink-0 select-none overflow-hidden leading-none",
        className,
      )}
      style={{ fontSize: size, width: size, height: size }}
    >
      {name}
    </span>
  );
}

/**
 * A heading that rises in word by word: as it scrolls into view (driven by its own scroll
 * position, see .site-words in styles.css), or straight away on load for the hero.
 */
export function Words({ text, onLoad }: { text: string; onLoad?: boolean }) {
  return (
    <span className={cn("block", onLoad ? "site-words-load" : "site-words")}>
      {text.split(" ").map((word, index) => (
        <Fragment key={index}>
          {index > 0 ? " " : null}
          <span className="site-word" style={{ "--i": index } as CSSProperties}>
            {word}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Square's ArrowLink: underlined text and an arrow that nudges forward and back on hover
 * (.site-nudge in styles.css).
 */
export function ArrowLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  /** In-site path or #anchor; defaults to sign-up. */
  href?: string;
}) {
  const classes = cn(
    "site-arrow-link inline-flex min-h-11 items-center gap-1 text-base font-medium",
    className,
  );
  const body = (
    <>
      <span className="underline decoration-1 underline-offset-4">{children}</span>
      <Icon name="arrow_forward" size={18} className="site-nudge" />
    </>
  );
  return href ? (
    <a href={href} className={classes}>
      {body}
    </a>
  ) : (
    <Link to="/auth" className={classes}>
      {body}
    </Link>
  );
}

export function Logo({ inverted }: { inverted?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Bookly home">
      <span
        className={cn(
          "flex size-[26px] items-center justify-center rounded-[5px]",
          inverted ? "bg-white text-black" : "bg-black text-white",
        )}
      >
        <CalendarCheck size={17} weight="bold" />
      </span>
      <span
        className={cn(
          "text-[22px] font-semibold tracking-[-0.02em]",
          inverted ? "text-white" : "text-black",
        )}
      >
        Bookly
      </span>
    </Link>
  );
}

/** Slider arrow: a bare arrow like Square's, with a 44px tap area; fades on hover. */
export function RoundButton({
  label,
  onClick,
  icon,
  className,
}: {
  label: string;
  onClick: () => void;
  icon: SiteIcon;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-full transition-[opacity,transform] duration-150 ease-[cubic-bezier(0,0,0.2,1)] hover:opacity-70 active:translate-y-[5%]",
        className,
      )}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}
