import type { ReactNode } from "react";

export function PageShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="surface-card flex min-h-64 flex-col items-center justify-center gap-2 p-10 text-center">
      <p className="text-sm font-medium text-foreground">{label} coming soon</p>
      <p className="max-w-md text-sm text-muted-foreground">
        This section is scaffolded and ready for its first feature.
      </p>
    </div>
  );
}
