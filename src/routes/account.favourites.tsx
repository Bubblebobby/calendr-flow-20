import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "@phosphor-icons/react";

import { EmptyState, outlinePill, VenueTile } from "@/components/customer/customer-ui";
import { FavouriteButton, useFavourites } from "@/components/customer/favourites";
import { fetchVenues } from "@/lib/customer";

export const Route = createFileRoute("/account/favourites")({
  head: () => ({ meta: [{ title: "Favourites — Bookly" }] }),
  component: FavouritesPage,
});

function FavouritesPage() {
  const favourites = useFavourites();
  const ids = favourites.data ?? [];
  const venues = useQuery({
    queryKey: ["venues", "ids", ids],
    enabled: ids.length > 0,
    queryFn: () => fetchVenues({ ids }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-display font-semibold">Favourites</h1>
      {favourites.isLoading || (ids.length > 0 && venues.isLoading) ? (
        <p className="text-body text-muted-foreground">Loading…</p>
      ) : ids.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favourites yet"
          text="Tap the heart on a salon's page to save it here."
          action={
            <Link to="/discover" className={outlinePill}>
              Start searching
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(venues.data ?? []).map((venue) => (
            <VenueTile
              key={venue.id}
              venue={venue}
              action={<FavouriteButton businessId={venue.id} compact />}
            />
          ))}
        </div>
      )}
      {ids.length > 0 && venues.data && venues.data.length < ids.length ? (
        <p className="text-caption text-muted-foreground">
          Salons that have paused online booking are hidden.
        </p>
      ) : null}
    </div>
  );
}
