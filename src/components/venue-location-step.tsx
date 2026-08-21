/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { MapPin } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addressFromComponents,
  formatAddress,
  loadGoogleMaps,
  type BusinessAddress,
} from "@/lib/google-maps";
import { countryByCode } from "@/lib/countries";

type Coords = { lat: number; lng: number };

export function VenueLocationStep({
  countryCode,
  address,
  onAddressChange,
  coords,
  onCoordsChange,
}: {
  countryCode: string | null;
  address: BusinessAddress;
  onAddressChange: (value: BusinessAddress) => void;
  coords: Coords | null;
  onCoordsChange: (value: Coords) => void;
}) {
  const country = countryByCode(countryCode ?? "");
  const countryName = country?.name ?? "";

  const [query, setQuery] = useState(() =>
    address.address ? formatAddress(address, countryName) : "",
  );
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [openList, setOpenList] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BusinessAddress>(address);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tokenRef = useRef<any>(null);

  // Autocomplete suggestions (Places API New)
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3 || !openList) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const google = await loadGoogleMaps();
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          await google.maps.importLibrary("places");
        if (!tokenRef.current) tokenRef.current = new AutocompleteSessionToken();
        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            sessionToken: tokenRef.current,
            ...(country ? { includedRegionCodes: [country.code] } : {}),
          });
        if (!cancelled) setSuggestions(results ?? []);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, openList, country]);

  // Map rendering
  useEffect(() => {
    if (!coords || !mapEl.current) return;
    let cancelled = false;
    (async () => {
      const google = await loadGoogleMaps();
      if (cancelled || !mapEl.current) return;
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapEl.current, {
          center: coords,
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
        });
        markerRef.current = new google.maps.Marker({
          position: coords,
          map: mapRef.current,
        });
        mapRef.current.addListener("center_changed", () => {
          const c = mapRef.current.getCenter();
          markerRef.current.setPosition(c);
        });
        mapRef.current.addListener("idle", () => {
          const c = mapRef.current.getCenter();
          onCoordsChange({ lat: c.lat(), lng: c.lng() });
        });
      } else {
        mapRef.current.setCenter(coords);
        markerRef.current?.setPosition(coords);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng]);

  async function selectSuggestion(suggestion: any) {
    setOpenList(false);
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    const place = prediction.toPlace();
    await place.fetchFields({
      fields: ["location", "addressComponents", "formattedAddress"],
    });
    const next: BusinessAddress = {
      ...address,
      ...addressFromComponents(place.addressComponents ?? []),
    };
    onAddressChange(next);
    setDraft(next);
    setQuery(place.formattedAddress ?? prediction.text?.text ?? query);
    if (place.location) {
      onCoordsChange({ lat: place.location.lat(), lng: place.location.lng() });
    }
    tokenRef.current = null;
  }

  async function searchFirstMatch() {
    setOpenList(false);
    if (suggestions.length > 0) {
      await selectSuggestion(suggestions[0]);
      return;
    }
    try {
      const google = await loadGoogleMaps();
      const { Geocoder } = await google.maps.importLibrary("geocoding");
      const geocoder = new Geocoder();
      const { results } = await geocoder.geocode({
        address: query,
        ...(country ? { componentRestrictions: { country: country.code } } : {}),
      });
      const first = results?.[0];
      if (!first) return;
      const next: BusinessAddress = {
        ...address,
        ...addressFromComponents(first.address_components ?? []),
      };
      onAddressChange(next);
      setDraft(next);
      onCoordsChange({
        lat: first.geometry.location.lat(),
        lng: first.geometry.location.lng(),
      });
    } catch {
      /* ignore */
    }
  }

  function openEdit() {
    setDraft(address);
    setEditing(true);
  }

  function saveEdit() {
    onAddressChange(draft);
    setQuery(formatAddress(draft, countryName));
    setEditing(false);
  }

  return (
    <>
      <p className="text-base text-muted-foreground">Account setup</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-[2.9rem]">
        Set your venue&apos;s physical location
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Add your primary business location so your clients can easily find you. Additional
        locations can be added later.
      </p>

      <h2 className="mt-10 text-xl font-bold text-foreground">Business location</h2>

      <div className="mt-5 space-y-2">
        <Label htmlFor="venue-address" className="text-[15px] font-semibold">
          Where is your business located?
        </Label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="venue-address"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenList(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void searchFirstMatch();
              }
            }}
            className="h-14 rounded-xl pl-12 text-base"
          />
          {openList && suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              {suggestions.slice(0, 6).map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => void selectSuggestion(s)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-secondary"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>{s.placePrediction?.text?.text ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {coords ? (
        <div className="mt-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <div ref={mapEl} className="h-72 w-full bg-secondary" />
            <div className="flex items-center justify-between gap-4 border-t border-border bg-card px-5 py-4">
              <p className="text-[15px] text-foreground">
                {formatAddress(address, countryName) || countryName}
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-6"
                onClick={openEdit}
              >
                Edit
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Drag the map to adjust the pin position
          </p>
        </div>
      ) : null}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Edit business location</DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Address"
              value={draft.address}
              onChange={(v) => setDraft({ ...draft, address: v })}
            />
            <Field
              label="Apt./Suite etc"
              counter={`${draft.apt.length}/100`}
              maxLength={100}
              value={draft.apt}
              onChange={(v) => setDraft({ ...draft, apt: v })}
            />
            <Field
              label="District"
              value={draft.district}
              onChange={(v) => setDraft({ ...draft, district: v })}
            />
            <Field
              label="City"
              value={draft.city}
              onChange={(v) => setDraft({ ...draft, city: v })}
            />
            <Field
              label="County"
              value={draft.county}
              onChange={(v) => setDraft({ ...draft, county: v })}
            />
            <Field
              label="State"
              value={draft.state}
              onChange={(v) => setDraft({ ...draft, state: v })}
            />
            <Field
              label="Postcode"
              value={draft.postcode}
              onChange={(v) => setDraft({ ...draft, postcode: v })}
            />
            <div className="space-y-2">
              <Label className="text-[15px] font-semibold">Country</Label>
              <Input value={countryName} disabled className="h-12 rounded-xl bg-muted" />
            </div>
          </div>

          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[15px] font-semibold">Directions</Label>
              <span className="text-sm text-muted-foreground">{draft.directions.length}/200</span>
            </div>
            <Textarea
              maxLength={200}
              rows={4}
              placeholder="Add details to help clients find your location"
              className="rounded-xl"
              value={draft.directions}
              onChange={(e) => setDraft({ ...draft, directions: e.target.value })}
            />
          </div>

          <DialogFooter className="mt-4 gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-7"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full bg-ink px-7 text-ink-foreground hover:bg-ink/90"
              onClick={saveEdit}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  counter,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  counter?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[15px] font-semibold">{label}</Label>
        {counter ? <span className="text-sm text-muted-foreground">{counter}</span> : null}
      </div>
      <Input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-xl"
      />
    </div>
  );
}
