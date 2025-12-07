import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getOrCreateConversation, canMessageUser } from '@/lib/messaging'
import { notificationService } from '@/lib/services/notificationService'

/**
 * POST /api/tips/record
 * 
 * Records a tip in the database after successful blockchain transaction
 * 
 * Request body:
 * - projectId: string (required)
 * - fromWallet: string (required)
 * - toWallet: string (required)
 * - tokenMint: string (required)
 * - tokenSymbol: string (required)
 * - amountTokens: number (required)
 * - amountUsd: number | null
 * - message: string | null
 * - isPublic: boolean (required)
 * - txSignature: string (required)
 * - senderTierMultiplier: number (required)
 * - recipientTierMultiplier: number (required)
 * 
 * Returns:
 * - success: boolean
 * - tipId: string
 * - karmaSender: number (actual karma awarded after daily cap)
 * - karmaRecipient: number (actual karma awarded after daily cap)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      fromWallet,
      toWallet,
      tokenMint,
      tokenSymbol,
      amountTokens,
      amountUsd,
      message,
      isPublic,
      txSignature,
      senderTierMultiplier,
      recipientTierMultiplier
    } = body

    // Validation - projectId is now optional for direct conversation tips
    if (!fromWallet || !toWallet || !tokenMint || !tokenSymbol || !txSignature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (fromWallet === toWallet) {
      return NextResponse.json(
        { error: 'Cannot tip yourself' },
        { status: 400 }
      )
    }

    if (amountTokens <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Calculate karma amounts (using USD value * tier multiplier)
    const baseKarma = amountUsd || 0
    const senderKarmaCalculated = baseKarma * senderTierMultiplier
    const recipientKarmaCalculated = baseKarma * recipientTierMultiplier

    // Award karma - only if projectId is provided
    let actualSenderKarma = 0
    let actualRecipientKarma = 0

    if (projectId) {
      // Award karma to sender (with daily cap via database function)
      const { data: senderKarmaData, error: senderKarmaError } = await supabase
        .rpc('award_tip_karma', {
          p_wallet_address: fromWallet,
          p_project_id: projectId,
          p_karma_amount: senderKarmaCalculated,
          p_is_sender: true
        })

      if (senderKarmaError) {
        console.error('Sender karma error:', senderKarmaError)
      }

      actualSenderKarma = senderKarmaData || 0

      // Award karma to recipient (with daily cap)
      const { data: recipientKarmaData, error: recipientKarmaError } = await supabase
        .rpc('award_tip_karma', {
          p_wallet_address: toWallet,
          p_project_id: projectId,
          p_karma_amount: recipientKarmaCalculated,
          p_is_sender: false
        })

      if (recipientKarmaError) {
        console.error('Recipient karma error:', recipientKarmaError)
      }

      actualRecipientKarma = recipientKarmaData || 0
    } else {
      // Direct conversation tip - no karma awarded
      console.log('💬 Direct conversation tip - no project karma awarded')
    }

    // Create tip record - projectId can be null for direct conversation tips
    const { data: tip, error: tipError } = await supabase
      .from('chat_tips')
      .insert({
        project_id: projectId || null,
        from_wallet: fromWallet,
        to_wallet: toWallet,
        amount_tokens: amountTokens,
        token_mint: tokenMint,
        token_symbol: tokenSymbol,
        amount_usd: amountUsd,
        message: message?.trim() || null,
        is_public: isPublic,
        tx_signature: txSignature,
        karma_awarded_sender: actualSenderKarma,
        karma_awarded_recipient: actualRecipientKarma
      })
      .select()
      .single()

    if (tipError) {
      console.error('Tip insert error:', tipError)
      throw tipError
    }

    // ✨ Create notification for tip recipient (HIGH PRIORITY - triggers browser notification)
    try {
      await notificationService.createNotification({
        userWallet: toWallet,
        type: 'tip_received',
        actorWallet: fromWallet,
        referenceId: tip.id,
        referenceType: 'tip',
        metadata: {
          amount: amountTokens,
          token: tokenSymbol,
          token_mint: tokenMint,
          message_preview: message?.trim()?.slice(0, 100) || undefined
        }
      })
      console.log('🔔 Tip notification created successfully')
    } catch (notificationError) {
      console.error('Failed to create tip notification:', notificationError)
      // Don't fail the tip if notification fails
    }

    // Always send DM for tips (with or without personal message)
    try {
      // Check if sender can message recipient
      const messageCheck = await canMessageUser(fromWallet, toWallet, projectId)
      
      if (messageCheck.canMessage) {
        // Get or create conversation
        const conversation = await getOrCreateConversation(fromWallet, toWallet)
        
        if (conversation) {
          // Format tip message with tip details
          const usdText = amountUsd ? ` ($${amountUsd.toFixed(2)})` : ''
          const personalMessage = message?.trim()
          
          // Build the DM content
          let tipDmContent: string
          if (personalMessage) {
            // Include personal message if provided
            tipDmContent = `🎁 **Tip Received**: ${amountTokens} ${tokenSymbol}${usdText}\n\n${personalMessage}`
          } else {
            // Default message when no personal message
            tipDmContent = `🎁 **Tip Received**: ${amountTokens} ${tokenSymbol}${usdText}\n\nYou received a tip! 💜`
          }
          
          // Insert message into messages table
          const { error: messageError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversation.id,
              sender_wallet: fromWallet,
              content: tipDmContent,
              is_read: false
            })
          
          if (messageError) {
            console.error('Error sending tip DM:', messageError)
          } else {
            // Update conversation's last_message_at
            await supabase
              .from('conversations')
              .update({
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', conversation.id)
            
            console.log('📩 Tip DM sent successfully')
          }
        }
      } else {
        console.log('📩 Cannot send DM:', messageCheck.reason)
      }
    } catch (dmError) {
      console.error('Error sending tip DM:', dmError)
      // Don't fail the tip if DM fails
    }

    // Create feed event only if in project context and public
    if (isPublic && projectId) {
      console.log('📣 TODO: Create public feed event for tip')
      // await createFeedEvent(projectId, tip.id, 'tip')
    }

    console.log('📝 Tip recorded:', {
      tipId: tip.id,
      projectId: projectId || 'direct-conversation',
      senderKarma: actualSenderKarma,
      recipientKarma: actualRecipientKarma,
      isPublic
    })

    return NextResponse.json({
      success: true,
      tipId: tip.id,
      karmaSender: actualSenderKarma,
      karmaRecipient: actualRecipientKarma
    })

  } catch (error: any) {
    console.error('Error recording tip:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to record tip'
      },
      { status: 500 }
    )
  }
}

