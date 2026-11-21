import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Seo } from '@/components/Seo'
import { Navbar } from '@/components/layout/Navbar'
import { DashboardFooter } from '@/components/layout/DashboardFooter'
import { useTheme } from '@/context/theme-context'
import { cn } from '@/lib/utils'

/** One setting: what it is on the left, the control on the right (stacked on phones). */
function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-nodex-line px-5 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {description ? <div className="mt-1 max-w-md text-sm text-nodex-muted">{description}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <motion.section
      key={title}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h2 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-nodex-muted">{description}</p>
      <div className="border border-nodex-line bg-nodex-surface">{children}</div>
    </motion.section>
  )
}

/* ---------- Sections ---------- */

function PreferencesSection() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Panel title="Preferences" description="How the dashboard looks.">
      <Row title="Theme" description="Saved in this browser.">
        <div className="flex border border-nodex-line p-1">
          {(['light', 'dark'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => theme !== option && toggleTheme()}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 text-sm capitalize transition-colors',
                theme === option ? 'bg-nodex-accent text-nodex-on-accent' : 'text-nodex-muted hover:text-white'
              )}
            >
              {option === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {option}
            </button>
          ))}
        </div>
      </Row>
    </Panel>
  )
}

/* ---------- Page ---------- */

export function SettingsPage() {
  return (
    <PageLayout>
      <Seo title="Settings" noindex />
      <Navbar variant="dashboard" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-28 pb-16 md:px-8">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">Settings</h1>
        <p className="mt-2 mb-8 text-sm text-nodex-muted">Manage your preferences.</p>
        <PreferencesSection />
      </main>
      <DashboardFooter />
    </PageLayout>
  )
}
