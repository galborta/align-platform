export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_wallet: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          project_id: string | null
        }
        Insert: {
          action: string
          admin_wallet: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          project_id?: string | null
        }
        Update: {
          action?: string
          admin_wallet?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_wallets: {
        Row: {
          added_at: string | null
          added_by: string
          id: string
          is_active: boolean | null
          role: string
          wallet_address: string
        }
        Insert: {
          added_at?: string | null
          added_by: string
          id?: string
          is_active?: boolean | null
          role: string
          wallet_address: string
        }
        Update: {
          added_at?: string | null
          added_by?: string
          id?: string
          is_active?: boolean | null
          role?: string
          wallet_address?: string
        }
        Relationships: []
      }
      asset_votes: {
        Row: {
          created_at: string | null
          id: string
          karma_earned: number | null
          pending_asset_id: string | null
          token_balance_snapshot: number
          token_percentage_snapshot: number
          vote_type: string
          voter_wallet: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          karma_earned?: number | null
          pending_asset_id?: string | null
          token_balance_snapshot: number
          token_percentage_snapshot: number
          vote_type: string
          voter_wallet: string
        }
        Update: {
          created_at?: string | null
          id?: string
          karma_earned?: number | null
          pending_asset_id?: string | null
          token_balance_snapshot?: number
          token_percentage_snapshot?: number
          vote_type?: string
          voter_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_votes_pending_asset_id_fkey"
            columns: ["pending_asset_id"]
            isOneToOne: false
            referencedRelation: "pending_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_wallet: string
          blocker_wallet: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_wallet: string
          blocker_wallet: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_wallet?: string
          blocker_wallet?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string | null
          holding_tier: string
          id: string
          message_text: string
          project_id: string | null
          reply_to_id: string | null
          token_balance: number
          token_percentage: number
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          holding_tier: string
          id?: string
          message_text: string
          project_id?: string | null
          reply_to_id?: string | null
          token_balance: number
          token_percentage: number
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          holding_tier?: string
          id?: string
          message_text?: string
          project_id?: string | null
          reply_to_id?: string | null
          token_balance?: number
          token_percentage?: number
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_tips: {
        Row: {
          amount_tokens: number
          amount_usd: number | null
          created_at: string | null
          from_wallet: string
          id: string
          is_public: boolean
          karma_awarded_recipient: number
          karma_awarded_sender: number
          message: string | null
          project_id: string | null
          to_wallet: string
          token_mint: string | null
          token_symbol: string
          tx_signature: string | null
        }
        Insert: {
          amount_tokens: number
          amount_usd?: number | null
          created_at?: string | null
          from_wallet: string
          id?: string
          is_public?: boolean
          karma_awarded_recipient?: number
          karma_awarded_sender?: number
          message?: string | null
          project_id?: string | null
          to_wallet: string
          token_mint?: string | null
          token_symbol: string
          tx_signature?: string | null
        }
        Update: {
          amount_tokens?: number
          amount_usd?: number | null
          created_at?: string | null
          from_wallet?: string
          id?: string
          is_public?: boolean
          karma_awarded_recipient?: number
          karma_awarded_sender?: number
          message?: string | null
          project_id?: string | null
          to_wallet?: string
          token_mint?: string | null
          token_symbol?: string
          tx_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_tips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_by_participant_1: boolean | null
          archived_by_participant_2: boolean | null
          created_at: string | null
          id: string
          last_message_at: string | null
          participant_1: string
          participant_2: string
          updated_at: string | null
          tags: string[] | null
          submission_id: string | null
        }
        Insert: {
          archived_by_participant_1?: boolean | null
          archived_by_participant_2?: boolean | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_1: string
          participant_2: string
          updated_at?: string | null
          tags?: string[] | null
          submission_id?: string | null
        }
        Update: {
          archived_by_participant_1?: boolean | null
          archived_by_participant_2?: boolean | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_1?: string
          participant_2?: string
          updated_at?: string | null
          tags?: string[] | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "project_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_assets: {
        Row: {
          asset_type: string | null
          created_at: string | null
          description: string | null
          id: string
          media_url: string | null
          name: string | null
          project_id: string | null
        }
        Insert: {
          asset_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          media_url?: string | null
          name?: string | null
          project_id?: string | null
        }
        Update: {
          asset_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          media_url?: string | null
          name?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      curation_chat_messages: {
        Row: {
          asset_summary: string | null
          asset_type: string | null
          created_at: string | null
          id: string
          message_type: string
          pending_asset_id: string | null
          project_id: string | null
          supply_percentage: number | null
          token_percentage: number | null
          vote_count: number | null
          wallet_address: string | null
        }
        Insert: {
          asset_summary?: string | null
          asset_type?: string | null
          created_at?: string | null
          id?: string
          message_type: string
          pending_asset_id?: string | null
          project_id?: string | null
          supply_percentage?: number | null
          token_percentage?: number | null
          vote_count?: number | null
          wallet_address?: string | null
        }
        Update: {
          asset_summary?: string | null
          asset_type?: string | null
          created_at?: string | null
          id?: string
          message_type?: string
          pending_asset_id?: string | null
          project_id?: string | null
          supply_percentage?: number | null
          token_percentage?: number | null
          vote_count?: number | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curation_chat_messages_pending_asset_id_fkey"
            columns: ["pending_asset_id"]
            isOneToOne: false
            referencedRelation: "pending_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curation_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_application_votes: {
        Row: {
          application_id: string | null
          created_at: string | null
          id: string
          vote_weight: number
          voter_wallet: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          id?: string
          vote_weight: number
          voter_wallet: string
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          id?: string
          vote_weight?: number
          voter_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_application_votes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applicant_wallet: string
          committed_completion_date: string
          created_at: string | null
          estimated_completion: string
          id: string
          image_urls: string[] | null
          is_invalidated: boolean | null
          job_id: string | null
          pitch: string
          updated_at: string | null
          // ==================== REVISION OFFERING FIELDS ====================
          revisions_offered: string | null
          revisions_used: number
          revisions_remaining: string | null
          last_revision_requested_at: string | null
        }
        Insert: {
          applicant_wallet: string
          committed_completion_date: string
          created_at?: string | null
          estimated_completion: string
          id?: string
          image_urls?: string[] | null
          is_invalidated?: boolean | null
          job_id?: string | null
          pitch: string
          updated_at?: string | null
          // Revision offering fields
          revisions_offered?: string | null
          revisions_used?: number
          revisions_remaining?: string | null
          last_revision_requested_at?: string | null
        }
        Update: {
          applicant_wallet?: string
          committed_completion_date?: string
          created_at?: string | null
          estimated_completion?: string
          id?: string
          image_urls?: string[] | null
          is_invalidated?: boolean | null
          job_id?: string | null
          pitch?: string
          updated_at?: string | null
          // Revision offering fields
          revisions_offered?: string | null
          revisions_used?: number
          revisions_remaining?: string | null
          last_revision_requested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_comments: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          message: string
          parent_comment_id: string | null
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          message: string
          parent_comment_id?: string | null
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          message?: string
          parent_comment_id?: string | null
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "job_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      job_dispute_votes: {
        Row: {
          created_at: string | null
          dispute_id: string | null
          id: string
          vote: string
          vote_weight: number
          voter_wallet: string
        }
        Insert: {
          created_at?: string | null
          dispute_id?: string | null
          id?: string
          vote: string
          vote_weight: number
          voter_wallet: string
        }
        Update: {
          created_at?: string | null
          dispute_id?: string | null
          id?: string
          vote?: string
          vote_weight?: number
          voter_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_dispute_votes_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "job_disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_disputes: {
        Row: {
          admin_decided_at: string | null
          admin_resolution_notes: string | null
          admin_wallet: string | null
          created_at: string | null
          dispute_type: string | null
          ends_at: string | null
          id: string
          job_id: string | null
          opened_by: string
          outcome: string | null
          poster_percentage: number | null
          reason: string
          resolved_at: string | null
          revision_context: RevisionDisputeContext | null
          status: string | null
          worker_percentage: number | null
        }
        Insert: {
          admin_decided_at?: string | null
          admin_resolution_notes?: string | null
          admin_wallet?: string | null
          created_at?: string | null
          dispute_type?: string | null
          ends_at?: string | null
          id?: string
          job_id?: string | null
          opened_by: string
          outcome?: string | null
          poster_percentage?: number | null
          reason: string
          resolved_at?: string | null
          revision_context?: RevisionDisputeContext | null
          status?: string | null
          worker_percentage?: number | null
        }
        Update: {
          admin_decided_at?: string | null
          admin_resolution_notes?: string | null
          admin_wallet?: string | null
          created_at?: string | null
          dispute_type?: string | null
          ends_at?: string | null
          id?: string
          job_id?: string | null
          opened_by?: string
          outcome?: string | null
          poster_percentage?: number | null
          reason?: string
          resolved_at?: string | null
          revision_context?: RevisionDisputeContext | null
          status?: string | null
          worker_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_disputes_admin_wallet"
            columns: ["admin_wallet"]
            isOneToOne: false
            referencedRelation: "admin_wallets"
            referencedColumns: ["wallet_address"]
          },
          {
            foreignKeyName: "job_disputes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_escrow_transactions: {
        Row: {
          amount_tokens: number
          confirmed_at: string | null
          created_at: string | null
          error_message: string | null
          from_wallet: string
          id: string
          job_id: string
          retry_count: number | null
          status: string | null
          to_wallet: string
          token_mint: string
          token_symbol: string
          transaction_type: string
          tx_signature: string | null
        }
        Insert: {
          amount_tokens: number
          confirmed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          from_wallet: string
          id?: string
          job_id: string
          retry_count?: number | null
          status?: string | null
          to_wallet: string
          token_mint: string
          token_symbol: string
          transaction_type: string
          tx_signature?: string | null
        }
        Update: {
          amount_tokens?: number
          confirmed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          from_wallet?: string
          id?: string
          job_id?: string
          retry_count?: number | null
          status?: string | null
          to_wallet?: string
          token_mint?: string
          token_symbol?: string
          transaction_type?: string
          tx_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_escrow_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_failures: {
        Row: {
          created_at: string | null
          failure_type: string | null
          id: string
          job_id: string | null
          worker_wallet: string
        }
        Insert: {
          created_at?: string | null
          failure_type?: string | null
          id?: string
          job_id?: string | null
          worker_wallet: string
        }
        Update: {
          created_at?: string | null
          failure_type?: string | null
          id?: string
          job_id?: string | null
          worker_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_failures_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_submissions: {
        Row: {
          external_links: string[] | null
          id: string
          image_urls: string[] | null
          is_selected_winner: boolean | null
          job_id: string | null
          message: string
          prize_amount_tokens: number | null
          prize_amount_usd: number | null
          // ==================== SOCIAL MEDIA FIELDS ====================
          social_approval_status: string | null
          social_denial_reason: string | null
          social_follower_count: number | null
          social_follower_count_verified: number | null
          social_payment_amount_tokens: number | null
          social_payment_amount_usd: number | null
          social_payment_released: boolean | null
          social_payment_tx_signature: string | null
          social_tweet_link: string | null
          submitted_at: string | null
          winner_position: number | null
          worker_wallet: string
        }
        Insert: {
          external_links?: string[] | null
          id?: string
          image_urls?: string[] | null
          is_selected_winner?: boolean | null
          job_id?: string | null
          message: string
          prize_amount_tokens?: number | null
          prize_amount_usd?: number | null
          // Social media fields
          social_approval_status?: string | null
          social_denial_reason?: string | null
          social_follower_count?: number | null
          social_follower_count_verified?: number | null
          social_payment_amount_tokens?: number | null
          social_payment_amount_usd?: number | null
          social_payment_released?: boolean | null
          social_payment_tx_signature?: string | null
          social_tweet_link?: string | null
          submitted_at?: string | null
          winner_position?: number | null
          worker_wallet: string
        }
        Update: {
          external_links?: string[] | null
          id?: string
          image_urls?: string[] | null
          is_selected_winner?: boolean | null
          job_id?: string | null
          message?: string
          prize_amount_tokens?: number | null
          prize_amount_usd?: number | null
          // Social media fields
          social_approval_status?: string | null
          social_denial_reason?: string | null
          social_follower_count?: number | null
          social_follower_count_verified?: number | null
          social_payment_amount_tokens?: number | null
          social_payment_amount_usd?: number | null
          social_payment_released?: boolean | null
          social_payment_tx_signature?: string | null
          social_tweet_link?: string | null
          submitted_at?: string | null
          winner_position?: number | null
          worker_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          assignment_mode: string | null
          cancelled_at: string | null
          category: string
          completed_at: string | null
          // ==================== CONTEST FIELDS ====================
          contest_max_winners: number | null
          contest_submission_deadline: string | null
          contest_submissions_visible: boolean | null
          contest_winner_prizes: Json | null
          contest_winner_selection_deadline: string | null
          contest_winners_selected_at: string | null
          created_at: string | null
          description: string
          // ==================== ESCROW FIELDS ====================
          escrow_amount_tokens: number | null
          escrow_locked: boolean | null
          escrow_token_mint: string | null
          escrow_tx_signature: string | null
          fee_percentage_at_creation: number | null
          hard_deadline: string | null
          id: string
          is_contest: boolean | null
          // ==================== SOCIAL MEDIA FIELDS ====================
          is_social_media_job: boolean | null
          kpis: string
          last_revision_requested_at: string | null
          payment_amount_tokens: number
          payment_amount_usd: number
          poster_desired_completion: string | null
          poster_wallet: string
          project_id: string | null
          release_paused: boolean | null
          release_paused_at: string | null
          release_paused_by: string | null
          release_scheduled_at: string | null
          revision_requests_count: number | null
          // Social media budget
          social_actual_budget_released: number | null
          social_budget_tiers: Json | null
          // Social media deadlines
          social_engagement_deadline: string | null
          social_job_type: string | null
          social_min_followers_required: number | null
          social_payments_distributed: boolean | null
          social_review_deadline: string | null
          social_submission_deadline: string | null
          social_total_budget_tokens: number | null
          social_total_budget_usd: number | null
          // Social media content
          social_tweet_topic: string | null
          social_tweet_url: string | null
          status: string | null
          submitted_at: string | null
          title: string
          updated_at: string | null
          worker_committed_completion: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          assignment_mode?: string | null
          cancelled_at?: string | null
          category: string
          completed_at?: string | null
          contest_max_winners?: number | null
          contest_submission_deadline?: string | null
          contest_submissions_visible?: boolean | null
          contest_winner_prizes?: Json | null
          contest_winner_selection_deadline?: string | null
          contest_winners_selected_at?: string | null
          created_at?: string | null
          description: string
          escrow_amount_tokens?: number | null
          escrow_locked?: boolean | null
          escrow_token_mint?: string | null
          escrow_tx_signature?: string | null
          fee_percentage_at_creation?: number | null
          hard_deadline?: string | null
          id?: string
          is_contest?: boolean | null
          is_social_media_job?: boolean | null
          kpis: string
          last_revision_requested_at?: string | null
          payment_amount_tokens: number
          payment_amount_usd: number
          poster_desired_completion?: string | null
          poster_wallet: string
          project_id?: string | null
          release_paused?: boolean | null
          release_paused_at?: string | null
          release_paused_by?: string | null
          release_scheduled_at?: string | null
          revision_requests_count?: number | null
          social_actual_budget_released?: number | null
          social_budget_tiers?: Json | null
          social_engagement_deadline?: string | null
          social_job_type?: string | null
          social_min_followers_required?: number | null
          social_payments_distributed?: boolean | null
          social_review_deadline?: string | null
          social_submission_deadline?: string | null
          social_total_budget_tokens?: number | null
          social_total_budget_usd?: number | null
          social_tweet_topic?: string | null
          social_tweet_url?: string | null
          status?: string | null
          submitted_at?: string | null
          title: string
          updated_at?: string | null
          worker_committed_completion?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          assignment_mode?: string | null
          cancelled_at?: string | null
          category?: string
          completed_at?: string | null
          contest_max_winners?: number | null
          contest_submission_deadline?: string | null
          contest_submissions_visible?: boolean | null
          contest_winner_prizes?: Json | null
          contest_winner_selection_deadline?: string | null
          contest_winners_selected_at?: string | null
          created_at?: string | null
          description?: string
          escrow_amount_tokens?: number | null
          escrow_locked?: boolean | null
          escrow_token_mint?: string | null
          escrow_tx_signature?: string | null
          fee_percentage_at_creation?: number | null
          hard_deadline?: string | null
          id?: string
          is_contest?: boolean | null
          is_social_media_job?: boolean | null
          kpis?: string
          last_revision_requested_at?: string | null
          payment_amount_tokens?: number
          payment_amount_usd?: number
          poster_desired_completion?: string | null
          poster_wallet?: string
          project_id?: string | null
          release_paused?: boolean | null
          release_paused_at?: string | null
          release_paused_by?: string | null
          release_scheduled_at?: string | null
          revision_requests_count?: number | null
          social_actual_budget_released?: number | null
          social_budget_tiers?: Json | null
          social_engagement_deadline?: string | null
          social_job_type?: string | null
          social_min_followers_required?: number | null
          social_payments_distributed?: boolean | null
          social_review_deadline?: string | null
          social_submission_deadline?: string | null
          social_total_budget_tokens?: number | null
          social_total_budget_usd?: number | null
          social_tweet_topic?: string | null
          social_tweet_url?: string | null
          status?: string | null
          submitted_at?: string | null
          title?: string
          updated_at?: string | null
          worker_committed_completion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_assets: {
        Row: {
          asset_type: string | null
          created_at: string | null
          id: string
          jurisdiction: string | null
          name: string | null
          project_id: string | null
          registration_id: string | null
          status: string | null
        }
        Insert: {
          asset_type?: string | null
          created_at?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string | null
          project_id?: string | null
          registration_id?: string | null
          status?: string | null
        }
        Update: {
          asset_type?: string | null
          created_at?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string | null
          project_id?: string | null
          registration_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          read_at: string | null
          sender_wallet: string
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          sender_wallet: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          sender_wallet?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_wallet: string | null
          batch_count: number | null
          batch_group_key: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          job_id: string | null
          message: string | null
          metadata: Json | null
          priority: string | null
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          title: string | null
          type: string
          user_wallet: string
        }
        Insert: {
          actor_wallet?: string | null
          batch_count?: number | null
          batch_group_key?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          job_id?: string | null
          message?: string | null
          metadata?: Json | null
          priority?: string | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string | null
          type: string
          user_wallet: string
        }
        Update: {
          actor_wallet?: string | null
          batch_count?: number | null
          batch_group_key?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          job_id?: string | null
          message?: string | null
          metadata?: Json | null
          priority?: string | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string | null
          type?: string
          user_wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_assets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          asset_classification: 'official' | 'affiliated'
          asset_data: Json
          asset_type: string
          created_at: string | null
          hidden_at: string | null
          id: string
          project_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          submission_token_balance: number
          submission_token_percentage: number
          submitter_wallet: string
          total_report_weight: number | null
          total_upvote_weight: number | null
          unique_reporters_count: number | null
          unique_upvoters_count: number | null
          updated_at: string | null
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          asset_classification?: 'official' | 'affiliated'
          asset_data: Json
          asset_type: string
          created_at?: string | null
          hidden_at?: string | null
          id?: string
          project_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          submission_token_balance: number
          submission_token_percentage: number
          submitter_wallet: string
          total_report_weight?: number | null
          total_upvote_weight?: number | null
          unique_reporters_count?: number | null
          unique_upvoters_count?: number | null
          updated_at?: string | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          asset_classification?: 'official' | 'affiliated'
          asset_data?: Json
          asset_type?: string
          created_at?: string | null
          hidden_at?: string | null
          id?: string
          project_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          submission_token_balance?: number
          submission_token_percentage?: number
          submitter_wallet?: string
          total_report_weight?: number | null
          total_upvote_weight?: number | null
          unique_reporters_count?: number | null
          unique_upvoters_count?: number | null
          updated_at?: string | null
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string | null
          updated_by: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string | null
          updated_by: string
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
          updated_by?: string
        }
        Relationships: []
      }
      project_creation_tokens: {
        Row: {
          id: string
          token: string
          contract_address: string
          email: string
          submission_id: string
          created_by: string
          created_at: string | null
          expires_at: string | null
          status: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          token: string
          contract_address: string
          email: string
          submission_id: string
          created_by: string
          created_at?: string | null
          expires_at?: string | null
          status?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          token?: string
          contract_address?: string
          email?: string
          submission_id?: string
          created_by?: string
          created_at?: string | null
          expires_at?: string | null
          status?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_creation_tokens_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "project_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_drafts: {
        Row: {
          id: string
          token_id: string
          contract_address: string
          form_data: Json
          last_saved: string | null
          completed: boolean | null
        }
        Insert: {
          id?: string
          token_id: string
          contract_address: string
          form_data: Json
          last_saved?: string | null
          completed?: boolean | null
        }
        Update: {
          id?: string
          token_id?: string
          contract_address?: string
          form_data?: Json
          last_saved?: string | null
          completed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "project_drafts_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "project_creation_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      project_submissions: {
        Row: {
          id: string
          name: string
          email: string
          contract_address: string
          token_symbol: string | null
          token_name: string | null
          role: string
          message: string | null
          status: string
          conversation_id: string | null
          submitted_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          contract_address: string
          token_symbol?: string | null
          token_name?: string | null
          role: string
          message?: string | null
          status?: string
          conversation_id?: string | null
          submitted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          contract_address?: string
          token_symbol?: string | null
          token_name?: string | null
          role?: string
          message?: string | null
          status?: string
          conversation_id?: string | null
          submitted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_submissions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          creator_wallet: string
          description: string | null
          id: string
          profile_image_url: string | null
          status: string | null
          token_mint: string
          token_name: string
          token_symbol: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          creator_wallet: string
          description?: string | null
          id?: string
          profile_image_url?: string | null
          status?: string | null
          token_mint: string
          token_name: string
          token_symbol: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          creator_wallet?: string
          description?: string | null
          id?: string
          profile_image_url?: string | null
          status?: string | null
          token_mint?: string
          token_name?: string
          token_symbol?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      social_assets: {
        Row: {
          asset_classification: 'official' | 'affiliated'
          created_at: string | null
          follower_tier: string | null
          handle: string
          id: string
          platform: string
          profile_url: string | null
          project_id: string | null
          verification_code: string | null
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          asset_classification?: 'official' | 'affiliated'
          created_at?: string | null
          follower_tier?: string | null
          handle: string
          id?: string
          platform: string
          profile_url?: string | null
          project_id?: string | null
          verification_code?: string | null
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          asset_classification?: 'official' | 'affiliated'
          created_at?: string | null
          follower_tier?: string | null
          handle?: string
          id?: string
          platform?: string
          profile_url?: string | null
          project_id?: string | null
          verification_code?: string | null
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_comments: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          message: string
          parent_comment_id: string | null
          submission_id: string
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          message: string
          parent_comment_id?: string | null
          submission_id: string
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          message?: string
          parent_comment_id?: string | null
          submission_id?: string
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "submission_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_comments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "job_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_wallets: {
        Row: {
          created_at: string | null
          id: string
          label: string | null
          project_id: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label?: string | null
          project_id?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string | null
          project_id?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_wallets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          last_typed_at: string | null
          wallet_address: string
        }
        Insert: {
          conversation_id: string
          last_typed_at?: string | null
          wallet_address: string
        }
        Update: {
          conversation_id?: string
          last_typed_at?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          allow_messages_from: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          is_online: boolean | null
          last_seen_at: string | null
          notification_enabled: boolean | null
          notification_preview: string | null
          notification_sound: boolean | null
          privacy_level: string | null
          updated_at: string | null
          wallet_address: string
          // ==================== WALLET VERIFICATION FIELDS ====================
          wallet_verified: boolean | null
          wallet_verified_at: string | null
          verification_signature: string | null
          is_us_person: boolean | null
          geo_check_confirmed_at: string | null
          last_terms_accepted_at: string | null
          terms_version_accepted: string | null
        }
        Insert: {
          allow_messages_from?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          notification_enabled?: boolean | null
          notification_preview?: string | null
          notification_sound?: boolean | null
          privacy_level?: string | null
          updated_at?: string | null
          wallet_address: string
          // Wallet verification fields
          wallet_verified?: boolean | null
          wallet_verified_at?: string | null
          verification_signature?: string | null
          is_us_person?: boolean | null
          geo_check_confirmed_at?: string | null
          last_terms_accepted_at?: string | null
          terms_version_accepted?: string | null
        }
        Update: {
          allow_messages_from?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          notification_enabled?: boolean | null
          notification_preview?: string | null
          notification_sound?: boolean | null
          privacy_level?: string | null
          updated_at?: string | null
          wallet_address?: string
          // Wallet verification fields
          wallet_verified?: boolean | null
          wallet_verified_at?: string | null
          verification_signature?: string | null
          is_us_person?: boolean | null
          geo_check_confirmed_at?: string | null
          last_terms_accepted_at?: string | null
          terms_version_accepted?: string | null
        }
        Relationships: []
      }
      // ==================== WALLET VERIFICATION SYSTEM TABLES ====================
      verification_nonces: {
        Row: {
          id: string
          nonce: string
          wallet_address: string
          used: boolean
          created_at: string
          expires_at: string
          used_at: string | null
          ip_address: string | null
        }
        Insert: {
          id?: string
          nonce: string
          wallet_address: string
          used?: boolean
          created_at?: string
          expires_at: string
          used_at?: string | null
          ip_address?: string | null
        }
        Update: {
          id?: string
          nonce?: string
          wallet_address?: string
          used?: boolean
          created_at?: string
          expires_at?: string
          used_at?: string | null
          ip_address?: string | null
        }
        Relationships: []
      }
      wallet_verifications: {
        Row: {
          id: string
          wallet_address: string
          signature: string
          message: string
          nonce: string
          verified_at: string
          ip_address: string | null
          user_agent: string | null
          previous_verification_id: string | null
        }
        Insert: {
          id?: string
          wallet_address: string
          signature: string
          message: string
          nonce: string
          verified_at?: string
          ip_address?: string | null
          user_agent?: string | null
          previous_verification_id?: string | null
        }
        Update: {
          id?: string
          wallet_address?: string
          signature?: string
          message?: string
          nonce?: string
          verified_at?: string
          ip_address?: string | null
          user_agent?: string | null
          previous_verification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_verifications_previous_verification_id_fkey"
            columns: ["previous_verification_id"]
            isOneToOne: false
            referencedRelation: "wallet_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          id: string
          wallet_address: string
          terms_version: string
          privacy_version: string
          accepted_at: string
          signature: string
          ip_address: string | null
          is_us_person_confirmed: boolean
        }
        Insert: {
          id?: string
          wallet_address: string
          terms_version: string
          privacy_version: string
          accepted_at?: string
          signature: string
          ip_address?: string | null
          is_us_person_confirmed?: boolean
        }
        Update: {
          id?: string
          wallet_address?: string
          terms_version?: string
          privacy_version?: string
          accepted_at?: string
          signature?: string
          ip_address?: string | null
          is_us_person_confirmed?: boolean
        }
        Relationships: []
      }
      wallet_karma: {
        Row: {
          assets_added_count: number | null
          ban_expires_at: string | null
          banned_at: string | null
          contest_votes_cast_count: number | null
          contest_votes_won_count: number | null
          created_at: string | null
          id: string
          is_banned: boolean | null
          jobs_completed_as_worker_count: number
          project_id: string | null
          reports_given_count: number | null
          tip_karma_earned_today: number
          tip_karma_last_reset_date: string
          tips_received_count: number
          tips_sent_count: number
          total_karma_points: number | null
          updated_at: string | null
          upvotes_given_count: number | null
          wallet_address: string
          warning_count: number | null
          warnings: Json | null
        }
        Insert: {
          assets_added_count?: number | null
          ban_expires_at?: string | null
          banned_at?: string | null
          contest_votes_cast_count?: number | null
          contest_votes_won_count?: number | null
          created_at?: string | null
          id?: string
          is_banned?: boolean | null
          jobs_completed_as_worker_count?: number
          project_id?: string | null
          reports_given_count?: number | null
          tip_karma_earned_today?: number
          tip_karma_last_reset_date?: string
          tips_received_count?: number
          tips_sent_count?: number
          total_karma_points?: number | null
          updated_at?: string | null
          upvotes_given_count?: number | null
          wallet_address: string
          warning_count?: number | null
          warnings?: Json | null
        }
        Update: {
          assets_added_count?: number | null
          ban_expires_at?: string | null
          banned_at?: string | null
          contest_votes_cast_count?: number | null
          contest_votes_won_count?: number | null
          created_at?: string | null
          id?: string
          is_banned?: boolean | null
          jobs_completed_as_worker_count?: number
          project_id?: string | null
          reports_given_count?: number | null
          tip_karma_earned_today?: number
          tip_karma_last_reset_date?: string
          tips_received_count?: number
          tips_sent_count?: number
          total_karma_points?: number | null
          updated_at?: string | null
          upvotes_given_count?: number | null
          wallet_address?: string
          warning_count?: number | null
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_karma_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
  | 'admin_revenue_earned'
  // Social media job notifications
  | 'social_submission_received'
  | 'social_submission_approved'
  | 'social_submission_denied'
  | 'social_payment_distributed'
  // Social asset review notifications
  | 'social_asset_pending'
  | 'social_asset_approved'
  | 'social_asset_rejected'
  // Revision notifications
  | 'revision_requested'
  | 'voluntary_revision_requested'
  | 'voluntary_revision_accepted'
  | 'voluntary_revision_declined'
  // Revision warning notifications
  | 'high_revision_count_warning_poster'
  | 'high_revision_count_warning_worker'
  // Contest notifications
  | 'contest_judging_started'
  | 'contest_winners_selected'
  | 'contest_prize_won'
  | 'contest_no_submissions'
  | 'contest_deadline_reminder'
  // Job status notifications
  | 'job_status_changed'
  // Editor notifications (Sprint 1: Project Editors System)
  | 'editor_added'
  | 'editor_removed'
  | 'social_asset_pending'
  | 'social_asset_approved'
  | 'social_asset_rejected';

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
  | 'dispute'
  | 'social_submission'
  | 'contest';

/**
 * Context data for revision-related disputes
 * Stored in job_disputes.revision_context as JSONB
 */
export interface RevisionDisputeContext {
  /** Number of revisions offered (number or 'unlimited') */
  revisions_offered: string | number;
  /** Number of revisions used */
  revisions_used: number;
  /** Revisions remaining (number or 'unlimited') */
  revisions_remaining: string | number;
  /** Full history of revision requests */
  revision_history: Array<{
    number: number;
    notes: string;
    requestedAt: string;
    submittedAt?: string;
    isVoluntary?: boolean;
  }>;
  /** When the latest revision was requested (ISO string) */
  last_revision_requested_at?: string;
  /** How long the revision has been unanswered (for refusal disputes) */
  unanswered_duration_hours?: number;
  /** Original job scope/KPIs */
  original_scope?: string;
  /** Whether abuse threshold was exceeded (for unlimited abuse disputes) */
  abuse_threshold_exceeded?: boolean;
  /** Suggested prorated payment percentage */
  suggested_proration?: number;
}

/**
 * Flexible metadata structure for different notification types
 * Each notification type can include different metadata fields
 */
export interface NotificationMetadata {
  // Job related
  job_title?: string;
  job_type?: string;
  applicant_count?: number;
  project_id?: string;
  
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
  asset_id?: string;
  asset_classification?: 'official' | 'affiliated';
  asset_platform?: string;
  asset_handle?: string;
  asset_domain?: string;
  rejection_reason?: string;
  editor_wallet?: string;
  
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
  
  // Social media job related
  social_tweet_link?: string;
  social_follower_count?: number;
  social_payment_amount?: number;
  social_denial_reason?: string;
  
  // Revision related
  revision_number?: number;
  revision_count?: number;
  is_voluntary?: boolean;
  is_revision?: boolean;
  notes_preview?: string;
  
  // Revision dispute context
  revisions_offered?: string | number;
  revisions_used?: number;
  revisions_remaining?: string | number;
  revision_request_history?: Array<{
    number: number;
    notes: string;
    requestedAt: string;
    isVoluntary?: boolean;
  }>;
  unanswered_since?: string;
  abuse_threshold_exceeded?: boolean;
  
  // Contest related
  contest_submission_count?: number;
  contest_max_winners?: number;
  winner_position?: number;
  prize_amount_tokens?: number;
  prize_amount_usd?: number;
  
  // Editor related (Sprint 1: Project Editors System)
  editor_wallet?: string;
  asset_id?: string;
  rejection_reason?: string;
  project_name?: string;
  
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

// ==================== SOCIAL MEDIA JOB TYPES ====================
// Re-export from dedicated file for convenience
export type { BudgetTier, SocialJobType, SocialApprovalStatus, DisputeType, SocialDisputeType } from './social-media-jobs'

// ==================== REVISION OFFERING TYPES ====================

/**
 * Asset classification - distinguishes between official and affiliated assets
 */
export type AssetClassification = 'official' | 'affiliated'

/**
 * Represents a revision offering - either 'unlimited' or a specific number
 */
export type RevisionOffering = 'unlimited' | number

/**
 * Status object for revision-related information
 */
export type RevisionStatus = {
  offered: RevisionOffering | null
  used: number
  remaining: RevisionOffering | null
}

/**
 * Job application type alias for convenience
 */
export type JobApplication = Database['public']['Tables']['job_applications']['Row']

// ==================== WALLET VERIFICATION TYPES ====================

/**
 * User profile with wallet verification fields
 */
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

/**
 * Verification nonce for single-use signature challenges
 */
export type VerificationNonce = Database['public']['Tables']['verification_nonces']['Row']
export type VerificationNonceInsert = Database['public']['Tables']['verification_nonces']['Insert']
export type VerificationNonceUpdate = Database['public']['Tables']['verification_nonces']['Update']

/**
 * Wallet verification audit trail record
 */
export type WalletVerification = Database['public']['Tables']['wallet_verifications']['Row']
export type WalletVerificationInsert = Database['public']['Tables']['wallet_verifications']['Insert']
export type WalletVerificationUpdate = Database['public']['Tables']['wallet_verifications']['Update']

/**
 * Legal acceptance record (ToS, Privacy Policy)
 */
export type LegalAcceptance = Database['public']['Tables']['legal_acceptances']['Row']
export type LegalAcceptanceInsert = Database['public']['Tables']['legal_acceptances']['Insert']
export type LegalAcceptanceUpdate = Database['public']['Tables']['legal_acceptances']['Update']

/**
 * Verification status for a user profile
 */
export interface WalletVerificationStatus {
  isVerified: boolean
  verifiedAt: string | null
  hasAcceptedTerms: boolean
  termsVersion: string | null
  isUsPerson: boolean | null
}
