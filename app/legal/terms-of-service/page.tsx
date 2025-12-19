// app/legal/terms-of-service/page.tsx
// Terms of Service page using Orggly design system

import { Metadata } from 'next'
import TermsContent from './TermsContent'

export const metadata: Metadata = {
  title: 'Terms of Service | Orggly',
  description: 'Orggly Terms of Service - Your agreement to use our platform for transparent creator token coordination.',
  openGraph: {
    title: 'Terms of Service | Orggly',
    description: 'Orggly Terms of Service - Your agreement to use our platform',
    type: 'website',
  },
}

export default function TermsOfServicePage() {
  return <TermsContent />
}



