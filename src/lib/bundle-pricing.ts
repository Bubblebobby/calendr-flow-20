/**
 * Bundle price/duration maths shared by the bundle form and the service menu list.
 * Currency formatting always happens at the edges using the business's own currency.
 */

export type BundlePricingMode =
  | "service_pricing"
  | "custom"
  | "percentage_discount"
  | "free";

export type BundleScheduleType = "sequence" | "parallel";

export type BundleServiceLike = {
  price: number | null;
  duration_minutes: number;
};

export function servicesSubtotal(services: BundleServiceLike[]): number {
  return services.reduce((sum, service) => sum + (Number(service.price) || 0), 0);
}

export function bundleDuration(
  services: BundleServiceLike[],
  scheduleType: BundleScheduleType,
): number {
  if (services.length === 0) return 0;
  if (scheduleType === "parallel") {
    return Math.max(...services.map((service) => service.duration_minutes || 0));
  }
  return services.reduce((sum, service) => sum + (service.duration_minutes || 0), 0);
}

export function bundlePrice(
  options: {
    pricing_mode: BundlePricingMode;
    custom_price?: number | null;
    discount_percentage?: number | null;
  },
  services: BundleServiceLike[],
): number {
  const subtotal = servicesSubtotal(services);
  switch (options.pricing_mode) {
    case "free":
      return 0;
    case "custom":
      return Number(options.custom_price) || 0;
    case "percentage_discount": {
      const pct = Math.min(Math.max(Number(options.discount_percentage) || 0, 0), 100);
      return subtotal - (subtotal * pct) / 100;
    }
    default:
      return subtotal;
  }
}
