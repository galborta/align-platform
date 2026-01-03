#!/bin/bash
# =============================================================================
# AUTO-RELEASE PAYMENTS - AUTOMATED CRON SETUP
# =============================================================================
# This script:
# 1. Generates a secure CRON_SECRET
# 2. Updates the SQL file with the secret
# 3. Provides copy-paste commands for Supabase Dashboard
# =============================================================================

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  AUTO-RELEASE PAYMENTS - CRON SETUP WIZARD                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# STEP 1: Generate CRON_SECRET
# =============================================================================

echo "📝 Step 1: Generating secure CRON_SECRET..."
echo ""

if command -v openssl &> /dev/null; then
    CRON_SECRET=$(openssl rand -base64 32)
    echo "✅ CRON_SECRET generated successfully!"
else
    echo "⚠️  OpenSSL not found. Please install it or generate a secret manually:"
    echo "   On macOS: brew install openssl"
    echo "   On Linux: apt-get install openssl"
    echo ""
    echo "Or use: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    exit 1
fi

echo ""
echo "🔐 Your CRON_SECRET:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$CRON_SECRET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT: Save this secret securely!"
echo ""

# =============================================================================
# STEP 2: Update SQL File
# =============================================================================

echo "📄 Step 2: Updating SQL file with CRON_SECRET..."
echo ""

SQL_FILE="setup-cron-production.sql"

if [ -f "$SQL_FILE" ]; then
    # Create backup
    cp "$SQL_FILE" "${SQL_FILE}.backup"
    
    # Replace YOUR_CRON_SECRET with actual secret
    sed -i.tmp "s/YOUR_CRON_SECRET/${CRON_SECRET}/g" "$SQL_FILE"
    rm "${SQL_FILE}.tmp"
    
    echo "✅ SQL file updated successfully!"
    echo "   Backup saved as: ${SQL_FILE}.backup"
else
    echo "❌ SQL file not found: $SQL_FILE"
    echo "   Make sure you're in the auto-release-payments directory"
    exit 1
fi

echo ""

# =============================================================================
# STEP 3: Provide Instructions
# =============================================================================

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  NEXT STEPS                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "1️⃣  SET ENVIRONMENT VARIABLES IN SUPABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Go to: Supabase Dashboard → Edge Functions → auto-release-payments → Settings"
echo ""
echo "Add these variables (copy-paste):"
echo ""
echo "CRON_SECRET"
echo "$CRON_SECRET"
echo ""
echo "APP_URL"
echo "https://your-domain.com"
echo ""
echo "SERVICE_AUTH_TOKEN"
echo "auto-release-internal"
echo ""
echo "ADMIN_WALLET"
echo "GxPUe7pziu2RxLmTniojH7XPVp8xy3hg9bwfb9knVx4S"
echo ""

echo "2️⃣  ADD SERVICE_AUTH_TOKEN TO VERCEL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Go to: Vercel Dashboard → Settings → Environment Variables"
echo ""
echo "Add:"
echo "  Name: SERVICE_AUTH_TOKEN"
echo "  Value: auto-release-internal"
echo ""
echo "Then redeploy your app."
echo ""

echo "3️⃣  RUN THE SQL SCRIPT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Go to: Supabase Dashboard → SQL Editor"
echo ""
echo "Copy and paste the entire contents of:"
echo "  $SQL_FILE"
echo ""
echo "Click RUN."
echo ""

echo "4️⃣  TEST THE SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Run this command to test:"
echo ""
echo "curl -X POST https://szunhbkqmfbbcrefycxh.supabase.co/functions/v1/auto-release-payments \\"
echo "  -H \"Authorization: Bearer $CRON_SECRET\" \\"
echo "  -H \"Content-Type: application/json\""
echo ""

echo "5️⃣  VERIFY CRON IS SCHEDULED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "In Supabase SQL Editor, run:"
echo ""
echo "SELECT * FROM cron.job WHERE jobname = 'auto-release-payments';"
echo ""
echo "You should see one row with schedule '0 * * * *'"
echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✅ SETUP WIZARD COMPLETE                                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Your CRON_SECRET has been saved in: $SQL_FILE"
echo ""
echo "Follow the steps above to complete the setup."
echo ""
echo "📚 For detailed instructions, see: CRON_SETUP_INSTRUCTIONS.md"
echo ""












