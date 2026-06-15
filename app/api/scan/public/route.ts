/**
 * POST /api/scan/public
 * Unauthenticated, stateless scan for the public /scan page and landing demo.
 * Returns risk score and vulnerability summary — no DB writes.
 */
import { runScan } from '@/lib/scanner/runScan'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { url } = body
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  const result = await runScan(url)

  const riskDetected = result.score < 60
  const genericMessage = riskDetected
    ? 'Risk Detected — upgrade to see full details'
    : 'No major issues found — upgrade for continuous monitoring'

  return NextResponse.json({
    url: result.url,
    score: result.score,
    riskLevel: result.riskLevel,
    issues: result.issues,
    vulnerabilitiesCount: result.issues.length,
    genericMessage,
    riskDetected,
  })
}
