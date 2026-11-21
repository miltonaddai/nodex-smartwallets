import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Wallet, Star, Moon, Sun, ScanEye, ScanSearch, Settings } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { useTheme } from '@/context/theme-context'
import { DASHBOARD_HOME_PATH } from '@/lib/paths'
import { cn } from '@/lib/utils'

interface NavbarProps {
  variant?: 'public' | 'dashboard'
}

const navItems = [
  // TOKENS PAGE DISABLED — { label: 'Tokens', path: '/tokens', icon: Coins },
  { label: 'Smart Wallets', path: '/wallets', icon: Wallet },
  { label: 'Insiders', path: '/insiders', icon: ScanEye },
  { label: 'Scanner', path: '/scanner', icon: ScanSearch },
  { label: 'Watchlist', path: '/watchlist', icon: Star },
]

/** Every page renders its own Navbar, so the drop-in plays once per visit, not on every route. */
let hasEntered = false

const spring = { type: 'spring', stiffness: 380, damping: 32 } as const

/**
 * The full wordmark from 360px up; `sizeClass` shrinks it on phones to fit beside the actions.
 * Narrower screens (older small phones) only have room for the whale.
 */
function Logo({ sizeClass }: { sizeClass: string }) {
  const marks = (
    <>
      <BrandLogo variant="icon" className="h-6 min-[360px]:hidden" />
      <BrandLogo className={cn('hidden min-[360px]:inline-block', sizeClass)} />
    </>
  )
  return (
    <Link to="/" aria-label="Nodex home" className="group flex shrink-0 items-center pl-1 text-nodex-teal">
      <motion.span whileHover={{ scale: 1.04 }} transition={spring} className="flex items-center">
        {marks}
      </motion.span>
    </Link>
  )
}

export function Navbar({ variant = 'public' }: NavbarProps) {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [animateIn] = useState(() => !hasEntered)

  useEffect(() => {
    hasEntered = true
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const settingsLink = (
    <Link
      to="/settings"
      title="Settings"
      aria-label="Settings"
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-nodex-raised hover:text-nodex-teal',
        location.pathname === '/settings' ? 'text-nodex-teal' : 'text-nodex-muted'
      )}
    >
      <Settings className="h-4 w-4" />
    </Link>
  )

  const themeToggle = (className?: string) => (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-nodex-muted transition-colors hover:bg-nodex-raised hover:text-nodex-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nodex-teal/50',
        className
      )}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.2 }}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  )

  const pillLink =
    'whitespace-nowrap rounded-md bg-nodex-accent px-5 py-2 text-sm font-medium text-nodex-on-accent transition-opacity hover:opacity-90'

  let actions
  if (variant === 'dashboard') {
    actions = (
      <>
        <div className="flex items-center">
          {navItems.map(({ label, path, icon: Icon }) => {
            const active = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                title={label}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm transition-colors sm:px-3.5',
                  active ? 'text-nodex-on-accent' : 'text-nodex-muted hover:text-white'
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={spring}
                    className="absolute inset-0 rounded-sm bg-nodex-accent"
                  />
                ) : null}
                <Icon className="relative h-4 w-4" />
                <span className="relative hidden md:inline">{label}</span>
              </Link>
            )
          })}
        </div>
        <span className="mx-1 hidden h-5 w-px bg-nodex-line sm:block" />
        {themeToggle()}
        {settingsLink}
      </>
    )
  } else {
    actions = (
      <>
        <Link to={DASHBOARD_HOME_PATH} className={pillLink}>
          Open app
        </Link>
        {themeToggle()}
      </>
    )
  }

  return (
    <motion.header
      initial={animateIn ? { opacity: 0, y: -24 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 md:pt-4"
    >
      <motion.nav
        layout
        transition={spring}
        className={cn(
          'pointer-events-auto flex max-w-full items-center gap-3 rounded-md border border-nodex-line bg-nodex-surface p-2.5 transition-shadow duration-300',
          variant === 'public' ? 'w-full max-w-3xl justify-between' : 'w-full max-w-6xl justify-between',
          scrolled ? 'shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]' : 'shadow-[0_2px_10px_-6px_rgba(0,0,0,0.25)]'
        )}
      >
        <Logo
          sizeClass={variant === 'dashboard' ? 'h-5 sm:h-7' : 'h-[22px] sm:h-7'}
        />
        <div className="flex items-center gap-1">{actions}</div>
      </motion.nav>
    </motion.header>
  )
}
