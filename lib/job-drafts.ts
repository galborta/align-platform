/**
 * Job Drafts Recovery System
 * 
 * Handles saving and recovering job drafts when escrow succeeds but job creation fails.
 * This prevents loss of funds by allowing users to retry job creation with an existing
 * escrow transaction signature.
 */

import { supabase } from './supabase'

export interface JobDraftData {
  project_id: string
  poster_wallet: string
  title: string
  description: string
  kpis: string
  category: string
  payment_amount_tokens: number
  payment_amount_usd: number
  assignment_mode: string
  escrow_amount_tokens: number
  escrow_token_mint: string
  poster_desired_completion?: string | null
  fee_percentage_at_creation: number
  token_symbol?: string
}

export interface JobDraft {
  id: string
  poster_wallet: string
  project_id: string
  draft_data: JobDraftData
  escrow_tx_signature: string | null
  recovery_status: 'pending' | 'draft' | 'needs_recovery' | 'recovered' | 'failed'
  created_at: string
  updated_at: string
}

/**
 * Save a job draft for later recovery
 * 
 * @param posterWallet - Wallet address of the job poster
 * @param projectId - Project ID the job belongs to
 * @param jobData - Complete job data to save
 * @param escrowTxSignature - Optional transaction signature if escrow succeeded
 * @returns The created draft or null on error
 */
export async function saveDraft(
  posterWallet: string,
  projectId: string,
  jobData: JobDraftData,
  escrowTxSignature?: string
): Promise<JobDraft | null> {
  try {
    console.log('Saving job draft:', {
      posterWallet,
      projectId,
      hasEscrowTx: !!escrowTxSignature,
      status: escrowTxSignature ? 'needs_recovery' : 'draft'
    })

    const { data, error } = await supabase
      .from('job_drafts')
      .insert({
        poster_wallet: posterWallet,
        project_id: projectId,
        draft_data: jobData,
        escrow_tx_signature: escrowTxSignature || null,
        recovery_status: escrowTxSignature ? 'needs_recovery' : 'draft'
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save draft:', error)
      return null
    }

    console.log('Draft saved successfully:', data.id)
    return data as JobDraft

  } catch (error) {
    console.error('Error saving draft:', error)
    return null
  }
}

/**
 * Get all drafts that need recovery for a specific poster
 * These are drafts where escrow succeeded but job creation failed
 * 
 * @param posterWallet - Wallet address of the job poster
 * @returns Array of drafts needing recovery
 */
export async function getDraftsForRecovery(
  posterWallet: string
): Promise<JobDraft[]> {
  try {
    console.log('Fetching drafts for recovery:', posterWallet)

    const { data, error } = await supabase
      .from('job_drafts')
      .select('*')
      .eq('poster_wallet', posterWallet)
      .eq('recovery_status', 'needs_recovery')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to get drafts for recovery:', error)
      return []
    }

    console.log(`Found ${data?.length || 0} drafts needing recovery`)
    return (data as JobDraft[]) || []

  } catch (error) {
    console.error('Error getting drafts for recovery:', error)
    return []
  }
}

/**
 * Get all drafts (including regular drafts and recovery drafts)
 * 
 * @param posterWallet - Wallet address of the job poster
 * @returns Array of all drafts
 */
export async function getAllDrafts(
  posterWallet: string
): Promise<JobDraft[]> {
  try {
    const { data, error } = await supabase
      .from('job_drafts')
      .select('*')
      .eq('poster_wallet', posterWallet)
      .neq('recovery_status', 'recovered')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to get all drafts:', error)
      return []
    }

    return (data as JobDraft[]) || []

  } catch (error) {
    console.error('Error getting all drafts:', error)
    return []
  }
}

/**
 * Mark a draft as successfully recovered
 * 
 * @param draftId - ID of the draft to mark as recovered
 * @param jobId - ID of the successfully created job
 */
export async function completeDraftRecovery(
  draftId: string,
  jobId: string
): Promise<void> {
  try {
    console.log('Completing draft recovery:', { draftId, jobId })

    const { error } = await supabase
      .from('job_drafts')
      .update({
        recovery_status: 'recovered',
        updated_at: new Date().toISOString()
      })
      .eq('id', draftId)

    if (error) {
      console.error('Failed to complete draft recovery:', error)
      return
    }

    console.log('Draft recovery completed successfully')

  } catch (error) {
    console.error('Error completing draft recovery:', error)
  }
}

/**
 * Mark a draft recovery as failed
 * 
 * @param draftId - ID of the draft to mark as failed
 */
export async function markDraftRecoveryFailed(
  draftId: string
): Promise<void> {
  try {
    console.log('Marking draft recovery as failed:', draftId)

    const { error } = await supabase
      .from('job_drafts')
      .update({
        recovery_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', draftId)

    if (error) {
      console.error('Failed to mark draft as failed:', error)
      return
    }

    console.log('Draft marked as failed')

  } catch (error) {
    console.error('Error marking draft as failed:', error)
  }
}

/**
 * Delete a draft
 * 
 * @param draftId - ID of the draft to delete
 */
export async function deleteDraft(draftId: string): Promise<boolean> {
  try {
    console.log('Deleting draft:', draftId)

    const { error } = await supabase
      .from('job_drafts')
      .delete()
      .eq('id', draftId)

    if (error) {
      console.error('Failed to delete draft:', error)
      return false
    }

    console.log('Draft deleted successfully')
    return true

  } catch (error) {
    console.error('Error deleting draft:', error)
    return false
  }
}

/**
 * Retry job creation from a draft
 * Uses the existing escrow transaction signature
 * 
 * @param draft - The draft to recover
 * @returns The created job or null on error
 */
export async function retryJobCreationFromDraft(
  draft: JobDraft
): Promise<any | null> {
  try {
    console.log('Retrying job creation from draft:', draft.id)

    if (!draft.escrow_tx_signature) {
      console.error('Draft missing escrow transaction signature')
      return null
    }

    const jobData = draft.draft_data

    // Use the API endpoint to create the job
    const response = await fetch('/api/jobs/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...jobData,
        escrow_tx_signature: draft.escrow_tx_signature,
        escrow_locked: true
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Job creation failed:', error)
      await markDraftRecoveryFailed(draft.id)
      return null
    }

    const { job } = await response.json()
    console.log('Job created successfully from draft:', job.id)

    // Mark draft as recovered
    await completeDraftRecovery(draft.id, job.id)

    return job

  } catch (error) {
    console.error('Error retrying job creation:', error)
    await markDraftRecoveryFailed(draft.id)
    return null
  }
}




