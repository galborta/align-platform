#!/bin/bash
# Local testing script for auto-release-payments Edge Function

set -e  # Exit on error

echo "🧪 Testing auto-release-payments Edge Function locally..."
echo ""

# Check if function is running
if ! curl -s http://localhost:54321/functions/v1/auto-release-payments > /dev/null 2>&1; then
    echo "⚠️  Function not running. Starting..."
    echo ""
    npx supabase functions serve auto-release-payments &
    FUNC_PID=$!
    sleep 5
else
    echo "✅ Function is already running"
    FUNC_PID=""
fi

# Get CRON_SECRET from .env.local or use default
CRON_SECRET=${CRON_SECRET:-"test-secret"}

echo "🔐 Using CRON_SECRET: ${CRON_SECRET:0:10}..."
echo ""

# Test the function
echo "📡 Sending test request..."
echo ""

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST http://localhost:54321/functions/v1/auto-release-payments \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

# Extract body and status code
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_CODE\:.*//g')
STATUS_CODE=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_CODE://')

echo "📋 Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Check status code
if [ "$STATUS_CODE" -eq 200 ]; then
    echo "✅ Test passed! Status code: $STATUS_CODE"
else
    echo "❌ Test failed! Status code: $STATUS_CODE"
fi

# Cleanup
if [ ! -z "$FUNC_PID" ]; then
    echo ""
    echo "🧹 Cleaning up (killing function process)..."
    kill $FUNC_PID 2>/dev/null || true
fi

echo ""
echo "✨ Testing complete"




