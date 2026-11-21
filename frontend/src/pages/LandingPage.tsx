import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Minus, Plus } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Seo } from '@/components/Seo'
import { Navbar } from '@/components/layout/Navbar'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { XLink } from '@/components/layout/SocialLinks'
import { RisingBars, SignalField } from '@/components/landing/canvas'
import { StoryScroll } from '@/components/landing/StoryScroll'
import { Crosshairs, ProductWindow, Rule } from '@/components/landing/visuals'
import { DASHBOARD_HOME_PATH } from '@/lib/paths'
import { cn } from '@/lib/utils'

// There are no accounts, so the calls to action open the app.
const appTo = DASHBOARD_HOME_PATH
const ctaLabel = 'Open the app'

const buttonBase =
  'group inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-sm font-semibold transition-all duration-200 active:scale-[0.98]'
const primaryButton = cn(buttonBase, 'bg-nodex-accent text-nodex-on-accent hover:brightness-110')
const lightButton = cn(buttonBase, 'bg-nodex-foreground text-nodex-bg hover:opacity-90')

function PrimaryCta({ className }: { className?: string }) {
  return (
    <Link to={appTo} className={cn(primaryButton, className)}>
      {ctaLabel}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-xs font-medium uppercase tracking-[0.2em] text-nodex-teal', className)}>{children}</span>
}

/** Product facts only. No user counts or testimonials we can't back up. */
const stats = [
  { value: 'PnL', label: 'Realized and unrealized, per wallet', tone: 'bg-nodex-accent text-nodex-on-accent' },
  { value: 'Win %', label: 'Every wallet scored on its hit rate', tone: 'bg-nodex-surface' },
  { value: '24H–30D', label: 'Timeframes to rank wallets by', tone: 'bg-nodex-raised' },
  { value: '$0', label: 'To follow any wallet', tone: 'bg-nodex-foreground text-nodex-bg' },
]

const without = [
  'Copying a wallet from a screenshot with no idea of its record',
  'Guessing which wallets win and which just got lucky once',
  'Finding out a "whale" was one insider split across many wallets',
  'Checking explorers by hand to see what a trader just bought',
]

const withNodex = [
  'Wallets ranked by profit, win rate and volume',
  'Every position a wallet holds, with its entry and ROI',
  'The tokens top wallets are buying together, right now',
  'A watchlist of the wallets you follow, in one place',
]

const faqs = [
  {
    question: 'What is a smart wallet?',
    answer:
      'A wallet with a track record worth following: consistent profit, a high win rate and real volume over the timeframe you pick. Nodex ranks wallets on those numbers, not on follower counts.',
  },
  {
    question: 'What can I see for each wallet?',
    answer:
      'Its profit for the period, realized and unrealized PnL, win rate, volume and trade count, plus every token position with the entry, amount bought and ROI.',
  },
  {
    question: 'Whose wallets are these?',
    answer:
      'In this offline build they are synthetic, pseudonymous wallets generated locally from a fixed seed. No real traders, wallets or market data are included.',
  },
  {
    question: 'Do I need an account to follow wallets?',
    answer:
      'No. Every page is open, and the wallets you add to your watchlist are kept by the local server.',
  },
  {
    question: 'Is Nodex financial advice?',
    answer:
      'No. Nodex is on-chain research. A wallet that has won before can still lose, so use it as one input to your own decisions.',
  },
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="border-t border-nodex-line">
      {faqs.map((faq, index) => {
        const isOpen = open === index
        return (
          <div key={faq.question} className="border-b border-nodex-line">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : index)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-medium transition-colors hover:text-nodex-teal md:text-xl"
            >
              {faq.question}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-nodex-line">
                {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pb-6 text-base leading-7 text-nodex-muted">{faq.answer}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

function LandingFooter() {
  const columns = [
    {
      title: 'Product',
      links: [
        { label: 'Smart wallets', href: '#product' },
        { label: 'Wallet profiles', href: '#product' },
        { label: 'Watchlist', href: '#product' },
        { label: 'Token scanner', href: '#product' },
      ],
    },
    {
      title: 'Nodex',
      links: [
        { label: 'FAQ', href: '#faq' },
      ],
    },
  ]
  return (
    <footer className="relative overflow-hidden bg-nodex-accent text-[#ffffff]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-16 md:grid-cols-[1fr_auto] md:px-8 md:pt-20">
        <div>
          <BrandLogo variant="icon" className="h-10" />
          <p className="mt-4 max-w-xs text-sm leading-6 text-[#ffffff]/75">
            Find the most profitable wallets on Solana and follow every move they make.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-16 gap-y-10 sm:grid-cols-4">
          {columns.map((column) => (
            <div key={column.title}>
              <div className="mb-3 text-sm text-[#ffffff]/55">{column.title}</div>
              <ul className="space-y-2 text-sm font-medium">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="transition-opacity hover:opacity-70">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <div className="mb-3 text-sm text-[#ffffff]/55">Follow</div>
            <XLink className="text-sm font-medium" withHandle />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 flex max-w-7xl items-center justify-between gap-4 px-4 text-xs text-[#ffffff]/60 md:px-8">
        <span>© {new Date().getFullYear()} Nodex</span>
        <span className="text-right">On-chain research, not financial advice.</span>
      </div>
      {/* The wordmark, sized to the page width and cropped at the bottom edge. */}
      <div aria-hidden className="mt-6 -mb-[4vw] px-4 md:px-8">
        <BrandLogo className="h-auto w-full text-[#ffffff]" />
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <PageLayout pattern={false}>
      <Seo />
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pt-28 pb-16 text-center md:px-8">
          <div className="absolute inset-0">
            <SignalField />
          </div>
          {/* Fade the field out at the edges and behind the headline so the copy stays readable. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 55% 45% at 50% 55%, var(--color-nodex-bg) 20%, transparent 75%), linear-gradient(to bottom, var(--color-nodex-bg), transparent 22%, transparent 78%, var(--color-nodex-bg))',
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <span className="inline-flex items-center gap-2 border border-nodex-line bg-nodex-bg/80 px-3 py-1.5 text-xs text-nodex-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-nodex-teal opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-nodex-teal" />
              </span>
              Smart wallet tracker for Solana
            </span>
            <h1 className="mx-auto mt-8 max-w-5xl text-[clamp(2.75rem,9vw,7.5rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
              Track the wallets
              <br />
              <span className="text-nodex-teal">that win.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-base leading-7 text-nodex-muted md:text-lg md:leading-8">
              Find the most profitable wallets on Solana, see their PnL, win rate and every position, and follow what they buy next.
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <PrimaryCta />
              <a href="#product" className={lightButton}>
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs text-nodex-muted">No account needed · Follow any wallet · Synthetic sample data</p>
          </motion.div>
        </section>

        {/* Product */}
        <section id="product" className="scroll-mt-24 px-4 pb-24 md:px-8 md:pb-32">
          <Rule className="mx-auto mb-16 max-w-7xl md:mb-24" />
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-16">
            <motion.div {...reveal}>
              <Label>Smart Wallets</Label>
              <h2 className="mt-5 text-4xl leading-[1.02] font-semibold tracking-[-0.035em] md:text-6xl">
                The best wallets, ranked by what they earn.
              </h2>
              <p className="mt-6 max-w-md text-base leading-7 text-nodex-muted md:text-lg">
                Sort wallets by profit, win rate or volume over 24 hours, 7 days or 30 days, then open any one to see exactly what it holds and what it is buying.
              </p>
            </motion.div>
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="relative p-3 sm:p-5">
              <Crosshairs className="text-nodex-muted" />
              <div className="absolute inset-0 border border-dashed border-nodex-line" aria-hidden />
              <div className="relative">
                <ProductWindow />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Product tour */}
        <section className="pb-24 md:pb-32">
          <div className="mx-auto mb-12 max-w-7xl px-4 md:px-8 lg:mb-0">
            <motion.div {...reveal} className="max-w-2xl">
              <Label>How it works</Label>
              <h2 className="mt-5 text-4xl leading-[1.02] font-semibold tracking-[-0.035em] md:text-6xl">
                From wallet to trade in one tab.
              </h2>
            </motion.div>
          </div>
          <StoryScroll />
        </section>

        {/* Before / after */}
        <section className="px-4 pb-24 md:px-8 md:pb-32">
          <Rule className="mx-auto mb-16 max-w-7xl md:mb-24" />
          <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-2">
            <motion.div {...reveal} className="bg-nodex-surface p-6 sm:p-10">
              <h3 className="text-3xl font-semibold tracking-[-0.03em] md:text-5xl">Following blind</h3>
              <ul className="mt-10 space-y-2">
                {without.map((item) => (
                  <li key={item} className="flex items-start gap-4 bg-nodex-bg px-5 py-4 text-sm text-nodex-muted md:text-base">
                    <span className="mt-1.5 h-2 w-2 shrink-0 bg-nodex-red/70" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="flex flex-col bg-nodex-surface p-6 sm:p-10">
              <h3 className="text-3xl font-semibold tracking-[-0.03em] md:text-5xl">
                Following with <span className="text-nodex-teal">Nodex</span>
              </h3>
              <ul className="mt-10 space-y-2">
                {withNodex.map((item) => (
                  <li key={item} className="flex items-start gap-4 bg-nodex-bg px-5 py-4 text-sm md:text-base">
                    <span className="mt-1.5 h-2 w-2 shrink-0 bg-nodex-teal" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to={appTo} className={cn(primaryButton, 'mt-8 w-full justify-between rounded-none px-5')}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Stats band */}
        <section className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.08 }}
              className={cn('relative flex min-h-44 flex-col justify-between p-5 md:min-h-56 md:p-8', stat.tone)}
            >
              <span aria-hidden className="absolute top-4 right-4 h-1.5 w-1.5 bg-current opacity-80" />
              <span aria-hidden className="absolute right-4 bottom-4 h-1.5 w-1.5 bg-current opacity-80" />
              <span className="text-4xl font-light tracking-[-0.04em] sm:text-5xl md:text-7xl">{stat.value}</span>
              <span className="text-sm font-medium">{stat.label}</span>
            </motion.div>
          ))}
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 px-4 pb-24 md:px-8 md:pb-32">
          <Rule className="mx-auto mb-16 max-w-7xl md:mb-24" />
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.6fr_1.4fr]">
            <motion.div {...reveal}>
              <Label>FAQ</Label>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.035em] md:text-5xl">Questions, answered.</h2>
            </motion.div>
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
              <Faq />
            </motion.div>
          </div>
        </section>

        {/* Closing */}
        <section className="relative flex min-h-[80svh] flex-col items-center justify-center overflow-hidden px-4 py-24 text-center md:px-8">
          <div className="absolute inset-0">
            <RisingBars />
          </div>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, var(--color-nodex-bg) 5%, transparent 55%)' }}
          />
          <motion.div {...reveal} className="relative">
            <Label>Start tracking</Label>
            <h2 className="mx-auto mt-6 max-w-4xl text-[clamp(2.5rem,7vw,6rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
              Know what the best wallets are doing.
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-base text-nodex-muted md:text-lg">
              Every smart wallet on Solana, free to follow.
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <PrimaryCta />
            </div>
          </motion.div>
        </section>
      </main>
      <LandingFooter />
    </PageLayout>
  )
}
