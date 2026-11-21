import { Router, Request, Response } from 'express'
import { deleteSavedFilter, listSavedFilters, saveFilter, SavedFilterError } from '../services/saved-filters-store'

/** Saved custom filters for the Smart Wallets table. */
const router = Router()

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await listSavedFilters())
  } catch (error) {
    console.error('Failed to list saved filters:', error)
    res.status(500).json({ message: 'Could not load your saved filters' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name : ''
  try {
    res.status(201).json(await saveFilter(name, req.body?.rules))
  } catch (error) {
    if (error instanceof SavedFilterError) return res.status(400).json({ message: error.message })
    console.error('Failed to save filter:', error)
    res.status(500).json({ message: 'Could not save the filter' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  try {
    await deleteSavedFilter(id)
    res.json({ success: true })
  } catch (error) {
    console.error('Failed to delete saved filter:', error)
    res.status(500).json({ message: 'Could not delete the filter' })
  }
})

export default router
