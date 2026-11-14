import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  CloudSun,
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  FileText,
  House,
  Keyboard,
  Languages,
  Layers,
  Droplets,
  FlaskConical,
  SlidersHorizontal,
  LocateFixed,
  MapPin,
  Pentagon,
  Plus,
  Printer,
  Scale,
  Search,
  Settings,
  Share2,
  Sprout,
  Square,
  Trash2,
  TrendingUp,
  Upload,
  Wheat,
  X,
  Tractor,
  Store,
  Users,
  Coins,
  Wallet,
  CalendarDays,
  Satellite,
  Sparkles,
  Waves,
  Leaf,
  Mountain,
  RotateCcw,
  Atom,
  TestTubeDiagonal,
  type LucideProps,
} from "lucide-react";

/**
 * One icon set for the whole app (Lucide). Pages ask for a meaning, not a
 * glyph, so a swap stays in this file. Decorative by default (aria-hidden);
 * pass `label` for an icon that stands alone.
 */
const ICONS = {
  add: Plus,
  archive: Archive,
  back: ChevronLeft,
  backArrow: ArrowLeft,
  close: X,
  compare: Scale,
  conditions: CloudSun,
  coordinates: Keyboard,
  locate: LocateFixed,
  outline: Pentagon,
  pin: MapPin,
  profile: Wheat,
  search: Search,
  box: Square,
  done: Check,
  download: Download,
  fields: House,
  language: Languages,
  learn: BookOpen,
  location: MapPin,
  more: Ellipsis,
  next: ChevronRight,
  print: Printer,
  remove: Trash2,
  report: FileText,
  restore: Upload,
  rotation: Sprout,
  settings: Settings,
  share: Share2,
  stack: Layers,
  trends: TrendingUp,
  water: Droplets,
  soil: FlaskConical,
  priorities: SlidersHorizontal,
  equipment: Tractor,
  market: Store,
  labour: Users,
  price: Coins,
  cost: Wallet,
  calendar: CalendarDays,
  satellite: Satellite,
  estimate: Sparkles,
  salinity: Waves,
  organic: Leaf,
  clay: Mountain,
  reset: RotateCcw,
  nitrogen: Atom,
  ph: TestTubeDiagonal,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  label,
  size = 18,
  strokeWidth = 1.9,
  ...rest
}: { name: IconName; label?: string } & Omit<LucideProps, "ref">) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      {...rest}
    />
  );
}
