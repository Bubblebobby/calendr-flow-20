import { EnvelopeSimple, Globe, MapPin, Phone } from "@phosphor-icons/react";

import { formatAddress, mapsUrl, type BusinessContact } from "@/lib/business-contact";

/** Address (with directions), phone, email and website for a salon. Renders nothing if there are none. */
export function SalonContact({ contact, className }: { contact: BusinessContact; className?: string }) {
  const address = formatAddress(contact.location);
  const rows = [
    address
      ? { icon: MapPin, label: address, href: mapsUrl(contact.name, address), action: "Directions" }
      : null,
    contact.phone
      ? { icon: Phone, label: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`, action: "Call" }
      : null,
    contact.email ? { icon: EnvelopeSimple, label: contact.email, href: `mailto:${contact.email}`, action: "Email" } : null,
    contact.website
      ? { icon: Globe, label: contact.website.replace(/^https?:\/\//, "").replace(/\/$/, ""), href: contact.website, action: "Visit" }
      : null,
  ].filter((row) => row !== null);
  if (rows.length === 0) return null;
  return (
    <ul className={className}>
      {rows.map(({ icon: Icon, label, href, action }) => (
        <li key={action} className="flex items-center gap-3 py-2 text-body">
          <Icon size={20} className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 break-words">{label}</span>
          <a
            href={href}
            {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
            className="shrink-0 font-semibold text-primary hover:underline"
          >
            {action}
          </a>
        </li>
      ))}
    </ul>
  );
}
