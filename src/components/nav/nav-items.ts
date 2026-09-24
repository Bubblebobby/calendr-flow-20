import {
  CalendarBlank,
  Gear,
  Globe,
  House,
  Package,
  Receipt,
  UserSquare,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";

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
  {
    key: "calendar",
    title: "Calendar",
    to: "/calendar",
    icon: CalendarBlank,
    groups: [
      {
        title: "Scheduling",
        children: [
          { title: "Calendar view", to: "/calendar" },
          { title: "Waitlist", to: "/calendar" },
        ],
      },
    ],
  },
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
        title: "Client list",
        children: [
          { title: "All clients", to: "/clients" },
          { title: "Reviews", to: "/clients" },
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
          { title: "Services", to: "/catalog", search: { tab: "services" } },
          { title: "Packages", to: "/catalog", search: { tab: "packages" } },
          { title: "Products", to: "/catalog", search: { tab: "products" } },
          { title: "Inventory", to: "/catalog", search: { tab: "inventory" } },
        ],
      },
    ],
  },
  {
    key: "online-booking",
    title: "Online Booking",
    to: "/online-booking",
    icon: Globe,
    groups: [
      {
        title: "Booking",
        children: [
          { title: "Booking link", to: "/online-booking" },
          { title: "Booking settings", to: "/online-booking" },
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
          { title: "Team members", to: "/team" },
          { title: "Scheduled shifts", to: "/team" },
          { title: "Timesheets", to: "/team" },
        ],
      },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    to: "/settings",
    icon: Gear,
    groups: [
      {
        title: "Workspace",
        children: [
          { title: "Business details", to: "/settings" },
          { title: "Business hours", to: "/settings" },
          { title: "Locations", to: "/settings" },
          { title: "Billing", to: "/settings" },
        ],
      },
    ],
  },
];
