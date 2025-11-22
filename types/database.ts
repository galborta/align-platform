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




