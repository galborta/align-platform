/**
 * Manual test cases for asset rejection endpoint
 * Run these with curl or Postman to verify functionality
 */

/*
TEST 1: Reject asset as project creator with reason
curl -X POST http://localhost:3000/api/assets/reject \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "PENDING_ASSET_UUID",
    "projectId": "PROJECT_UUID",
    "editorWallet": "CREATOR_WALLET_ADDRESS",
    "reason": "Account does not appear to be affiliated with the project"
  }'

Expected: 200 OK, asset status updated to 'rejected'

TEST 2: Reject asset as editor without reason
curl -X POST http://localhost:3000/api/assets/reject \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "PENDING_ASSET_UUID",
    "projectId": "PROJECT_UUID",
    "editorWallet": "EDITOR_WALLET_ADDRESS"
  }'

Expected: 200 OK, asset rejected with no reason

TEST 3: Reject asset without permission
curl -X POST http://localhost:3000/api/assets/reject \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "PENDING_ASSET_UUID",
    "projectId": "PROJECT_UUID",
    "editorWallet": "RANDOM_WALLET_ADDRESS",
    "reason": "Test rejection"
  }'

Expected: 403 Forbidden

TEST 4: Reject already rejected asset
curl -X POST http://localhost:3000/api/assets/reject \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "ALREADY_REJECTED_ASSET_UUID",
    "projectId": "PROJECT_UUID",
    "editorWallet": "CREATOR_WALLET_ADDRESS",
    "reason": "Already rejected"
  }'

Expected: 400 Bad Request, "Asset is already rejected"

TEST 5: Reject verified asset (should fail)
curl -X POST http://localhost:3000/api/assets/reject \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "VERIFIED_ASSET_UUID",
    "projectId": "PROJECT_UUID",
    "editorWallet": "CREATOR_WALLET_ADDRESS",
    "reason": "Mistake"
  }'

Expected: 400 Bad Request, "Asset is already verified"

VERIFY IN DATABASE:
1. Check pending_assets.verification_status = 'rejected'
   SELECT verification_status, rejected_by, rejected_at, rejection_reason 
   FROM pending_assets 
   WHERE id = 'PENDING_ASSET_UUID';

2. Check rejected_by matches editor wallet
   Should match the wallet that made the rejection request

3. Check rejection_reason is stored correctly
   Should match the reason provided (or NULL if no reason)

4. Check notifications table for submitter notification
   SELECT * FROM notifications 
   WHERE user_wallet = 'SUBMITTER_WALLET' 
   AND type = 'social_asset_rejected'
   ORDER BY created_at DESC LIMIT 1;

5. Verify notification includes rejection reason in metadata
   SELECT metadata FROM notifications 
   WHERE user_wallet = 'SUBMITTER_WALLET' 
   AND type = 'social_asset_rejected'
   ORDER BY created_at DESC LIMIT 1;

6. Check admin_logs for rejection action
   SELECT * FROM admin_logs 
   WHERE action = 'asset_rejected' 
   AND entity_id = 'PENDING_ASSET_UUID'
   ORDER BY created_at DESC LIMIT 1;

7. Verify submitter KEEPS their initial karma (25%)
   - Karma should NOT be deducted
   - Check wallet_karma.total_karma_points unchanged from before rejection
*/

export {}

