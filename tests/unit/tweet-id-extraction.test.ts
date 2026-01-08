/**
 * Unit Tests: Tweet ID Extraction & Duplicate Detection
 * 
 * Tests the extractTweetId utility function which is critical for
 * preventing duplicate tweet submissions across different URL formats.
 */

import { describe, it, expect } from '@jest/globals'
import { extractTweetId, validateTweetUrl } from '@/lib/social-jobs'

describe('extractTweetId', () => {
  describe('Valid Tweet URLs', () => {
    it('should extract ID from twitter.com URL', () => {
      const url = 'https://twitter.com/user/status/123456789'
      expect(extractTweetId(url)).toBe('123456789')
    })
    
    it('should extract ID from x.com URL', () => {
      const url = 'https://x.com/user/status/987654321'
      expect(extractTweetId(url)).toBe('987654321')
    })
    
    it('should extract ID from URL with query parameters', () => {
      const url = 'https://twitter.com/user/status/123456789?s=20'
      expect(extractTweetId(url)).toBe('123456789')
    })
    
    it('should extract ID from URL with photo path', () => {
      const url = 'https://twitter.com/user/status/123456789/photo/1'
      expect(extractTweetId(url)).toBe('123456789')
    })
    
    it('should extract ID from URL with video path', () => {
      const url = 'https://x.com/user/status/123456789/video/1'
      expect(extractTweetId(url)).toBe('123456789')
    })
    
    it('should handle URLs with complex query strings', () => {
      const url = 'https://twitter.com/user/status/123456789?s=20&t=abc123xyz'
      expect(extractTweetId(url)).toBe('123456789')
    })
    
    it('should handle URLs with username containing underscores', () => {
      const url = 'https://twitter.com/user_name_123/status/123456789'
      expect(extractTweetId(url)).toBe('123456789')
    })
  })
  
  describe('Invalid or Malformed URLs', () => {
    it('should return null for non-Twitter URLs', () => {
      const url = 'https://facebook.com/post/123456789'
      expect(extractTweetId(url)).toBeNull()
    })
    
    it('should return null for empty string', () => {
      expect(extractTweetId('')).toBeNull()
    })
    
    it('should return null for null input', () => {
      expect(extractTweetId(null as any)).toBeNull()
    })
    
    it('should return null for undefined input', () => {
      expect(extractTweetId(undefined as any)).toBeNull()
    })
    
    it('should return null for malformed URL without status', () => {
      const url = 'https://twitter.com/user'
      expect(extractTweetId(url)).toBeNull()
    })
    
    it('should return null for URL with non-numeric status ID', () => {
      const url = 'https://twitter.com/user/status/abc123'
      expect(extractTweetId(url)).toBeNull()
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle very long tweet IDs', () => {
      const url = 'https://twitter.com/user/status/1234567890123456789'
      expect(extractTweetId(url)).toBe('1234567890123456789')
    })
    
    it('should extract first ID if multiple status paths (malformed)', () => {
      const url = 'https://twitter.com/user/status/111/status/222'
      expect(extractTweetId(url)).toBe('111')
    })
    
    it('should handle mobile URL format', () => {
      const url = 'https://mobile.twitter.com/user/status/123456789'
      expect(extractTweetId(url)).toBe('123456789')
    })
  })
})

describe('validateTweetUrl', () => {
  describe('Valid URLs', () => {
    it('should validate twitter.com URL', () => {
      expect(validateTweetUrl('https://twitter.com/user/status/123456789')).toBe(true)
    })
    
    it('should validate x.com URL', () => {
      expect(validateTweetUrl('https://x.com/user/status/123456789')).toBe(true)
    })
    
    it('should validate URL with query parameters', () => {
      expect(validateTweetUrl('https://twitter.com/user/status/123456789?s=20')).toBe(true)
    })
  })
  
  describe('Invalid URLs', () => {
    it('should reject non-Twitter URLs', () => {
      expect(validateTweetUrl('https://facebook.com/post/123')).toBe(false)
    })
    
    it('should reject malformed URLs', () => {
      expect(validateTweetUrl('not a url')).toBe(false)
    })
    
    it('should reject empty string', () => {
      expect(validateTweetUrl('')).toBe(false)
    })
    
    it('should reject null input', () => {
      expect(validateTweetUrl(null as any)).toBe(false)
    })
  })
})

describe('Duplicate Detection Scenarios', () => {
  const tweetId = '123456789'
  
  const urls = [
    `https://twitter.com/user1/status/${tweetId}`,
    `https://x.com/user2/status/${tweetId}`,
    `https://twitter.com/user3/status/${tweetId}?s=20`,
    `https://x.com/user4/status/${tweetId}?s=20&t=abc`,
    `https://twitter.com/user5/status/${tweetId}/photo/1`,
  ]
  
  it('should detect all variations as same tweet', () => {
    const extractedIds = urls.map(url => extractTweetId(url))
    
    // All should extract to the same ID
    expect(extractedIds).toEqual([
      tweetId,
      tweetId,
      tweetId,
      tweetId,
      tweetId
    ])
    
    // All unique IDs should be just one
    const uniqueIds = [...new Set(extractedIds)]
    expect(uniqueIds).toHaveLength(1)
    expect(uniqueIds[0]).toBe(tweetId)
  })
  
  it('should differentiate between different tweets', () => {
    const url1 = 'https://twitter.com/user/status/111111111'
    const url2 = 'https://twitter.com/user/status/222222222'
    const url3 = 'https://x.com/user/status/333333333'
    
    const id1 = extractTweetId(url1)
    const id2 = extractTweetId(url2)
    const id3 = extractTweetId(url3)
    
    expect(id1).not.toBe(id2)
    expect(id2).not.toBe(id3)
    expect(id1).not.toBe(id3)
  })
})

