import { randomUUID } from 'crypto'
import { sanitizeRules, type FilterRule } from '../lib/custom-filters'

/**
 * Saved custom filters for the Smart Wallets table. Kept in
 * memory for the life of the server process.
 */
export interface SavedFilter {
  id: string
  name: string
  rules: FilterRule[]
}

export const MAX_SAVED_FILTERS = 20
export const MAX_FILTER_NAME = 32

let filters: SavedFilter[] = []

export class SavedFilterError extends Error {}

export async function listSavedFilters(): Promise<SavedFilter[]> {
  return filters
}

/**
 * Saves a filter. A filter with the same name (any case) is replaced, so "Save" on an existing
 * name updates it rather than duplicating it.
 */
export async function saveFilter(name: string, rawRules: unknown): Promise<SavedFilter> {
  const trimmed = name.trim().slice(0, MAX_FILTER_NAME)
  const rules = sanitizeRules(rawRules)
  if (!trimmed) throw new SavedFilterError('Give the filter a name')
  if (rules.length === 0) throw new SavedFilterError('Add at least one condition')

  const replacing = filters.find((filter) => filter.name.toLowerCase() === trimmed.toLowerCase())
  if (!replacing && filters.length >= MAX_SAVED_FILTERS) {
    throw new SavedFilterError(`You can save up to ${MAX_SAVED_FILTERS} filters. Delete one first.`)
  }

  const saved: SavedFilter = { id: replacing?.id ?? randomUUID(), name: trimmed, rules }
  filters = [...filters.filter((filter) => filter.id !== replacing?.id), saved]
  return saved
}

export async function deleteSavedFilter(id: string): Promise<void> {
  filters = filters.filter((filter) => filter.id !== id)
}
