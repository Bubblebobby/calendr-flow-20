import { cn } from "@/lib/utils";

// Neutral grey (not tinted by the brand colour); still for people who prefer reduced motion.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-foreground/[0.07] motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
