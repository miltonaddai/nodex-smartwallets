import { Router, Request, Response } from 'express'
import { coveredChainsText } from '../lib/chains'
import { isValidSolanaAddress } from '../lib/validation'
import { scanToken, scanWithBundle, type ScanChain } from '../services/token-scanner'

const router = Router()

function parseTarget(req: Request): { chain: ScanChain; address: string } | { error: string } {
  const chain = String(req.params.chain)
  const address = String(req.params.address).trim()
  if (chain === 'solana') {
    return isValidSolanaAddress(address) ? { chain, address } : { error: 'That is not a valid Solana token address.' }
  }
  return { error: `Scanning covers ${coveredChainsText()}.` }
}

/** Market, security, holders, smart money and a verdict, from the synthetic dataset. */
router.get('/:chain/:address', (req: Request, res: Response) => {
  const target = parseTarget(req)
  if ('error' in target) return res.status(400).json({ message: target.error })
  res.json(scanToken(target.chain, target.address))
})

/** Launch bundle analysis (Solana), merged into the scan with an updated verdict. */
router.get('/:chain/:address/bundle', (req: Request, res: Response) => {
  const target = parseTarget(req)
  if ('error' in target) return res.status(400).json({ message: target.error })
  if (target.chain !== 'solana') {
    return res.status(400).json({ message: 'Bundle analysis covers Solana launches only.' })
  }
  res.json(scanWithBundle(target.address))
})

export default router
