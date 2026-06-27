# Image Hostnames Configuration

**File**: `next.config.js`  
**Purpose**: Configure allowed external image sources for Next.js Image component  
**Date**: December 14, 2024

---

## ✅ Configured Hostnames

### Supabase Storage
```javascript
'*.supabase.co'      // Supabase storage (public files)
'*.supabase.in'      // Supabase storage (alternative region)
```
**Used for:** User avatars, project logos, uploaded assets

---

### Avatar Services
```javascript
'api.dicebear.com'        // DiceBear avatar API
'avatars.dicebear.com'    // DiceBear avatars
```
**Used for:** Generated user avatars (fallback when no custom avatar)

---

### Arweave (Decentralized Storage)
```javascript
'arweave.net'        // Arweave gateway
'*.arweave.net'      // Arweave subdomains
```
**Used for:** Token metadata, NFT storage, permanent storage

---

### IPFS Gateways
```javascript
'ipfs.io'                    // Public IPFS gateway
'*.ipfs.io'                  // IPFS subdomain gateways
'*.ipfs.nftstorage.link'     // NFT Storage IPFS gateway (CID subdomains)
'*.ipfs.dweb.link'           // Dweb IPFS gateway (CID subdomains)
'nftstorage.link'            // NFT Storage direct
'dweb.link'                  // Dweb direct
```
**Used for:** Token logos, NFT metadata, decentralized content

**Example URLs:**
- `https://ipfs.io/ipfs/QmXyz...`
- `https://bafkreidx64y72zvdmaysswocovwowtjlxjnh26qh62edql5gmp5rpo5gpm.ipfs.nftstorage.link`
- `https://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi.ipfs.dweb.link`

---

### GitHub Raw Content
```javascript
'raw.githubusercontent.com'
```
**Used for:** Token logos from Solana Token List (GitHub repo)

**Example URL:**
- `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/TOKEN/logo.png`

---

## 🔧 Configuration Format

```javascript
{
  protocol: 'https',
  hostname: '*.example.com',  // Wildcard for subdomains
  pathname: '/path/**',        // Optional: restrict to specific paths
}
```

### Wildcard Patterns
- `'*.example.com'` - Matches any subdomain: `foo.example.com`, `bar.example.com`
- `'example.com'` - Matches exact hostname only
- `'**'` in pathname - Matches any nested path

---

## 🚨 Security Notes

### Why We Restrict Hostnames

Next.js Image component requires explicit hostname configuration to:
1. **Prevent abuse** - Stop loading images from arbitrary URLs
2. **Security** - Prevent loading malicious images
3. **Performance** - Only optimize images from trusted sources
4. **Cost control** - Limit image optimization bandwidth

### Safe Practices

✅ **DO:**
- Add specific hostnames for known services
- Use wildcards for subdomains of trusted services
- Document why each hostname is needed

❌ **DON'T:**
- Allow all hostnames (`*`)
- Add untrusted domains
- Use unencrypted HTTP (only HTTPS)

---

## 🛠️ How to Add New Hostname

If you get an error like:
```
Invalid src prop (...) on `next/image`, 
hostname "new-service.com" is not configured
```

**Steps:**

1. **Identify the service:**
   ```
   Error shows: https://new-service.com/image.png
   Hostname is: new-service.com
   ```

2. **Add to `next.config.js`:**
   ```javascript
   {
     protocol: 'https',
     hostname: 'new-service.com',
   }
   ```

3. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

4. **Test:**
   - Refresh page
   - Image should load

---

## 📋 Common Token Logo Sources

Solana tokens commonly use these sources for logos:

1. **GitHub (Solana Token List)**
   - `raw.githubusercontent.com`
   - Official token list maintained by Solana

2. **Arweave**
   - `arweave.net`
   - Permanent decentralized storage
   - Popular for official project assets

3. **IPFS**
   - `ipfs.io`, `nftstorage.link`, `dweb.link`
   - Decentralized content addressing
   - Used by many NFT projects

4. **Direct HTTPS**
   - Project websites
   - Must be added individually

---

## 🧪 Testing

### Test if hostname is configured:

```javascript
// This should work if hostname is configured
<Image 
  src="https://configured-hostname.com/image.png"
  alt="Test"
  width={100}
  height={100}
/>

// This will fail if hostname is NOT configured
<Image 
  src="https://unconfigured-hostname.com/image.png"
  alt="Test"
  width={100}
  height={100}
/>
```

### Check configuration:

```bash
# View current config
cat next.config.js | grep hostname

# Should output all configured hostnames
```

---

## 📊 Current Configuration Summary

| Service Type | Hostnames | Purpose |
|--------------|-----------|---------|
| **Storage** | Supabase | User uploads, project assets |
| **Avatars** | DiceBear | Generated user avatars |
| **Decentralized** | Arweave, IPFS | Token logos, NFT metadata |
| **GitHub** | Raw GitHub | Solana Token List logos |

**Total Hostnames Configured:** 10 patterns  
**Protocols Allowed:** HTTPS only  
**Wildcard Patterns:** 6 (for subdomains)

---

## 🔄 Maintenance

### When to Update

Update configuration when:
1. Adding new image/storage services
2. Token metadata uses new IPFS gateway
3. Integrating new avatar service
4. Adding CDN or image hosting

### Version History

- **Dec 14, 2024**: Added IPFS NFT Storage and Dweb gateways
- **Dec 14, 2024**: Added GitHub raw content
- **Initial**: Supabase, DiceBear, Arweave, IPFS.io

---

## 📚 Resources

- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [Next.js Image Configuration](https://nextjs.org/docs/api-reference/next/image#remote-patterns)
- [IPFS Gateways](https://docs.ipfs.tech/concepts/ipfs-gateway/)
- [Arweave Documentation](https://docs.arweave.org/)

---

**Last Updated:** December 14, 2024  
**Config File:** `next.config.js`  
**Restart Required:** Yes (after changes)




