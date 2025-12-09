#!/bin/bash
# Deployment script for auto-release-payments Edge Function

set -e  # Exit on error

echo "🚀 Deploying auto-release-payments Edge Function..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if logged in
echo "📝 Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   npx supabase login"
    exit 1
fi

echo "✅ Authenticated"
echo ""

# Deploy function
echo "📦 Deploying function..."
npx supabase functions deploy auto-release-payments

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Set environment variables in Supabase Dashboard"
echo "   2. Schedule the cron job (see AUTO_RELEASE_EDGE_FUNCTION_COMPLETE.md)"
echo "   3. Test the function"
echo ""
echo "🔗 Function URL:"
echo "   https://your-project-ref.supabase.co/functions/v1/auto-release-payments"
echo ""








