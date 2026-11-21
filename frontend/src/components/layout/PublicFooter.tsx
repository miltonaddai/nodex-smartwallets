import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { XLink } from '@/components/layout/SocialLinks'

const linkClass = 'transition-colors hover:text-nodex-teal'

/**
 * Footer for the public pages.
 * The landing page passes its own section links; every other page gets the default set.
 */
export function PublicFooter({ links }: { links?: ReactNode }) {
  return (
    <footer className="border-t border-nodex-line px-4 py-10 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm text-nodex-muted sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" aria-label="Nodex home" className="text-nodex-teal">
          <BrandLogo className="h-7" />
        </Link>
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          {links ?? (
            <>
              <Link to="/" className={linkClass}>Home</Link>
              <Link to="/wallets" className={linkClass}>Open app</Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-5">
          <XLink className="text-nodex-muted hover:text-nodex-teal hover:opacity-100" withHandle />
          <span>© {new Date().getFullYear()} Nodex</span>
        </div>
      </div>
    </footer>
  )
}
