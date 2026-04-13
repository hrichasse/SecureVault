import { NextResponse } from 'next/server'

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and deployment verification.
 * Returns a 200 OK with the app version and current timestamp.
 *
 * Azure App Service and load balancers can ping this endpoint
 * to verify the application is running correctly.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    { status: 200 }
  )
}
