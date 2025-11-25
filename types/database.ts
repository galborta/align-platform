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
        }
        Insert: {
          id?: string
          job_id: string
          worker_wallet: string
          message: string
          image_urls?: string[]
          external_links?: string[]
          submitted_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          worker_wallet?: string
          message?: string
          image_urls?: string[]
          external_links?: string[]
          submitted_at?: string
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
          commenter_wallet: string
          comment_text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          commenter_wallet: string
          comment_text: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          commenter_wallet?: string
          comment_text?: string
          created_at?: string
          updated_at?: string
        }
      }
      chat_tips: {
        Row: {
          id: string
          project_id: string
          from_wallet: string
          to_wallet: string
          amount_nub: number
          message: string | null
          token_mint: string | null
          tx_signature: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          from_wallet: string
          to_wallet: string
          amount_nub: number
          message?: string | null
          token_mint?: string | null
          tx_signature?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          from_wallet?: string
          to_wallet?: string
          amount_nub?: number
          message?: string | null
          token_mint?: string | null
          tx_signature?: string | null
          created_at?: string
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




