import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { 
  checkVerificationStatus, 
  checkHiddenStatus, 
  calculateKarma 
} from '@/lib/karma'

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  try {
    // Get all pending and backed assets
    const { data: assets } = await supabase
      .from('pending_assets')
      .select('*')
      .in('verification_status', ['pending', 'backed'])
    
    if (!assets) {
      return Response.json({ success: true, processed: 0 })
    }
    
    let processed = 0
    
    for (const asset of assets) {
      // Check if should transition to backed
      if (asset.verification_status === 'pending') {
        const newStatus = checkVerificationStatus(
          asset.total_upvote_weight,
          asset.unique_upvoters_count
        )
        
        if (newStatus === 'backed' || newStatus === 'verified') {
          await transitionToBacked(asset)
          processed++
        }
      }
      
      // Check if should transition to verified
      if (asset.verification_status === 'backed') {
        const newStatus = checkVerificationStatus(
          asset.total_upvote_weight,
          asset.unique_upvoters_count
        )
        
        if (newStatus === 'verified') {
          await transitionToVerified(asset)
          processed++
        }
      }
      
      // Check if should be hidden
      const shouldHide = checkHiddenStatus(
        asset.verification_status as any,
        asset.total_report_weight,
        asset.unique_reporters_count
      )
      
      if (shouldHide) {
        await transitionToHidden(asset)
        processed++
      }
    }
    
    return Response.json({ success: true, processed })
    
  } catch (error) {
    console.error('Error checking verifications:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function transitionToBacked(asset: any) {
  // 1. Update status
  await supabase
    .from('pending_assets')
    .update({ verification_status: 'backed' })
    .eq('id', asset.id)
  
  // 2. Post chat message
  const assetSummary = extractAssetSummary(asset)
  
  await supabase
    .from('curation_chat_messages')
    .insert({
      project_id: asset.project_id,
      message_type: 'asset_backed',
      asset_summary: assetSummary,
      supply_percentage: asset.total_upvote_weight,
      vote_count: asset.unique_upvoters_count
    })
  
  console.log(`Asset ${asset.id} transitioned to BACKED`)
}

async function transitionToVerified(asset: any) {
  // 1. Update status
  await supabase
    .from('pending_assets')
    .update({
      verification_status: 'verified',
      verified_at: new Date().toISOString()
    })
    .eq('id', asset.id)
  
  // 2. Get all upvoters
  const { data: votes } = await supabase
    .from('asset_votes')
    .select('*')
    .eq('pending_asset_id', asset.id)
    .eq('vote_type', 'upvote')
  
  // 3. Award remaining karma (75%) to all upvoters
  if (votes) {
    for (const vote of votes) {
      const remainingKarma = calculateKarma(
        'upvote',
        vote.token_percentage_snapshot,
        false // Remaining 75%
      )
      
      await supabase.rpc('add_karma', {
        p_wallet: vote.voter_wallet,
        p_project_id: asset.project_id,
        p_karma_delta: remainingKarma
      })
      
      // Update vote record
      await supabase
        .from('asset_votes')
        .update({ karma_earned: remainingKarma })
        .eq('id', vote.id)
    }
  }
  
  // 4. Award submitter remaining karma
  const submitterKarma = calculateKarma(
    'add',
    asset.submission_token_percentage,
    false // Remaining 75%
  )
  
  await supabase.rpc('add_karma', {
    p_wallet: asset.submitter_wallet,
    p_project_id: asset.project_id,
    p_karma_delta: submitterKarma
  })
  
  // Increment assets_added_count
  await supabase.rpc('increment_assets_added', {
    p_wallet: asset.submitter_wallet,
    p_project_id: asset.project_id
  })
  
  // 5. Copy to verified assets table
  const assetData = asset.asset_data
  
  if (asset.asset_type === 'social') {
    await supabase
      .from('social_assets')
      .insert({
        project_id: asset.project_id,
        platform: assetData.platform,
        handle: assetData.handle,
        follower_tier: assetData.followerTier,
        profile_url: assetData.profileUrl,
        verified: true,
        verified_at: new Date().toISOString()
      })
  } else if (asset.asset_type === 'creative') {
    await supabase
      .from('creative_assets')
      .insert({
        project_id: asset.project_id,
        asset_type: 'artwork',
        name: assetData.name,
        description: assetData.description,
        media_url: assetData.mediaUrl
      })
  } else if (asset.asset_type === 'legal') {
    await supabase
      .from('legal_assets')
      .insert({
        project_id: asset.project_id,
        asset_type: assetData.assetType,
        name: assetData.name,
        status: assetData.status,
        jurisdiction: assetData.jurisdiction
      })
  }
  
  // 6. Post chat message
  const assetSummary = extractAssetSummary(asset)
  
  await supabase
    .from('curation_chat_messages')
    .insert({
      project_id: asset.project_id,
      message_type: 'asset_verified',
      asset_summary: assetSummary,
      supply_percentage: asset.total_upvote_weight,
      vote_count: asset.unique_upvoters_count
    })
  
  console.log(`Asset ${asset.id} transitioned to VERIFIED`)
}

async function transitionToHidden(asset: any) {
  // 1. Update status
  await supabase
    .from('pending_assets')
    .update({
      verification_status: 'hidden',
      hidden_at: new Date().toISOString()
    })
    .eq('id', asset.id)
  
  // 2. Get all upvoters to deduct their immediate karma
  const { data: upvotes } = await supabase
    .from('asset_votes')
    .select('*')
    .eq('pending_asset_id', asset.id)
    .eq('vote_type', 'upvote')
  
  if (upvotes) {
    for (const vote of upvotes) {
      const immediateKarma = calculateKarma(
        'upvote',
        vote.token_percentage_snapshot,
        true
      )
      
      await supabase.rpc('add_karma', {
        p_wallet: vote.voter_wallet,
        p_project_id: asset.project_id,
        p_karma_delta: -immediateKarma
      })
    }
  }
  
  // 3. Deduct from submitter + add warning
  const immediateKarma = calculateKarma(
    'add',
    asset.submission_token_percentage,
    true
  )
  
  await supabase.rpc('add_karma', {
    p_wallet: asset.submitter_wallet,
    p_project_id: asset.project_id,
    p_karma_delta: -immediateKarma
  })
  
  // Add warning to submitter
  await supabase.rpc('add_warning', {
    p_wallet: asset.submitter_wallet,
    p_project_id: asset.project_id,
    p_reason: 'Asset was hidden by community'
  })
  
  // 4. Award karma to reporters
  const { data: reports } = await supabase
    .from('asset_votes')
    .select('*')
    .eq('pending_asset_id', asset.id)
    .eq('vote_type', 'report')
  
  if (reports) {
    for (const vote of reports) {
      // Award both immediate (25%) and remaining (75%)
      const totalKarma = calculateKarma(
        'report',
        vote.token_percentage_snapshot,
        true
      ) + calculateKarma(
        'report',
        vote.token_percentage_snapshot,
        false
      )
      
      await supabase.rpc('add_karma', {
        p_wallet: vote.voter_wallet,
        p_project_id: asset.project_id,
        p_karma_delta: totalKarma
      })
    }
  }
  
  // 5. Post chat message
  const assetSummary = extractAssetSummary(asset)
  
  await supabase
    .from('curation_chat_messages')
    .insert({
      project_id: asset.project_id,
      message_type: 'asset_hidden',
      asset_summary: assetSummary
    })
  
  console.log(`Asset ${asset.id} transitioned to HIDDEN`)
}

function extractAssetSummary(asset: any): string {
  const data = asset.asset_data
  
  if (asset.asset_type === 'social') {
    return `${data.platform} @${data.handle}`
  }
  
  if (asset.asset_type === 'creative') {
    return data.name || 'Creative Asset'
  }
  
  if (asset.asset_type === 'legal') {
    return `${data.assetType} - ${data.name}`
  }
  
  return 'Asset'
}

