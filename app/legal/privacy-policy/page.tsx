// app/legal/privacy-policy/page.tsx
// Privacy Policy page using Orggly design system

import { Metadata } from 'next'
import PrivacyContent from './PrivacyContent'

export const metadata: Metadata = {
  title: 'Privacy Policy | Orggly',
  description: 'How Orggly collects, uses, and protects your data. Learn about our privacy practices and your rights.',
  openGraph: {
    title: 'Privacy Policy | Orggly',
    description: 'How Orggly collects, uses, and protects your data',
    type: 'website',
  },
}

export default function PrivacyPolicyPage() {
  return <PrivacyContent />
}


