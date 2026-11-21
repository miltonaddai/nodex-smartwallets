import { create } from 'zustand'
import { api } from '@/lib/api'
import { loadSavedFilters, storeSavedFilters, type FilterRule, type SavedFilter } from '@/lib/custom-filters'
import { toast } from '@/stores/toastStore'

/**
 * Saved custom filters for the Smart Wallets table, kept by the local server. Filters saved in
 * this browser by older builds move to the server on first load. If the server can't be reached
 * they stay in the browser.
 */
interface SavedFiltersState {
  list: SavedFilter[]
  /** True once the server copy has loaded. */
  onAccount: boolean
  loaded: boolean
  load: () => Promise<void>
  save: (name: string, rules: FilterRule[]) => Promise<void>
  remove: (id: string) => Promise<void>
  reset: () => void
}

const byName = (name: string) => (filter: SavedFilter) => filter.name.toLowerCase() === name.toLowerCase()
const failure = (title: string, err: unknown) =>
  toast({ title, description: err instanceof Error ? err.message : undefined, tone: 'error' })

let loading: Promise<void> | null = null

export const useSavedFiltersStore = create<SavedFiltersState>((set, get) => ({
  list: loadSavedFilters(),
  onAccount: false,
  loaded: false,

  load: () => {
    loading ??= (async () => {
      try {
        const remote = await api.filters.list()
        const merged = [...remote]
        for (const filter of loadSavedFilters()) {
          if (merged.some(byName(filter.name))) continue
          try {
            merged.push(await api.filters.save(filter.name, filter.rules))
          } catch {
            // Over the limit or invalid; the rest still move.
          }
        }
        // The server holds the copy now, so the browser's is cleared.
        storeSavedFilters([])
        set({ list: merged, onAccount: true, loaded: true })
      } catch {
        set({ loaded: true })
      } finally {
        loading = null
      }
    })()
    return loading
  },

  save: async (name, rules) => {
    const replace = (saved: SavedFilter) => [...get().list.filter((item) => !byName(saved.name)(item)), saved]
    if (!get().onAccount) {
      const next = replace({ id: `${Date.now()}`, name, rules })
      storeSavedFilters(next)
      set({ list: next })
      return
    }
    try {
      const saved = await api.filters.save(name, rules)
      set({ list: replace(saved) })
      toast({
        title: 'Filter saved',
        description: `"${name}" is saved.`,
        tone: 'success',
      })
    } catch (err) {
      failure('Could not save the filter', err)
    }
  },

  remove: async (id) => {
    const previous = get().list
    const next = previous.filter((item) => item.id !== id)
    set({ list: next })
    if (!get().onAccount) {
      storeSavedFilters(next)
      return
    }
    try {
      await api.filters.remove(id)
    } catch (err) {
      set({ list: previous })
      failure('Could not delete the filter', err)
    }
  },

  reset: () => set({ list: [], onAccount: false, loaded: false }),
}))
