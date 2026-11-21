import { cn } from '@/lib/utils'

/** A square on/off switch. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 border transition-colors disabled:opacity-50',
        checked ? 'border-nodex-accent bg-nodex-accent' : 'border-nodex-line bg-nodex-raised'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 transition-all',
          checked ? 'left-[22px] bg-nodex-on-accent' : 'left-0.5 bg-nodex-muted'
        )}
      />
    </button>
  )
}
