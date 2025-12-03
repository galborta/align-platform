export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          creator_wallet: string
          token_mint: string
          token_name: string
          token_symbol: string
          description: string | null
          profile_image_url: string | null
          status: 'draft' | 'pending' | 'live' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_wallet: string
          token_mint: string
          token_name: string
          token_symbol: string
          description?: string | null
          profile_image_url?: string | null
          status?: 'draft' | 'pending' | 'live' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_wallet?: string
          token_mint?: string
          token_name?: string
          token_symbol?: string
          description?: string | null
          profile_image_url?: string | null
          status?: 'draft' | 'pending' | 'live' | 'rejected'
          created_at?: string
          updated_at?: string
        }
      }
      social_assets: {
        Row: {
          id: string
          project_id: string | null
          platform: 'instagram' | 'twitter' | 'tiktok' | 'youtube'
          handle: string
          follower_tier: '<10k' | '10k-50k' | '50k-100k' | '100k-500k' | '500k-1m' | '1m-5m' | '5m+' | null
          profile_url: string | null
          verification_code: string | null
          verified: boolean
          verified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          platform: 'instagram' | 'twitter' | 'tiktok' | 'youtube'
          handle: string
          follower_tier?: '<10k' | '10k-50k' | '50k-100k' | '100k-500k' | '500k-1m' | '1m-5m' | '5m+' | null
          profile_url?: string | null
          verification_code?: string | null
          verified?: boolean
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          platform?: 'instagram' | 'twitter' | 'tiktok' | 'youtube'
          handle?: string
          follower_tier?: '<10k' | '10k-50k' | '50k-100k' | '100k-500k' | '500k-1m' | '1m-5m' | '5m+' | null
          profile_url?: string | null
          verification_code?: string | null
          verified?: boolean
          verified_at?: string | null
          created_at?: string
        }
      }
      creative_assets: {
        Row: {
          id: string
          project_id: string | null
          asset_type: 'logo' | 'character' | 'artwork' | null
          name: string | null
          description: string | null
          media_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          asset_type?: 'logo' | 'character' | 'artwork' | null
          name?: string | null
          description?: string | null
          media_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          asset_type?: 'logo' | 'character' | 'artwork' | null
          name?: string | null
          description?: string | null
          media_url?: string | null
          created_at?: string
        }
      }
      legal_assets: {
        Row: {
          id: string
          project_id: string | null
          asset_type: 'domain' | 'trademark' | 'copyright' | null
          name: string | null
          status: string | null
          jurisdiction: string | null
          registration_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          asset_type?: 'domain' | 'trademark' | 'copyright' | null
          name?: string | null
          status?: string | null
          jurisdiction?: string | null
          registration_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          asset_type?: 'domain' | 'trademark' | 'copyright' | null
          name?: string | null
          status?: string | null
          jurisdiction?: string | null
          registration_id?: string | null
          created_at?: string
        }
      }
      team_wallets: {
        Row: {
          id: string
          project_id: string | null
          wallet_address: string
          label: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          wallet_address: string
          label?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          wallet_address?: string
          label?: string | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          project_id: string
          wallet_address: string
          message_text: string
          token_balance: string
          token_percentage: number
          holding_tier: 'mega' | 'whale' | 'holder' | 'small'
          reply_to_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          wallet_address: string
          message_text: string
          token_balance: string
          token_percentage: number
          holding_tier: 'mega' | 'whale' | 'holder' | 'small'
          reply_to_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          wallet_address?: string
          message_text?: string
          token_balance?: string
          token_percentage?: number
          holding_tier?: 'mega' | 'whale' | 'holder' | 'small'
          reply_to_id?: string | null
          created_at?: string
        }
      }
      pending_assets: {
        Row: {
          id: string
          project_id: string
          asset_type: 'social' | 'creative' | 'legal'
          asset_data: Record<string, any>
          submitter_wallet: string
          submission_token_balance: number
          submission_token_percentage: number
          total_upvote_weight: number
          unique_upvoters_count: number
          total_report_weight: number
          unique_reporters_count: number
          verification_status: 'pending' | 'backed' | 'verified' | 'hidden'
          verified_at: string | null
          hidden_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          asset_type: 'social' | 'creative' | 'legal'
          asset_data: Record<string, any>
          submitter_wallet: string
          submission_token_balance: number
          submission_token_percentage: number
          total_upvote_weight?: number
          unique_upvoters_count?: number
          total_report_weight?: number
          unique_reporters_count?: number
          verification_status?: 'pending' | 'backed' | 'verified' | 'hidden'
          verified_at?: string | null
          hidden_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          asset_type?: 'social' | 'creative' | 'legal'
          asset_data?: Record<string, any>
          submitter_wallet?: string
          submission_token_balance?: number
          submission_token_percentage?: number
          total_upvote_weight?: number
          unique_upvoters_count?: number
          total_report_weight?: number
          unique_reporters_count?: number
          verification_status?: 'pending' | 'backed' | 'verified' | 'hidden'
          verified_at?: string | null
          hidden_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      asset_votes: {
        Row: {
          id: string
          pending_asset_id: string
          voter_wallet: string
          vote_type: 'upvote' | 'report'
          token_balance_snapshot: number
          token_percentage_snapshot: number
          karma_earned: number
          created_at: string
        }
        Insert: {
          id?: string
          pending_asset_id: string
          voter_wallet: string
          vote_type: 'upvote' | 'report'
          token_balance_snapshot: number
          token_percentage_snapshot: number
          karma_earned?: number
          created_at?: string
        }
        Update: {
          id?: string
          pending_asset_id?: string
          voter_wallet?: string
          vote_type?: 'upvote' | 'report'
          token_balance_snapshot?: number
          token_percentage_snapshot?: number
          karma_earned?: number
          created_at?: string
        }
      }
      wallet_karma: {
        Row: {
          id: string
          wallet_address: string
          project_id: string
          total_karma_points: number
          assets_added_count: number
          upvotes_given_count: number
          reports_given_count: number
          warning_count: number
          is_banned: boolean
          banned_at: string | null
          ban_expires_at: string | null
          warnings: Array<{ timestamp: string; reason: string }>
          // Job System Tracking
          applications_submitted_count: number
          jobs_completed_as_worker_count: number
          jobs_posted_as_poster_count: number
          dispute_votes_cast_count: number
          dispute_votes_won_count: number
          // Tip System Tracking
          tips_sent_count: number
          tips_received_count: number
          tip_karma_earned_today: number
          tip_karma_last_reset_date: string
          // Contest Voting Tracking
          contest_votes_cast_count: number
          contest_votes_won_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          wallet_address: string
          project_id: string
          total_karma_points?: number
          assets_added_count?: number
          upvotes_given_count?: number
          reports_given_count?: number
          warning_count?: number
          is_banned?: boolean
          banned_at?: string | null
          ban_expires_at?: string | null
          warnings?: Array<{ timestamp: string; reason: string }>
          // Job System Tracking
          applications_submitted_count?: number
          jobs_completed_as_worker_count?: number
          jobs_posted_as_poster_count?: number
          dispute_votes_cast_count?: number
          dispute_votes_won_count?: number
          // Tip System Tracking
          tips_sent_count?: number
          tips_received_count?: number
          tip_karma_earned_today?: number
          tip_karma_last_reset_date?: string
          // Contest Voting Tracking
          contest_votes_cast_count?: number
          contest_votes_won_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          wallet_address?: string
          project_id?: string
          total_karma_points?: number
          assets_added_count?: number
          upvotes_given_count?: number
          reports_given_count?: number
          warning_count?: number
          is_banned?: boolean
          banned_at?: string | null
          ban_expires_at?: string | null
          warnings?: Array<{ timestamp: string; reason: string }>
          // Job System Tracking
          applications_submitted_count?: number
          jobs_completed_as_worker_count?: number
          jobs_posted_as_poster_count?: number
          dispute_votes_cast_count?: number
          dispute_votes_won_count?: number
          // Tip System Tracking
          tips_sent_count?: number
          tips_received_count?: number
          tip_karma_earned_today?: number
          tip_karma_last_reset_date?: string
          // Contest Voting Tracking
          contest_votes_cast_count?: number
          contest_votes_won_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      curation_chat_messages: {
        Row: {
          id: string
          project_id: string
          message_type: 'asset_added' | 'asset_backed' | 'asset_verified' | 'asset_hidden' | 'wallet_banned'
          wallet_address: string | null
          token_percentage: number | null
          pending_asset_id: string | null
          asset_type: string | null
          asset_summary: string | null
          vote_count: number | null
          supply_percentage: number | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          message_type: 'asset_added' | 'asset_backed' | 'asset_verified' | 'asset_hidden' | 'wallet_banned'
          wallet_address?: string | null
          token_percentage?: number | null
          pending_asset_id?: string | null
          asset_type?: string | null
          asset_summary?: string | null
          vote_count?: number | null
          supply_percentage?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          message_type?: 'asset_added' | 'asset_backed' | 'asset_verified' | 'asset_hidden' | 'wallet_banned'
          wallet_address?: string | null
          token_percentage?: number | null
          pending_asset_id?: string | null
          asset_type?: string | null
          asset_summary?: string | null
          vote_count?: number | null
          supply_percentage?: number | null
          created_at?: string
        }
      }
      admin_logs: {
        Row: {
          id: string
          admin_wallet: string
          action: string
          project_id: string | null
          entity_type: string | null
          entity_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_wallet: string
          action: string
          project_id?: string | null
          entity_type?: string | null
          entity_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_wallet?: string
          action?: string
          project_id?: string | null
          entity_type?: string | null
          entity_id?: string | null
          details?: Json | null
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          wallet_address: string
          display_name: string | null
          bio: string | null
          avatar_url: string | null
          privacy_level: 'public' | 'holders_only' | 'private'
          allow_messages_from: 'everyone' | 'holders_only' | 'nobody'
          last_seen_at: string | null
          is_online: boolean
          notification_enabled: boolean
          notification_sound: boolean
          notification_preview: 'full' | 'sender' | 'none'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          wallet_address: string
          display_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          privacy_level?: 'public' | 'holders_only' | 'private'
          allow_messages_from?: 'everyone' | 'holders_only' | 'nobody'
          last_seen_at?: string | null
          is_online?: boolean
          notification_enabled?: boolean
          notification_sound?: boolean
          notification_preview?: 'full' | 'sender' | 'none'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          wallet_address?: string
          display_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          privacy_level?: 'public' | 'holders_only' | 'private'
          allow_messages_from?: 'everyone' | 'holders_only' | 'nobody'
          last_seen_at?: string | null
          is_online?: boolean
          notification_enabled?: boolean
          notification_sound?: boolean
          notification_preview?: 'full' | 'sender' | 'none'
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          participant_1: string
          participant_2: string
          last_message_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          participant_1: string
          participant_2: string
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          participant_1?: string
          participant_2?: string
          last_message_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_wallet: string
          content: string
          is_read: boolean
          read_at: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_wallet: string
          content: string
          is_read?: boolean
          read_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_wallet?: string
          content?: string
          is_read?: boolean
          read_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      blocked_users: {
        Row: {
          id: string
          blocker_wallet: string
          blocked_wallet: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          blocker_wallet: string
          blocked_wallet: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          blocker_wallet?: string
          blocked_wallet?: string
          reason?: string | null
          created_at?: string
        }
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          wallet_address: string
          last_typed_at: string
        }
        Insert: {
          conversation_id: string
          wallet_address: string
          last_typed_at?: string
        }
        Update: {
          conversation_id?: string
          wallet_address?: string
          last_typed_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          project_id: string
          poster_wallet: string
          title: string
          description: string
          kpis: string
          category: 'design' | 'marketing' | 'development' | 'content' | 'community' | 'other'
          payment_amount_tokens: number
          payment_amount_usd: number
          status: 'open' | 'assigned' | 'submitted' | 'completed' | 'disputed' | 'cancelled'
          assignment_mode: 'first_come' | 'review'
          assigned_to: string | null
          assigned_at: string | null
          submitted_at: string | null
          completed_at: string | null
          cancelled_at: string | null
          // ==================== ESCROW TRACKING ====================
          /** Whether funds are currently locked in escrow for this job */
          escrow_locked: boolean
          /** Solana transaction signature for the escrow lock transaction */
          escrow_tx_signature: string | null
          /** Total amount locked in escrow (includes job payment + platform fee) */
          escrow_amount_tokens: number | null
          /** SPL token mint address of escrowed funds */
          escrow_token_mint: string | null
          // ==================== DEADLINE MANAGEMENT ====================
          /** When the poster hopes/expects the job to be completed */
          poster_desired_completion: string | null
          /** When the worker commits to completing the job (shown to poster before assignment) */
          worker_committed_completion: string | null
          /** Absolute deadline - auto-release happens after this time if not paused */
          hard_deadline: string | null
          /** When auto-release is scheduled to execute (calculated from hard_deadline) */
          release_scheduled_at: string | null
          // ==================== PAYMENT RELEASE CONTROLS ====================
          /** Whether auto-release is currently paused (by poster requesting revision or admin intervention) */
          release_paused: boolean
          /** Wallet address of user who paused release (poster or admin) */
          release_paused_by: string | null
          /** When release was paused */
          release_paused_at: string | null
          // ==================== REVISION TRACKING ====================
          /** How many times the poster has requested revisions */
          revision_requests_count: number
          /** When the most recent revision was requested */
          last_revision_requested_at: string | null
          // ==================== FEE TRACKING ====================
          /** Platform fee percentage at time of job creation (locked in to prevent retroactive changes) */
          fee_percentage_at_creation: number
          // ==================== CONTEST FIELDS ====================
          /** Whether this job is a contest (multiple submissions, manual winner selection) */
          is_contest: boolean
          /** Maximum number of winners for this contest */
          contest_max_winners: number | null
          /** Array of {position: number, amount_tokens: number, amount_usd: number} for each winner */
          contest_winner_prizes: Array<{ position: number; amount_tokens: number; amount_usd: number }> | null
          /** Deadline for contest submissions */
          contest_submission_deadline: string | null
          /** Deadline for winner selection after submissions close */
          contest_winner_selection_deadline: string | null
          /** Whether submissions are visible to other contestants */
          contest_submissions_visible: boolean
          /** When the winners were selected */
          contest_winners_selected_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          poster_wallet: string
          title: string
          description: string
          kpis: string
          category: 'design' | 'marketing' | 'development' | 'content' | 'community' | 'other'
          payment_amount_tokens: number
          payment_amount_usd: number
          status?: 'open' | 'assigned' | 'submitted' | 'completed' | 'disputed' | 'cancelled'
          assignment_mode?: 'first_come' | 'review'
          assigned_to?: string | null
          assigned_at?: string | null
          submitted_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          // Escrow tracking fields
          escrow_locked?: boolean
          escrow_tx_signature?: string | null
          escrow_amount_tokens?: number | null
          escrow_token_mint?: string | null
          // Deadline management fields
          poster_desired_completion?: string | null
          worker_committed_completion?: string | null
          hard_deadline?: string | null
          release_scheduled_at?: string | null
          // Payment release controls
          release_paused?: boolean
          release_paused_by?: string | null
          release_paused_at?: string | null
          // Revision tracking
          revision_requests_count?: number
          last_revision_requested_at?: string | null
          // Fee tracking
          fee_percentage_at_creation?: number
          // Contest fields
          is_contest?: boolean
          contest_max_winners?: number | null
          contest_winner_prizes?: Array<{ position: number; amount_tokens: number; amount_usd: number }> | null
          contest_submission_deadline?: string | null
          contest_winner_selection_deadline?: string | null
          contest_submissions_visible?: boolean
          contest_winners_selected_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          poster_wallet?: string
          title?: string
          description?: string
          kpis?: string
          category?: 'design' | 'marketing' | 'development' | 'content' | 'community' | 'other'
          payment_amount_tokens?: number
          payment_amount_usd?: number
          status?: 'open' | 'assigned' | 'submitted' | 'completed' | 'disputed' | 'cancelled'
          assignment_mode?: 'first_come' | 'review'
          assigned_to?: string | null
          assigned_at?: string | null
          submitted_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
          // Escrow tracking fields
          escrow_locked?: boolean
          escrow_tx_signature?: string | null
          escrow_amount_tokens?: number | null
          escrow_token_mint?: string | null
          // Deadline management fields
          poster_desired_completion?: string | null
          worker_committed_completion?: string | null
          hard_deadline?: string | null
          release_scheduled_at?: string | null
          // Payment release controls
          release_paused?: boolean
          release_paused_by?: string | null
          release_paused_at?: string | null
          // Revision tracking
          revision_requests_count?: number
          last_revision_requested_at?: string | null
          // Fee tracking
          fee_percentage_at_creation?: number
          // Contest fields
          is_contest?: boolean
          contest_max_winners?: number | null
          contest_winner_prizes?: Array<{ position: number; amount_tokens: number; amount_usd: number }> | null
          contest_submission_deadline?: string | null
          contest_winner_selection_deadline?: string | null
          contest_submissions_visible?: boolean
          contest_winners_selected_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      job_applications: {
        Row: {
          id: string
          job_id: string
          applicant_wallet: string
          pitch: string
          image_urls: string[]
          estimated_completion: string
          committed_completion_date: string
          is_invalidated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          applicant_wallet: string
          pitch: string
          image_urls?: string[]
          estimated_completion: string
          committed_completion_date: string
          is_invalidated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          applicant_wallet?: string
          pitch?: string
          image_urls?: string[]
          estimated_completion?: string
          committed_completion_date?: string
          is_invalidated?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      job_application_votes: {
        Row: {
          id: string
          application_id: string
          voter_wallet: string
          vote_weight: number
          created_at: string
        }
        Insert: {
          id?: string
          application_id: string
          voter_wallet: string
          vote_weight: number
          created_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          voter_wallet?: string
          vote_weight?: number
          created_at?: string
        }
      }
      job_submissions: {
        Row: {
          id: string
          job_id: string
          worker_wallet: string
          message: string
          image_urls: string[]
          external_links: string[]
          submitted_at: string
          // ==================== CONTEST WINNER FIELDS ====================
          /** Whether this submission was selected as a contest winner */
          is_selected_winner: boolean
          /** Contest position (1=first, 2=second, 3=third, etc.) */
          winner_position: number | null
          /** Prize amount in tokens (NUMERIC(20,8) for precision) */
          prize_amount_tokens: number | null
          /** Prize amount in USD (NUMERIC(20,2) for precision) */
          prize_amount_usd: number | null
        }
        Insert: {
          id?: string
          job_id: string
          worker_wallet: string
          message: string
          image_urls?: string[]
          external_links?: string[]
          submitted_at?: string
          // Contest winner fields
          is_selected_winner?: boolean
          winner_position?: number | null
          prize_amount_tokens?: number | null
          prize_amount_usd?: number | null
        }
        Update: {
          id?: string
          job_id?: string
          worker_wallet?: string
          message?: string
          image_urls?: string[]
          external_links?: string[]
          submitted_at?: string
          // Contest winner fields
          is_selected_winner?: boolean
          winner_position?: number | null
          prize_amount_tokens?: number | null
          prize_amount_usd?: number | null
        }
      }
      job_disputes: {
        Row: {
          id: string
          job_id: string
          opened_by: 'poster' | 'worker'
          reason: string
          status: 'active' | 'resolved'
          outcome: 'release_to_worker' | 'refund_to_poster' | null
          created_at: string
          ends_at: string | null
          resolved_at: string | null
          // ==================== ADMIN RESOLUTION ====================
          /** Wallet address of admin who resolved this dispute (null if community voting resolved it) */
          admin_wallet: string | null
          /** Admin's explanation for their resolution decision */
          admin_resolution_notes: string | null
          /** When the admin made their resolution decision */
          admin_decided_at: string | null
          /** Percentage of escrowed funds (excluding fee) to release to worker (0-100, must sum to 100 with poster_percentage) */
          worker_percentage: number | null
          /** Percentage of escrowed funds (excluding fee) to refund to poster (0-100, must sum to 100 with worker_percentage) */
          poster_percentage: number | null
        }
        Insert: {
          id?: string
          job_id: string
          opened_by: 'poster' | 'worker'
          reason: string
          status?: 'active' | 'resolved'
          outcome?: 'release_to_worker' | 'refund_to_poster' | null
          created_at?: string
          ends_at?: string | null
          resolved_at?: string | null
          // Admin resolution fields
          admin_wallet?: string | null
          admin_resolution_notes?: string | null
          admin_decided_at?: string | null
          worker_percentage?: number | null
          poster_percentage?: number | null
        }
        Update: {
          id?: string
          job_id?: string
          opened_by?: 'poster' | 'worker'
          reason?: string
          status?: 'active' | 'resolved'
          outcome?: 'release_to_worker' | 'refund_to_poster' | null
          created_at?: string
          ends_at?: string | null
          resolved_at?: string | null
          // Admin resolution fields
          admin_wallet?: string | null
          admin_resolution_notes?: string | null
          admin_decided_at?: string | null
          worker_percentage?: number | null
          poster_percentage?: number | null
        }
      }
      job_dispute_votes: {
        Row: {
          id: string
          dispute_id: string
          voter_wallet: string
          vote: 'release' | 'refund'
          vote_weight: number
          created_at: string
        }
        Insert: {
          id?: string
          dispute_id: string
          voter_wallet: string
          vote: 'release' | 'refund'
          vote_weight: number
          created_at?: string
        }
        Update: {
          id?: string
          dispute_id?: string
          voter_wallet?: string
          vote?: 'release' | 'refund'
          vote_weight?: number
          created_at?: string
        }
      }
      job_failures: {
        Row: {
          id: string
          job_id: string
          worker_wallet: string
          failure_type: 'disputed_lost' | 'reassigned' | 'ghosted'
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          worker_wallet: string
          failure_type: 'disputed_lost' | 'reassigned' | 'ghosted'
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          worker_wallet?: string
          failure_type?: 'disputed_lost' | 'reassigned' | 'ghosted'
          created_at?: string
        }
      }
      job_comments: {
        Row: {
          id: string
          job_id: string
          wallet_address: string
          message: string
          parent_comment_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          wallet_address: string
          message: string
          parent_comment_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          wallet_address?: string
          message?: string
          parent_comment_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_tips: {
        Row: {
          id: string
          project_id: string | null
          from_wallet: string
          to_wallet: string
          amount_tokens: number
          message: string | null
          token_mint: string | null
          token_symbol: string
          tx_signature: string | null
          amount_usd: number | null
          is_public: boolean
          karma_awarded_sender: number
          karma_awarded_recipient: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          from_wallet: string
          to_wallet: string
          amount_tokens: number
          message?: string | null
          token_mint?: string | null
          token_symbol: string
          tx_signature?: string | null
          amount_usd?: number | null
          is_public?: boolean
          karma_awarded_sender?: number
          karma_awarded_recipient?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          from_wallet?: string
          to_wallet?: string
          amount_tokens?: number
          message?: string | null
          token_mint?: string | null
          token_symbol?: string
          tx_signature?: string | null
          amount_usd?: number | null
          is_public?: boolean
          karma_awarded_sender?: number
          karma_awarded_recipient?: number
          created_at?: string
        }
      }
      /**
       * Platform configuration settings for the escrow system
       * @description Stores platform-wide settings like fee percentage and wallet addresses
       * @rls Public read, admin-only write
       */
      platform_settings: {
        Row: {
          id: string
          /** Setting identifier: 'fee_percentage' (e.g., '5'), 'fee_wallet_address', or 'escrow_wallet_address' */
          setting_key: 'fee_percentage' | 'fee_wallet_address' | 'escrow_wallet_address'
          /** String value of the setting (numeric values stored as strings) */
          setting_value: string
          /** Wallet address of admin who last updated this setting */
          updated_by: string
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          setting_key: 'fee_percentage' | 'fee_wallet_address' | 'escrow_wallet_address'
          setting_value: string
          updated_by: string
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          setting_key?: 'fee_percentage' | 'fee_wallet_address' | 'escrow_wallet_address'
          setting_value?: string
          updated_by?: string
          updated_at?: string
          created_at?: string
        }
      }
      /**
       * Admin wallet addresses with platform permissions
       * @description Tracks which wallets have admin privileges
       * @rls Public read (transparency), super_admin-only write
       */
      admin_wallets: {
        Row: {
          id: string
          /** Solana wallet address with admin privileges */
          wallet_address: string
          /** super_admin: full control (manage admins, settings), moderator: limited control (resolve disputes) */
          role: 'super_admin' | 'moderator'
          /** Wallet address of admin who added this admin */
          added_by: string
          added_at: string
          /** Whether this admin is currently active (can be deactivated without deletion) */
          is_active: boolean
        }
        Insert: {
          id?: string
          wallet_address: string
          role: 'super_admin' | 'moderator'
          added_by: string
          added_at?: string
          is_active?: boolean
        }
        Update: {
          id?: string
          wallet_address?: string
          role?: 'super_admin' | 'moderator'
          added_by?: string
          added_at?: string
          is_active?: boolean
        }
      }
      /**
       * Immutable audit log of all escrow-related transactions
       * @description Tracks every financial movement in the job escrow system
       * @rls Read: job poster/worker only, Insert/Update: service role only, Delete: denied (immutable)
       */
      job_escrow_transactions: {
        Row: {
          id: string
          /** Foreign key to jobs table */
          job_id: string
          /** Type of escrow operation being performed */
          transaction_type: 'lock' | 'release_to_worker' | 'refund_to_poster' | 'fee_collection' | 'partial_release'
          /** Source wallet address (sender) */
          from_wallet: string
          /** Destination wallet address (receiver) */
          to_wallet: string
          /** Amount of tokens transferred (raw amount, not accounting for decimals) */
          amount_tokens: number
          /** SPL token mint address (or 'So11111111111111111111111111111111111111112' for SOL) */
          token_mint: string
          /** Human-readable token symbol (e.g., 'USDC', 'SOL', 'BONK') */
          token_symbol: string
          /** Solana transaction signature (null if transaction hasn't been submitted yet) */
          tx_signature: string | null
          /** Transaction status: pending (not sent), confirmed (on-chain), failed (error occurred) */
          status: 'pending' | 'confirmed' | 'failed'
          /** Number of retry attempts for failed transactions */
          retry_count: number
          /** Error message if transaction failed */
          error_message: string | null
          created_at: string
          /** When transaction was confirmed on-chain (null until confirmed) */
          confirmed_at: string | null
        }
        Insert: {
          id?: string
          job_id: string
          transaction_type: 'lock' | 'release_to_worker' | 'refund_to_poster' | 'fee_collection' | 'partial_release'
          from_wallet: string
          to_wallet: string
          amount_tokens: number
          token_mint: string
          token_symbol: string
          tx_signature?: string | null
          status?: 'pending' | 'confirmed' | 'failed'
          retry_count?: number
          error_message?: string | null
          created_at?: string
          confirmed_at?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          transaction_type?: 'lock' | 'release_to_worker' | 'refund_to_poster' | 'fee_collection' | 'partial_release'
          from_wallet?: string
          to_wallet?: string
          amount_tokens?: number
          token_mint?: string
          token_symbol?: string
          tx_signature?: string | null
          status?: 'pending' | 'confirmed' | 'failed'
          retry_count?: number
          error_message?: string | null
          created_at?: string
          confirmed_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_wallet: string
          type: NotificationType
          actor_wallet: string | null
          reference_id: string | null
          reference_type: NotificationReferenceType | null
          batch_group_key: string | null
          batch_count: number
          is_read: boolean
          created_at: string
          metadata: NotificationMetadata | null
        }
        Insert: {
          id?: string
          user_wallet: string
          type: NotificationType
          actor_wallet?: string | null
          reference_id?: string | null
          reference_type?: NotificationReferenceType | null
          batch_group_key?: string | null
          batch_count?: number
          is_read?: boolean
          created_at?: string
          metadata?: NotificationMetadata | null
        }
        Update: {
          id?: string
          user_wallet?: string
          type?: NotificationType
          actor_wallet?: string | null
          reference_id?: string | null
          reference_type?: NotificationReferenceType | null
          batch_group_key?: string | null
          batch_count?: number
          is_read?: boolean
          created_at?: string
          metadata?: NotificationMetadata | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// ==================== NOTIFICATION TYPES ====================

/**
 * All possible notification types in the platform
 */
export type NotificationType =
  | 'job_application_received'
  | 'job_assigned'
  | 'job_submitted'
  | 'job_completed'
  | 'job_dispute_created'
  | 'job_dispute_vote'
  | 'job_comment'
  | 'asset_upvote'
  | 'asset_verified'
  | 'asset_hidden'
  | 'tip_received'
  | 'message_received'
  | 'karma_milestone'
  | 'karma_warning'
  | 'karma_ban'
  | 'payment_released'
  | 'payment_refunded'
  | 'admin_dispute_new'
  | 'admin_job_new'
  | 'admin_asset_new'
  | 'admin_revenue_earned';

/**
 * Types of entities that can be referenced in notifications
 */
export type NotificationReferenceType =
  | 'job'
  | 'asset'
  | 'message'
  | 'tip'
  | 'conversation'
  | 'karma'
  | 'payment'
  | 'dispute';

/**
 * Flexible metadata structure for different notification types
 * Each notification type can include different metadata fields
 */
export interface NotificationMetadata {
  // Job related
  job_title?: string;
  job_type?: string;
  applicant_count?: number;
  
  // Payment related
  amount?: number;
  token?: string;
  token_mint?: string;
  
  // Karma related
  karma_points?: number;
  karma_level?: string;
  new_karma_score?: number;
  old_karma_score?: number;
  
  // Asset related
  asset_name?: string;
  asset_type?: string;
  upvote_count?: number;
  
  // Message related
  message_preview?: string;
  conversation_id?: string;
  
  // Comment related
  comment_text?: string;
  comment_preview?: string;
  
  // Dispute related
  dispute_reason?: string;
  dispute_id?: string;
  vote_type?: 'worker' | 'poster';
  
  // Admin related
  revenue_amount?: number;
  admin_action?: string;
  
  // Generic fields
  url?: string;
  icon?: string;
  action_label?: string;
}

/**
 * Type-safe notification insert (omits auto-generated fields)
 */
export type NotificationInsert = Omit<
  Database['public']['Tables']['notifications']['Insert'],
  'id' | 'created_at'
>;

/**
 * Type-safe notification update
 */
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update'];

/**
 * Full notification row type
 */
export type Notification = Database['public']['Tables']['notifications']['Row'];

// ==================== TIP SYSTEM TYPES ====================

/**
 * Represents a token that can be used for tipping
 */
export interface TipToken {
  mint: string
  symbol: string
  logoUrl: string | null
  balance: number
  decimals: number
  usdValue: number
  usdPrice: number | null
}

/**
 * Form data for the tip modal
 */
export interface TipFormData {
  recipientWallet: string
  selectedToken: TipToken | null
  amount: string
  message: string
  isPublic: boolean
}

