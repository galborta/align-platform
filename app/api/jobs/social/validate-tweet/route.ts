import { NextResponse } from 'next/server'
import { validateTweetUrl } from '@/lib/social-jobs'

/**
 * POST /api/jobs/social/validate-tweet
 * 
 * Validates a tweet URL format and extracts tweet metadata
 * 
 * Request body:
 * - tweet_url: string - The tweet URL to validate
 * 
 * Response:
 * - valid: boolean - Whether the URL is valid
 * - tweet_id?: string - Extracted tweet ID (if valid)
 * - error?: string - Error message (if invalid)
 * 
 * @example Valid request
 * ```json
 * {
 *   "tweet_url": "https://twitter.com/user/status/1234567890"
 * }
 * ```
 * 
 * @example Valid response
 * ```json
 * {
 *   "valid": true,
 *   "tweet_id": "1234567890"
 * }
 * ```
 * 
 * Future Enhancement: Integrate Twitter API to fetch tweet metadata
 * - Verify tweet exists
 * - Check if tweet is deleted
 * - Extract engagement metrics (likes, retweets, views)
 * - Validate tweet author
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tweet_url } = body

    // Validate input
    if (!tweet_url || typeof tweet_url !== 'string') {
      return NextResponse.json(
        { 
          valid: false,
          error: 'tweet_url is required and must be a string' 
        },
        { status: 400 }
      )
    }

    // Validate URL format
    const isValid = validateTweetUrl(tweet_url)

    if (!isValid) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid tweet URL format. Must be https://(twitter.com|x.com)/[username]/status/[tweet_id]'
        },
        { status: 200 } // Return 200 with valid:false for client handling
      )
    }

    // Extract tweet ID from URL
    const tweetIdMatch = tweet_url.match(/\/status\/(\d+)/)
    const tweetId = tweetIdMatch ? tweetIdMatch[1] : null

    // TODO: Optional Twitter API integration
    // If TWITTER_API_KEY is configured, fetch tweet metadata:
    // - Check if tweet exists
    // - Get engagement metrics
    // - Verify tweet author
    // - Check if tweet is deleted/suspended
    //
    // const twitterApiKey = process.env.TWITTER_API_KEY
    // if (twitterApiKey && tweetId) {
    //   try {
    //     const tweetData = await fetchTweetFromTwitterAPI(tweetId, twitterApiKey)
    //     return NextResponse.json({
    //       valid: true,
    //       tweet_id: tweetId,
    //       metadata: {
    //         author: tweetData.author,
    //         text: tweetData.text,
    //         created_at: tweetData.created_at,
    //         metrics: tweetData.public_metrics
    //       }
    //     })
    //   } catch (apiError) {
    //     return NextResponse.json({
    //       valid: false,
    //       error: 'Tweet not found or inaccessible'
    //     })
    //   }
    // }

    console.log('[Validate Tweet] Valid URL:', {
      tweet_url,
      tweet_id: tweetId
    })

    return NextResponse.json({
      valid: true,
      tweet_id: tweetId
    })

  } catch (error: any) {
    console.error('[Validate Tweet] Error:', error)
    
    return NextResponse.json(
      { 
        valid: false,
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jobs/social/validate-tweet
 * Returns method not allowed
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}

