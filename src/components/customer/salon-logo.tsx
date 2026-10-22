import { logoUrl } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** A salon's uploaded logo, contained in a square; nothing when it hasn't uploaded one. */
export function SalonLogo({
  path,
  name,
  size = 48,
  className,
}: {
  path: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const src = logoUrl(path);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-lg bg-white object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
