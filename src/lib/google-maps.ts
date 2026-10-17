/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __booklyMapsInit?: () => void;
  }
}

let loader: Promise<any> | null = null;

// Google calls window.gm_authFailure when the key is rejected (e.g. not allowed on this domain).
let mapsFailed = false;
const failureListeners = new Set<() => void>();

function markMapsFailed() {
  mapsFailed = true;
  failureListeners.forEach((listener) => listener());
}

/** Subscribe to "Google Maps can't be used here"; fires immediately if that's already known. */
export function onMapsUnavailable(listener: () => void) {
  if (mapsFailed) listener();
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loader) return loader;

  const key = import.meta.env['VITE_GOOGLE_MAPS_BROWSER_KEY'] as
    | string
    | undefined;
  const channel = import.meta.env['VITE_GOOGLE_MAPS_TRACKING_ID'] as
    | string
    | undefined;

  loader = new Promise((resolve, reject) => {
    if (!key) {
      markMapsFailed();
      reject(new Error("Google Maps key is not configured"));
      return;
    }
    (window as any).gm_authFailure = markMapsFailed;
    window.__booklyMapsInit = () => resolve(window.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places&callback=__booklyMapsInit${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    script.onerror = () => {
      markMapsFailed();
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loader;
}

export type BusinessAddress = {
  address: string;
  apt: string;
  district: string;
  city: string;
  county: string;
  state: string;
  postcode: string;
  directions: string;
};

export const EMPTY_ADDRESS: BusinessAddress = {
  address: "",
  apt: "",
  district: "",
  city: "",
  county: "",
  state: "",
  postcode: "",
  directions: "",
};

export function addressFromComponents(components: any[]): Partial<BusinessAddress> {
  const get = (type: string, short = false) => {
    const c = components?.find((item) => (item.types ?? []).includes(type));
    if (!c) return "";
    return short ? (c.shortText ?? c.short_name ?? "") : (c.longText ?? c.long_name ?? "");
  };
  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  return {
    address: street || get("premise") || "",
    district: get("sublocality") || get("neighborhood") || "",
    city: get("locality") || get("postal_town") || "",
    county: get("administrative_area_level_2") || "",
    state: get("administrative_area_level_1") || "",
    postcode: get("postal_code") || "",
  };
}

export function formatAddress(a: BusinessAddress, country: string) {
  return [a.address, a.apt, a.district, a.city, a.state, a.postcode, country]
    .filter(Boolean)
    .join(", ");
}
