/* Shared icon component — maps semantic names to lucide-react icons.
   Used wherever an icon is stored as data (pillars, stats, contact, formations…). */
import {
  Home,
  Brain,
  Wrench,
  Handshake,
  User,
  TrendingUp,
  Star,
  MapPin,
  Phone,
  Mail,
  Clock,
  BookOpen,
  Hammer,
  CookingPot,
  Play,
} from 'lucide-react';

const iconMap = {
  home: Home,
  brain: Brain,
  wrench: Wrench,
  handshake: Handshake,
  user: User,
  'trending-up': TrendingUp,
  star: Star,
  'map-pin': MapPin,
  phone: Phone,
  mail: Mail,
  clock: Clock,
  book: BookOpen,
  hammer: Hammer,
  'cooking-pot': CookingPot,
  play: Play,
};

export default function AppIcon({ name, className = 'w-5 h-5', ...props }) {
  const IconComponent = iconMap[name];
  if (!IconComponent) return null;
  return <IconComponent className={className} aria-hidden="true" {...props} />;
}
