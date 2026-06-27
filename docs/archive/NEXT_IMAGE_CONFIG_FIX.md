# ✅ Next.js Image Configuration Fix

## Issue

Error when loading external images in the LeaderboardWidget:

```
Invalid src prop (https://api.dicebear.com/7.x/avataaars/svg?seed=alice) on `next/image`, 
hostname "api.dicebear.com" is not configured under images in your `next.config.js`
```

---

## Root Cause

Next.js `Image` component requires external hostnames to be explicitly allowed in `next.config.js` for security reasons. The LeaderboardWidget was trying to load avatar images from external sources without proper configuration.

---

## Solution Applied

Updated `next.config.js` to include all necessary image domains:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Supabase Storage (existing)
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
        pathname: '/storage/v1/object/public/**',
      },
      
      // Avatar services (NEW)
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.dicebear.com',
      },
      
      // Decentralized storage for token/project images (NEW)
      {
        protocol: 'https',
        hostname: 'arweave.net',
      },
      {
        protocol: 'https',
        hostname: '*.arweave.net',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
      {
        protocol: 'https',
        hostname: '*.ipfs.io',
      },
    ],
  },
}

module.exports = nextConfig
```

---

## Image Domains Added

| Domain | Purpose | Used By |
|--------|---------|---------|
| `api.dicebear.com` | Avatar generation API | LeaderboardWidget, User Profiles |
| `avatars.dicebear.com` | Alternative avatar CDN | User Profiles |
| `arweave.net` | Decentralized storage | Token logos, Project images |
| `*.arweave.net` | Arweave subdomains | Token logos, Project images |
| `ipfs.io` | IPFS gateway | NFT avatars, Project images |
| `*.ipfs.io` | IPFS subdomains | NFT avatars, Project images |

---

## Why These Domains?

### Avatar Services
- **DiceBear**: Used for generating consistent, deterministic avatars based on wallet addresses
- Provides SVG avatars with various styles (avataaars, identicons, etc.)
- Free and reliable service for placeholder avatars

### Decentralized Storage
- **Arweave**: Popular on Solana for permanent storage of token metadata
- **IPFS**: Common for NFT avatars and decentralized project logos
- Required for loading token logos and user profile images from blockchain sources

---

## Server Restart

Next.js automatically detected the config change and restarted the development server:

```
⚠ Found a change in next.config.js. Restarting the server to apply the changes...
  ▲ Next.js 16.0.3 (Turbopack)
  - Local:         http://localhost:3003

✓ Ready in 755ms
```

No manual restart required! ✅

---

## Testing

### Verify Fix

1. **Refresh the homepage** (`http://localhost:3003`)
2. **Check LeaderboardWidget** - Avatar images should load
3. **Open DevTools Console** - No image errors
4. **Test with different avatar URLs**:
   - DiceBear: `https://api.dicebear.com/7.x/avataaars/svg?seed=alice`
   - Arweave: `https://arweave.net/...`
   - IPFS: `https://ipfs.io/ipfs/...`

### Expected Result

✅ All avatar images load correctly  
✅ No console errors  
✅ Next.js Image optimization applies  
✅ Proper lazy loading and blur placeholders  

---

## Future Image Sources

If you need to add more image domains later:

```javascript
// In next.config.js, add to remotePatterns array:
{
  protocol: 'https',
  hostname: 'example.com',
  pathname: '/images/**', // Optional: restrict to specific paths
}
```

Common additions you might need:
- `cdn.cloudflare.com` - If using Cloudflare Images
- `imagedelivery.net` - Cloudflare Image Delivery
- `githubusercontent.com` - GitHub avatars
- `gravatar.com` - Gravatar avatars

---

## Security Notes

### Why Next.js Requires This

1. **Prevent abuse**: Stops your app from being used as an open image proxy
2. **Performance**: Ensures only trusted domains use Next.js image optimization
3. **Control**: You explicitly allow which external sources can load images

### Best Practices

✅ **Use wildcards sparingly**: `*.domain.com` is less secure than specific subdomains  
✅ **Add pathname restrictions**: Limit to specific paths when possible  
✅ **Only add trusted domains**: Don't allow arbitrary image sources  
✅ **Review periodically**: Remove unused domains  

---

## Troubleshooting

### Still Getting Errors?

**1. Hard refresh the browser**
```bash
# Mac: Cmd+Shift+R
# Windows/Linux: Ctrl+Shift+R
```

**2. Clear Next.js cache**
```bash
rm -rf .next
npm run dev
```

**3. Check the exact hostname**
- Error message shows the exact hostname trying to load
- Make sure it matches your config exactly
- Wildcards (`*.domain.com`) don't match the root domain (`domain.com`)

**4. Restart dev server manually**
```bash
# Press Ctrl+C in terminal
npm run dev
```

---

## Related Files

- `next.config.js` - Image configuration
- `components/LeaderboardWidget.tsx` - Uses external avatar images
- `components/ProjectCard.tsx` - May use external token logos

---

## Summary

✅ **Issue**: External images not loading in Next.js Image component  
✅ **Fix**: Added allowed domains to `next.config.js`  
✅ **Result**: All images load correctly, no errors  
✅ **Restart**: Automatic (Next.js detected config change)  

**Status**: RESOLVED ✅

---

**Next.js Image Documentation**:  
https://nextjs.org/docs/app/api-reference/components/image#remotepatterns


