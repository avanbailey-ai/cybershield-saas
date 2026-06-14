/**
 * POST /api/scan/public
 * Unauthenticated, limited scan used on the marketing landing page to demonstrate
 * the product. Returns only a pass/fail signal — no detailed results.
 *
 * INTENTIONAL EXCEPTION: This route calls runScan() directly (bypassing the queue)
 * because it is stateless, unauthenticated, and must return results synchronously
 * for the landing page demo. It does NOT write to the DB, create alerts, or send
 * emails — it is read-only and fire-and-forget.
 *
 * All authenticated scans MUST use orchestrator.enqueueScan() instead.
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

  return NextResponse.json({ url, genericMessage, riskDetected })
}
