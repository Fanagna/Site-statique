import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './icons';

/* Apple-style admin shell: frosted-glass collapsible sidebar + topbar + mobile drawer.
   Props:
   - groups: [{ group, items: [{ key, label, icon, badge? }] }]
   - activeKey / onNavigate(key)
   - title / subtitle
   - search: { value, onChange, placeholder } | undefined
   - actions: ReactNode rendered on the right of the topbar
   - footerNav: [{ key, label, icon, to? }] | undefined
   - user / onLogout
   - children */
export default function AdminLayout({
  groups,
  activeKey,
  onNavigate,
  title,
  subtitle,
  search,
  actions,
  footerNav,
  user,
  onLogout,
  children,
}) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('arina_sidebar') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('arina_dark');
    if (stored !== null) return stored === '1';
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const toggleDark = () => {
    setDark((d) => {
      localStorage.setItem('arina_dark', d ? '0' : '1');
      return !d;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem('arina_sidebar', c ? '0' : '1');
      return !c;
    });
  };

  const renderNav = (compact) => (
    <nav className="flex-1 overflow-y-auto scroll-slim px-3 space-y-5 py-3">
      {groups.map((g) => (
        <div key={g.group}>
          {!compact && (
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ios-text3">
              {g.group}
            </div>
          )}
          <div className="space-y-0.5">
            {g.items.map((item) => {
              const active = item.key === activeKey;
              const badge = typeof item.badge === 'function' ? item.badge() : item.badge;
              const btnClass = `relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                active
                  ? 'bg-arina-warm text-arina-blue font-semibold'
                  : 'text-ios-text2 hover:bg-ios-fill hover:text-ios-text'
              } ${compact ? 'justify-center' : ''}`;
              const inner = (
                <>
                  {active && !compact && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-arina-blue" />
                  )}
                  <span className="flex-shrink-0">
                    <Icon name={item.icon} className="w-[18px] h-[18px]" />
                  </span>
                  {!compact && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!compact && badge > 0 && (
                    <span
                      className={`ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 tabular ${
                        active ? 'bg-arina-blue text-white' : 'bg-ios-text3/15 text-ios-text2'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </>
              );
              return item.to ? (
                <Link
                  key={item.key}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  title={compact ? item.label : undefined}
                  className={btnClass}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={item.key}
                  onClick={() => {
                    onNavigate(item.key);
                    setMobileOpen(false);
                  }}
                  title={compact ? item.label : undefined}
                  className={btnClass}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const renderFooter = (compact) => (
    <div className="flex-shrink-0 p-3 border-t border-ios-hairline">
      {footerNav && (
        <div className={`space-y-0.5 ${compact ? 'mb-2' : 'mb-1'}`}>
          {footerNav.map((n) =>
            n.to ? (
              <Link
                key={n.key}
                to={n.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ios-text2 hover:bg-ios-fill hover:text-ios-text transition-colors ${
                  compact ? 'justify-center' : ''
                }`}
                title={compact ? n.label : undefined}
              >
                <Icon name={n.icon} className="w-[18px] h-[18px]" />
                {!compact && <span>{n.label}</span>}
              </Link>
            ) : (
              <a
                key={n.key}
                href={n.href}
                target={n.external ? '_blank' : undefined}
                rel="noreferrer"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ios-text2 hover:bg-ios-fill hover:text-ios-text transition-colors ${
                  compact ? 'justify-center' : ''
                }`}
                title={compact ? n.label : undefined}
              >
                <Icon name={n.icon} className="w-[18px] h-[18px]" />
                {!compact && <span>{n.label}</span>}
              </a>
            )
          )}
        </div>
      )}

      {compact ? (
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-arina-blue to-arina-blue-dark text-white flex items-center justify-center text-[13px] font-bold">
            {(user?.username || 'A').slice(0, 2).toUpperCase()}
          </div>
          <button
            onClick={onLogout}
            title="Déconnexion"
            className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors"
          >
            <Icon name="logout" className="w-[18px] h-[18px]" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl p-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-arina-blue to-arina-blue-dark text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">
            {(user?.username || 'A').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{user?.username}</div>
            <div className="text-[10px] text-ios-text3">Administrateur</div>
          </div>
          <button
            onClick={onLogout}
            title="Déconnexion"
            className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors"
          >
            <Icon name="logout" className="w-[18px] h-[18px]" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen bg-ios-bg text-ios-text flex transition-colors duration-300 ${dark ? 'dark' : ''}`}>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden lg:flex flex-col flex-shrink-0 h-screen sticky top-0 glass border-r border-ios-hairline transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          collapsed ? 'w-[78px]' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div
          className={`flex items-center h-16 flex-shrink-0 px-4 border-b border-ios-hairline ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center w-full' : ''}`}>
            <img src="/logo-arina.jpg" alt="" className="w-9 h-9 rounded-[10px] object-contain shadow-sm flex-shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">ARINA Admin</div>
                <div className="text-[10px] text-ios-text3 truncate">Gestion &amp; suivi</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-lg text-ios-text3 hover:bg-ios-fill hover:text-ios-text transition-colors"
              title="Réduire la barre latérale"
            >
              <Icon name="chevronLeft" className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-2 border-b border-ios-hairline">
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-lg text-ios-text3 hover:bg-ios-fill hover:text-ios-text transition-colors"
              title="Agrandir la barre latérale"
            >
              <Icon name="chevronRight" className="w-4 h-4" />
            </button>
          </div>
        )}

        {renderNav(collapsed)}
        {renderFooter(collapsed)}
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-ios-card flex flex-col shadow-2xl animate-pop">
            <div className="flex items-center justify-between h-16 px-4 border-b border-ios-hairline">
              <div className="flex items-center gap-2.5">
                <img src="/logo-arina.jpg" alt="" className="w-9 h-9 rounded-[10px] object-contain" />
                <div>
                  <div className="text-sm font-bold">ARINA Admin</div>
                  <div className="text-[10px] text-ios-text3">Gestion &amp; suivi</div>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-ios-text3 hover:bg-ios-fill"
              >
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            {renderNav(false)}
            {renderFooter(false)}
          </aside>
        </div>
      )}

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 glass border-b border-ios-hairline">
          <div className="flex items-center gap-3 h-16 px-4 lg:px-8">
            <button
              className="lg:hidden p-2 -ml-2 rounded-lg text-ios-text2 hover:bg-ios-fill transition-colors"
              onClick={() => setMobileOpen(true)}
              title="Menu"
            >
              <Icon name="menu" className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] font-bold leading-tight truncate">{title}</h1>
              {subtitle && <p className="text-xs text-ios-text3 truncate hidden sm:block">{subtitle}</p>}
            </div>
            <div className="flex-1" />
            {search && (
              <div className="relative hidden md:block w-56 lg:w-72">
                <Icon
                  name="search"
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ios-text3 pointer-events-none"
                />
                <input
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  placeholder={search.placeholder || 'Rechercher…'}
                  className="w-full pl-9 pr-4 py-2 rounded-full bg-ios-fill text-sm placeholder:text-ios-text3 focus:outline-none focus:ring-2 focus:ring-arina-blue/30 focus:bg-ios-card transition-all"
                />
              </div>
            )}
            {/* Dark mode toggle (Apple style) */}
            <button
              onClick={toggleDark}
              className="relative w-9 h-9 flex items-center justify-center rounded-full text-ios-text2 hover:bg-ios-fill transition-colors"
              title={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
              aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              <Icon
                name="moon"
                className={`w-[18px] h-[18px] absolute transition-all duration-300 ${
                  dark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
                }`}
              />
              <Icon
                name="sun"
                className={`w-[18px] h-[18px] absolute transition-all duration-300 ${
                  dark ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
                }`}
              />
            </button>
            {actions && <div className="flex items-center gap-1.5">{actions}</div>}
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 lg:px-8 py-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
