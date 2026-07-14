/**
 * Profile module design system — Lucide outline icons + reusable UI primitives.
 * Visual / UX only. No data or routing side effects.
 */
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  Bell,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Crown,
  Diamond,
  Eye,
  Filter,
  Heart,
  Home,
  Info,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wrench,
  Briefcase,
  Megaphone,
  Link2,
  Sparkles,
  Smartphone,
  Sofa,
  Car,
  Building2,
  Wheat,
  UtensilsCrossed,
  Shirt,
  X,
  LogOut,
  KeyRound,
  Monitor,
  Download,
  FileDown,
  Shield,
  Lock,
  UserCircle,
} from 'lucide-react'

export const ICON_STROKE = 1.75
export const ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 22,
  '2xl': 28,
}

const REGISTRY = {
  home: Home,
  user: User,
  package: Package,
  checkCircle: CheckCircle2,
  check: Check,
  shieldCheck: ShieldCheck,
  users: Users,
  shoppingBag: ShoppingBag,
  settings: Settings,
  store: Store,
  plusCircle: PlusCircle,
  camera: Camera,
  mapPin: MapPin,
  phone: Phone,
  mail: Mail,
  calendar: Calendar,
  badgeCheck: BadgeCheck,
  star: Star,
  trendingUp: TrendingUp,
  activity: Activity,
  bell: Bell,
  heart: Heart,
  messageCircle: MessageCircle,
  search: Search,
  filter: Filter,
  share2: Share2,
  eye: Eye,
  pencil: Pencil,
  trash2: Trash2,
  moreHorizontal: MoreHorizontal,
  refreshCw: RefreshCw,
  loaderCircle: LoaderCircle,
  alertCircle: AlertCircle,
  info: Info,
  chevronRight: ChevronRight,
  crown: Crown,
  diamond: Diamond,
  circle: Circle,
  wrench: Wrench,
  briefcase: Briefcase,
  megaphone: Megaphone,
  link2: Link2,
  sparkles: Sparkles,
  smartphone: Smartphone,
  sofa: Sofa,
  car: Car,
  building2: Building2,
  wheat: Wheat,
  utensils: UtensilsCrossed,
  shirt: Shirt,
  x: X,
  logOut: LogOut,
  keyRound: KeyRound,
  monitor: Monitor,
  download: Download,
  fileDown: FileDown,
  shield: Shield,
  lock: Lock,
  userCircle: UserCircle,
  // aliases used in nav / sections
  overview: Home,
  profile: User,
  selling: Package,
  sold: CheckCircle2,
  trust: ShieldCheck,
  network: Users,
  buying: ShoppingBag,
  account: Settings,
  shop: Store,
  post: PlusCircle,
  verified: BadgeCheck,
  analytics: TrendingUp,
  notifications: Bell,
  saved: Heart,
  messages: MessageCircle,
  share: Share2,
  edit: Pencil,
  delete: Trash2,
  more: MoreHorizontal,
  relist: RefreshCw,
  markSold: Check,
  loading: LoaderCircle,
  warning: AlertCircle,
  location: MapPin,
  email: Mail,
  availability: Megaphone,
  services: Wrench,
  jobs: Briefcase,
  following: Link2,
  mutual: RefreshCw,
  seed: Sparkles,
  discover: Search,
}

/** Lucide icon by registry key */
export function MpIcon({ name = 'circle', size = 18, className = '', strokeWidth = ICON_STROKE, ...rest }) {
  const Comp = REGISTRY[name] || Circle
  return (
    <Comp
      size={size}
      strokeWidth={strokeWidth}
      className={`mp-icon ${className}`.trim()}
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    />
  )
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`mp-ds-badge mp-ds-badge--${tone} ${className}`.trim()}>{children}</span>
}

export function Chip({ children, icon, onClick, active, className = '', disabled }) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`mp-ds-chip${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <span className="mp-ds-chip-ic"><MpIcon name={icon} size={14} /></span> : null}
      {children}
    </Tag>
  )
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  tone = 'neutral',
  size = 'md',
  className = '',
  type = 'button',
}) {
  return (
    <button
      type={type}
      className={`mp-ds-icon-btn mp-ds-icon-btn--${tone} mp-ds-icon-btn--${size} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <MpIcon name={icon} size={size === 'sm' ? 15 : size === 'lg' ? 20 : 17} />
      {label && size !== 'sm' ? <span className="mp-ds-icon-btn-txt">{label}</span> : null}
    </button>
  )
}

