import { Database } from '@/types/database'

type SocialAsset = Database['public']['Tables']['social_assets']['Row']
type LegalAsset = Database['public']['Tables']['legal_assets']['Row']

export interface Project {
  social_assets: SocialAsset[]
  legal_assets: LegalAsset[]
}

export interface Badge {
  type: string
  label: string
  color: string
  icon: string
}

export function calculateBadges(project: Project): Badge[] {
  const badges: Badge[] = []

  // Badge 1: Verified Creator (at least 1 verified social)
  const verifiedSocials = project.social_assets.filter(s => s.verified)
  if (verifiedSocials.length > 0) {
    badges.push({
      type: 'verified_creator',
      label: 'Verified Creator',
      color: '#36C170', // Green
      icon: 'check_circle'
    })
  }

  // Badge 2: Strong IP (100k+ followers OR trademark)
  const hasLargeFollowing = verifiedSocials.some(s => 
    ['100k-500k', '500k-1m', '1m-5m', '5m+'].includes(s.follower_tier || '')
  )
  const hasTrademark = project.legal_assets.some(l => 
    l.asset_type === 'trademark' && l.status === 'Registered'
  )
  
  if (hasLargeFollowing || hasTrademark) {
    badges.push({
      type: 'strong_ip',
      label: 'Strong IP',
      color: '#F59E0B', // Gold
      icon: 'star'
    })
  }

  return badges
}





