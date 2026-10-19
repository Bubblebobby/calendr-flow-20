import { CalendarBlank, ChartLineUp, Gear, Globe, House, Megaphone, Package, Receipt, SquaresFour, UserSquare, UsersThree, type Icon } from "@phosphor-icons/react";

export type NavChild = {
  title: string;
  to: string;
  search?: Record<string, string>;
};

export type NavGroup = {
  title: string;
  children: NavChild[];
};

export type NavItem = {
  key: string;
  title: string;
  to: string;
  icon: Icon;
  groups?: NavGroup[];
};

export const navItems: NavItem[] = [
  { key: "home", title: "Home", to: "/home", icon: House },
  // Like Fresha, the calendar has no sub-menu: it takes the full width, and the
  // waitlist lives in the calendar toolbar.
  { key: "calendar", title: "Calendar", to: "/calendar", icon: CalendarBlank },
  {
    key: "sales",
    title: "Sales",
    to: "/sales",
    icon: Receipt,
    groups: [
      {
        title: "Sales",
        children: [
          { title: "Daily sales summary", to: "/sales", search: { tab: "daily" } },
          { title: "Register", to: "/sales", search: { tab: "register" } },
          { title: "Appointments", to: "/sales", search: { tab: "appointments" } },
          { title: "Sales", to: "/sales", search: { tab: "sales" } },
          { title: "Payments", to: "/sales", search: { tab: "payments" } },
        ],
      },
      {
        title: "Sold items",
        children: [
          { title: "Gift cards sold", to: "/sales", search: { tab: "gift-cards" } },
          { title: "Packages sold", to: "/sales", search: { tab: "packages" } },
          { title: "Memberships sold", to: "/sales", search: { tab: "memberships" } },
        ],
      },
    ],
  },
  {
    key: "clients",
    title: "Clients",
    to: "/clients",
    icon: UserSquare,
    groups: [
      {
        title: "Clients",
        children: [
          { title: "Clients list", to: "/clients", search: { tab: "list" } },
          { title: "Client segments", to: "/clients", search: { tab: "segments" } },
        ],
      },
      {
        title: "Engage",
        children: [
          { title: "Client loyalty", to: "/clients", search: { tab: "loyalty" } },
          { title: "Online reputation", to: "/clients", search: { tab: "reviews" } },
        ],
      },
    ],
  },
  {
    key: "catalog",
    title: "Catalog",
    to: "/catalog",
    icon: Package,
    groups: [
      {
        title: "Catalog",
        children: [
          { title: "Service menu", to: "/catalog", search: { tab: "services" } },
          { title: "Packages", to: "/catalog", search: { tab: "packages" } },
          { title: "Products", to: "/catalog", search: { tab: "products" } },
        ],
      },
      {
        title: "Inventory",
        children: [
          { title: "Stocktakes", to: "/catalog", search: { tab: "stocktakes" } },
          { title: "Stock orders", to: "/catalog", search: { tab: "orders" } },
          { title: "Suppliers", to: "/catalog", search: { tab: "suppliers" } },
        ],
      },
    ],
  },
  {
    key: "online-booking",
    title: "Online booking",
    to: "/online-booking",
    icon: Globe,
    groups: [
      {
        title: "Online booking",
        children: [
          { title: "Booking profile", to: "/online-booking", search: { tab: "profile" } },
          { title: "Reserve with Google", to: "/online-booking", search: { tab: "google" } },
          { title: "Facebook and Instagram bookings", to: "/online-booking", search: { tab: "social" } },
          { title: "Link builder", to: "/online-booking", search: { tab: "links" } },
          { title: "Smart website", to: "/online-booking", search: { tab: "website" } },
        ],
      },
    ],
  },
  {
    key: "marketing",
    title: "Marketing",
    to: "/marketing",
    icon: Megaphone,
    groups: [
      {
        title: "Marketing",
        children: [
          { title: "Blast campaigns", to: "/marketing", search: { tab: "campaigns" } },
          { title: "Automations", to: "/marketing", search: { tab: "automations" } },
          { title: "Messages history", to: "/marketing", search: { tab: "history" } },
        ],
      },
      {
        title: "Promote",
        children: [
          { title: "Deals", to: "/marketing", search: { tab: "deals" } },
          { title: "Smart pricing", to: "/marketing", search: { tab: "pricing" } },
          { title: "Reviews", to: "/clients", search: { tab: "reviews" } },
        ],
      },
    ],
  },
  {
    key: "team",
    title: "Team",
    to: "/team",
    icon: UsersThree,
    groups: [
      {
        title: "Team",
        children: [
          { title: "Team members", to: "/team", search: { tab: "members" } },
          { title: "Scheduled shifts", to: "/team", search: { tab: "shifts" } },
          { title: "Timesheets", to: "/team", search: { tab: "timesheets" } },
          { title: "Pay runs", to: "/team", search: { tab: "payruns" } },
        ],
      },
    ],
  },
  { key: "reports", title: "Reports", to: "/reports", icon: ChartLineUp },
  { key: "add-ons", title: "Add-ons", to: "/add-ons", icon: SquaresFour },
  { key: "settings", title: "Settings", to: "/settings", icon: Gear },
];