export function PageHeader({ title, subtitle, kicker, action, className = '' }) {
  return (
    <header className={`mp-ds-page-head ${className}`.trim()}>
      <div className="mp-ds-page-head-text">
        {kicker ? <p className="mp-ds-kicker">{kicker}</p> : null}
        <h2 className="mp-ds-page-title">{title}</h2>
        {subtitle ? <p className="mp-ds-page-sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="mp-ds-page-head-action">{action}</div> : null}
    </header>
  )
}

export function SectionHeader({ title, subtitle, action, actionLabel, onAction, className = '' }) {
  return (
    <div className={`mp-ds-section-head ${className}`.trim()}>
      <div className="mp-ds-section-head-text">
        <h3 className="mp-ds-section-title">{title}</h3>
        {subtitle ? <p className="mp-ds-section-sub">{subtitle}</p> : null}
      </div>
      {action || (actionLabel && onAction) ? (
        <div className="mp-ds-section-head-action">
          {action || (
            <button type="button" className="mp-ds-link" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function DashboardCard({ title, subtitle, icon, children, footer, className = '', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`mp-ds-card ${onClick ? 'is-clickable' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      {(title || icon) && (
        <div className="mp-ds-card-head">
          {icon ? (
            <span className="mp-ds-card-ic">
              <MpIcon name={icon} size={18} />
            </span>
          ) : null}
          <div className="mp-ds-card-head-text">
            {title ? <div className="mp-ds-card-title">{title}</div> : null}
            {subtitle ? <div className="mp-ds-card-sub">{subtitle}</div> : null}
          </div>
        </div>
      )}
      <div className="mp-ds-card-body">{children}</div>
      {footer ? <div className="mp-ds-card-foot">{footer}</div> : null}
    </Tag>
  )
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  trend,
  trendUp,
  onClick,
  placeholder,
  className = '',
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`mp-od-stat mp-ds-stat${onClick ? ' is-clickable' : ''}${placeholder ? ' is-placeholder' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      <div className="mp-od-stat-top mp-ds-stat-top">
        {icon ? (
          <span className="mp-od-stat-ic mp-ds-stat-ic">
            <MpIcon name={icon} size={18} />
          </span>
        ) : null}
        {trend ? (
          <span className={`mp-od-stat-trend mp-ds-stat-trend${trendUp === false ? ' is-down' : trendUp ? ' is-up' : ''}`}>
            {trend}
          </span>
        ) : null}
      </div>
      <strong className="mp-od-stat-value mp-ds-stat-value">{value}</strong>
      <span className="mp-od-stat-label mp-ds-stat-label">{label}</span>
      {hint ? <span className="mp-od-stat-hint mp-ds-stat-hint">{hint}</span> : null}
    </Tag>
  )
}

export function ActionCard({ icon, label, sub, onClick, accent, badge, className = '' }) {
  return (
    <button
      type="button"
      className={`mp-ds-action${accent ? ` mp-ds-action--${accent}` : ''} ${className}`.trim()}
      onClick={onClick}
    >
      <span className="mp-ds-action-ic">
        <MpIcon name={icon} size={20} />
      </span>
      <span className="mp-ds-action-copy">
        <span className="mp-ds-action-label">{label}</span>
        {sub ? <span className="mp-ds-action-sub">{sub}</span> : null}
      </span>
      {badge != null && badge !== '' ? <em className="mp-ds-action-badge">{badge}</em> : null}
      <span className="mp-ds-action-arrow" aria-hidden="true">
        <MpIcon name="chevronRight" size={16} />
      </span>
    </button>
  )
}

export function EmptyState({
  icon = 'info',
  title,
  text,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className = '',
}) {
  return (
    <div className={`mp-ds-empty ${className}`.trim()}>
      <div className="mp-ds-empty-art" aria-hidden="true">
        <div className="mp-ds-empty-blob" />
        <span className="mp-ds-empty-ic">
          <MpIcon name={icon} size={28} />
        </span>
      </div>
      {title ? <h4 className="mp-ds-empty-title">{title}</h4> : null}
      {text ? <p className="mp-ds-empty-text">{text}</p> : null}
      {(actionLabel || secondaryLabel) && (
        <div className="mp-ds-empty-actions">
          {actionLabel && onAction ? (
            <button type="button" className="mp-btn-primary" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          {secondaryLabel && onSecondary ? (
            <button type="button" className="mp-btn-secondary" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function Timeline({ items, empty, timeAgo }) {
  if (!items?.length) {
    return empty || <EmptyState icon="activity" title="No activity yet" text="Events will show up here." />
  }
  return (
    <ul className="mp-ds-timeline">
      {items.map((item) => (
        <li key={item.id} className={`mp-ds-tl-item mp-ds-tl-item--${item.tone || 'default'}`}>
          <span className="mp-ds-tl-dot" aria-hidden="true">
            {typeof item.icon === 'string' && REGISTRY[item.icon]
              ? <MpIcon name={item.icon} size={15} />
              : (item.iconEmoji || item.icon || <MpIcon name="circle" size={12} />)}
          </span>
          {item.onClick ? (
            <button type="button" className="mp-ds-tl-btn" onClick={item.onClick}>
              <span className="mp-ds-tl-text">{item.text}</span>
              <span className="mp-ds-tl-time">
                {item.whenLabel || (item.when && timeAgo ? `${timeAgo(item.when)} ago` : '')}
              </span>
            </button>
          ) : (
            <div className="mp-ds-tl-static">
              <span className="mp-ds-tl-text">{item.text}</span>
              <span className="mp-ds-tl-time">
                {item.whenLabel || (item.when && timeAgo ? `${timeAgo(item.when)} ago` : '')}
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

export function ProfileCard({
  avatar,
  name,
  verified,
  meta,
  pills,
  children,
  actions,
  className = '',
  onClick,
}) {
  return (
    <article className={`mp-ds-profile-card ${className}`.trim()}>
      <div className="mp-ds-profile-card-top">
        <button type="button" className="mp-ds-profile-avatar-btn" onClick={onClick} aria-label={name}>
          {avatar}
        </button>
        <div className="mp-ds-profile-card-id">
          <div className="mp-ds-profile-name-row">
            <button type="button" className="mp-ds-profile-name" onClick={onClick}>{name}</button>
            {verified ? <MpIcon name="badgeCheck" size={15} className="mp-ds-verified" /> : null}
          </div>
          {meta ? <div className="mp-ds-profile-meta">{meta}</div> : null}
          {pills ? <div className="mp-ds-profile-pills">{pills}</div> : null}
          {children}
        </div>
      </div>
      {actions ? <div className="mp-ds-profile-actions">{actions}</div> : null}
    </article>
  )
}

export function SkeletonLoader({ variant = 'card', className = '', count = 1 }) {
  const items = Array.from({ length: count })
  if (variant === 'stat') {
    return (
      <div className={`mp-ds-skel-row ${className}`.trim()}>
        {items.map((_, i) => <div key={i} className="mp-ds-skel mp-ds-skel-stat" />)}
      </div>
    )
  }
  if (variant === 'line') {
    return items.map((_, i) => <div key={i} className={`mp-ds-skel mp-ds-skel-line ${className}`.trim()} />)
  }
  if (variant === 'avatar') {
    return items.map((_, i) => <div key={i} className={`mp-ds-skel mp-ds-skel-avatar ${className}`.trim()} />)
  }
  return items.map((_, i) => <div key={i} className={`mp-ds-skel mp-ds-skel-card ${className}`.trim()} />)
}

export function sellerLevelIcon(tier) {
  if (tier === 4) return 'crown'
  if (tier === 3) return 'star'
  if (tier === 2) return 'diamond'
  return 'circle'
}

export default {
  MpIcon,
  Badge,
  Chip,
  IconButton,
  PageHeader,
  SectionHeader,
  DashboardCard,
  StatCard,
  ActionCard,
  EmptyState,
  Timeline,
  ProfileCard,
  SkeletonLoader,
  sellerLevelIcon,
}
