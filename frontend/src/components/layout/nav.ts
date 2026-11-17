/** App navigation. Icons are Figma exports in /public/figma. */
export type NavItem = { href: string; label: string; short: string; icon: string; mobile: boolean };

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", short: "Home", icon: "icon-grid.svg", mobile: true },
  { href: "/plan", label: "Training Plan", short: "Plan", icon: "icon-calendar.svg", mobile: true },
  { href: "/nutrition", label: "Nutrition", short: "Fuel", icon: "icon-utensils.svg", mobile: true },
  { href: "/recovery", label: "Recovery", short: "Recovery", icon: "icon-heart.svg", mobile: false },
  { href: "/race", label: "Race Strategy", short: "Race", icon: "icon-trophy-active.svg", mobile: true },
  { href: "/profile", label: "Athlete Profile", short: "Profile", icon: "icon-user.svg", mobile: true },
];

/** Bottom tab order in the mobile design: Home, Plan, Race, Fuel, Profile. */
export const MOBILE_TABS = ["/", "/plan", "/race", "/nutrition", "/profile"].map(
  (href) => NAV.find((n) => n.href === href)!,
);

export const SETTINGS: NavItem = { href: "/settings", label: "Settings", short: "Settings", icon: "icon-settings.svg", mobile: false };

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
