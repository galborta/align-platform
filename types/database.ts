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




