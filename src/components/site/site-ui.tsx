import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

// Shared components for the marketing site (styles are in site-styles.ts).

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

/** "Get started →": underlined text whose arrow slides on hover. */
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
    "group inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors hover:text-[#006aff]",
    className,
  );
  const body = (
    <>
      <span className="underline decoration-1 underline-offset-4">{children}</span>
      <ArrowRight
        size={16}
        className="transition-transform duration-300 ease-out motion-safe:group-hover:translate-x-1"
      />
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
          inverted ? "bg-white text-[#101010]" : "bg-[#101010] text-white",
        )}
      >
        <CalendarCheck size={17} weight="bold" />
      </span>
      <span
        className={cn(
          "text-[22px] font-semibold tracking-[-0.02em]",
          inverted ? "text-white" : "text-[#101010]",
        )}
      >
        Bookly
      </span>
    </Link>
  );
}

export function RoundButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-12 items-center justify-center rounded-full border border-[#dadada] transition-[background-color,border-color,color,transform] duration-200 hover:border-[#101010] hover:bg-[#101010] hover:text-white motion-safe:active:scale-90",
        className,
      )}
    >
      {children}
    </button>
  );
}
