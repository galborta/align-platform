import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      contractAddress,
      email,
      tokenId,
      tokenName,
      tokenSymbol,
      description,
      profileImageUrl,
      website,
      telegram,
      creatorWallet,
      socialAssets = [],
      creativeAssets = [],
      legalAssets = [],
      teamWallets = [],
    } = body

    // Validate required fields
    if (!contractAddress || !tokenId || !tokenName || !tokenSymbol || !description) {
      return NextResponse.json(
        { error: 'Missing required fields (contract, token info, and description required)' },
        { status: 400 }
      )
    }

    const supabase = supabaseAdmin

    // Verify token is valid and not already used
    const { data: tokenData, error: tokenError } = await supabase
      .from('project_creation_tokens')
      .select('*')
      .eq('id', tokenId)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      )
    }

    if (tokenData.status === 'completed') {
      return NextResponse.json(
        { error: 'Token has already been used' },
        { status: 400 }
      )
    }

    // Check if project already exists with this contract address
    const { data: existingProject, error: existingError } = await supabase
      .from('projects')
      .select('id')
      .eq('token_mint', contractAddress)
      .single()

    if (existingProject) {
      return NextResponse.json(
        { error: 'A project with this contract address already exists' },
        { status: 400 }
      )
    }

    // Create the project
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert({
        token_mint: contractAddress,
        token_name: tokenName,
        token_symbol: tokenSymbol,
        description: description,
        profile_image_url: profileImageUrl || null,
        creator_wallet: creatorWallet || tokenData.created_by,
        status: 'live', // Set to live immediately so it appears on homepage
      })
      .select()
      .single()

    if (projectError) {
      console.error('Error creating project:', projectError)
      return NextResponse.json(
        { error: 'Failed to create project', details: projectError.message },
        { status: 500 }
      )
    }

    // Create basic social_assets record with website and telegram from Step 1
    // These show immediately on profile (website near description, telegram in social section)
    const { error: socialError } = await supabase
      .from('social_assets')
      .insert({
        project_id: newProject.id,
        website: website || null,
        telegram: telegram || null,
        verified: false, // Not strictly "verified" but shows immediately
      })

    if (socialError) {
      console.error('Error creating social assets:', socialError)
      console.warn('Project created but social assets not added')
    } else {
      console.log(`✅ Social assets created for project: ${tokenSymbol}`)
    }

    // Insert additional social assets from Step 2 (Instagram, Twitter, TikTok, YouTube with verification)
    if (socialAssets && socialAssets.length > 0) {
      const socialAssetsToInsert = socialAssets.map((asset: any) => ({
        project_id: newProject.id,
        platform: asset.platform,
        handle: asset.handle,
        follower_tier: asset.followerTier,
        profile_url: asset.profileUrl,
        verification_code: asset.verificationCode,
        status: 'pending',
        verified: false,
      }))

      const { error: socialAssetsError } = await supabase
        .from('social_assets')
        .insert(socialAssetsToInsert)

      if (socialAssetsError) {
        console.error('Error inserting social assets:', socialAssetsError)
      } else {
        console.log(`✅ Added ${socialAssets.length} social assets`)
      }
    }

    // Insert creative assets
    if (creativeAssets && creativeAssets.length > 0) {
      const creativeAssetsToInsert = creativeAssets.map((asset: any) => ({
        project_id: newProject.id,
        file_name: asset.fileName,
        file_url: asset.fileUrl,
        file_type: asset.fileName.split('.').pop() || 'unknown',
      }))

      const { error: creativeError } = await supabase
        .from('creative_assets')
        .insert(creativeAssetsToInsert)

      if (creativeError) {
        console.error('Error inserting creative assets:', creativeError)
      } else {
        console.log(`✅ Added ${creativeAssets.length} creative assets`)
      }
    }

    // Insert legal assets
    if (legalAssets && legalAssets.length > 0) {
      const legalAssetsToInsert = legalAssets.map((asset: any) => ({
        project_id: newProject.id,
        asset_type: asset.assetType.toLowerCase(),
        name: asset.name,
        status: asset.status.toLowerCase(),
        jurisdiction: asset.jurisdiction || null,
      }))

      const { error: legalError } = await supabase
        .from('legal_assets')
        .insert(legalAssetsToInsert)

      if (legalError) {
        console.error('Error inserting legal assets:', legalError)
      } else {
        console.log(`✅ Added ${legalAssets.length} legal assets`)
      }
    }

    // Insert team wallets
    if (teamWallets && teamWallets.length > 0) {
      const teamWalletsToInsert = teamWallets.map((wallet: any) => ({
        project_id: newProject.id,
        wallet_address: wallet.address,
        label: wallet.label,
      }))

      const { error: walletError } = await supabase
        .from('team_wallets')
        .insert(teamWalletsToInsert)

      if (walletError) {
        console.error('Error inserting team wallets:', walletError)
      } else {
        console.log(`✅ Added ${teamWallets.length} team wallets`)
      }
    }

    // Mark token as completed
    const { error: tokenUpdateError } = await supabase
      .from('project_creation_tokens')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', tokenId)

    if (tokenUpdateError) {
      console.error('Warning: Failed to mark token as completed:', tokenUpdateError)
    }

    // Mark draft as completed
    const { error: draftError } = await supabase
      .from('project_drafts')
      .update({ completed: true })
      .eq('token_id', tokenId)

    if (draftError) {
      console.error('Warning: Failed to mark draft as completed:', draftError)
    }

    // ============================================
    // ADMIN NOTIFICATION SYSTEM
    // ============================================

    try {
      // Get admin wallet address from environment
      const adminWallet = process.env.ADMIN_WALLET_ADDRESS

      if (!adminWallet) {
        console.error('Warning: ADMIN_WALLET_ADDRESS not configured')
      } else {
        // Create notification for admin
        const projectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://orggly.com'}/project/${newProject.id}`
        await supabase
          .from('notifications')
          .insert({
            wallet_address: adminWallet,
            type: 'project_completed',
            title: 'Project Setup Completed',
            message: `${tokenSymbol} - ${tokenName} has completed their project profile. View: ${projectUrl}`,
            is_read: false,
            priority: 'normal',
          })

        console.log(`✅ Admin notification sent for project: ${tokenSymbol}`)
      }

      // Add message to submission conversation
      if (tokenData.submission_id) {
        const { data: submission } = await supabase
          .from('project_submissions')
          .select('conversation_id')
          .eq('id', tokenData.submission_id)
          .single()

        if (submission?.conversation_id) {
          await supabase
            .from('messages')
            .insert({
              conversation_id: submission.conversation_id,
              sender_wallet: 'system',
              content: `✅ **Project Setup Completed!**\n\n${tokenSymbol} - ${tokenName} is now live on Orggly.\n\nView project: ${process.env.NEXT_PUBLIC_APP_URL || 'https://orggly.com'}/project/${newProject.id}`,
            })

          console.log(`✅ Conversation updated for submission: ${tokenData.submission_id}`)
        }
      }
    } catch (notificationError) {
      console.error('Failed to send completion notification:', notificationError)
      // Don't fail project creation if notification fails
    }

    // Return success with project details
    return NextResponse.json({
      success: true,
      projectId: newProject.id,
      project: newProject,
      message: 'Project created successfully',
    })
  } catch (error) {
    console.error('Project creation error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
