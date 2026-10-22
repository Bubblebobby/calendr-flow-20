import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/*
 * How clients reach a salon: address, phone, email and website. Used on the booking
 * confirmation and the manage-booking page. Returns null until the contact database
 * update has been run, so those pages still work without it.
 */

export type BusinessLocation = {
  address?: string;
  apt?: string;
  district?: string;
  city?: string;
  state?: string;
  postcode?: string;
} | null;

export type BusinessContact = {
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  location: BusinessLocation;
};

export function useBusinessContact(slug: string | null | undefined) {
  return useQuery({
    queryKey: ["business-contact", slug],
    enabled: Boolean(slug),
    retry: false,
    queryFn: async (): Promise<BusinessContact | null> => {
      const { data, error } = await supabase.rpc("get_business_contact", { p_slug: slug! });
      if (error) return null;
      return (data as unknown as BusinessContact | null) ?? null;
    },
  });
}

/** "12 Allen Avenue, Ikeja, Lagos" */
export function formatAddress(location: BusinessLocation) {
  if (!location) return "";
  return [location.address, location.apt, location.district, location.city, location.state, location.postcode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function mapsUrl(name: string, address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}`)}`;
}

/** Saves an .ics file so the client can add the appointment to their calendar. */
export function downloadCalendarFile({
  title,
  start,
  end,
  location,
  description,
}: {
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
}) {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookly//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${stamp(start)}-${Math.random().toString(36).slice(2)}@bookly`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(title)}`,
    location ? `LOCATION:${text(location)}` : "",
    description ? `DESCRIPTION:${text(description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "appointment.ics";
  link.click();
  URL.revokeObjectURL(url);
}

export function fullName(person: { first_name: string; last_name?: string | null }) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ");
}
