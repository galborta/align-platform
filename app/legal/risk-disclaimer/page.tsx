// app/legal/risk-disclaimer/page.tsx
// Risk Disclaimer page using Orggly design system

import { Metadata } from 'next'
import RiskContent from './RiskContent'

export const metadata: Metadata = {
  title: 'Risk Disclaimer | Orggly',
  description: 'Understanding the risks of using Orggly platform. Read our comprehensive risk warnings before using the platform.',
  openGraph: {
    title: 'Risk Disclaimer | Orggly',
    description: 'Understanding the risks of using Orggly platform',
    type: 'website',
  },
}

export default function RiskDisclaimerPage() {
  return <RiskContent />
}



