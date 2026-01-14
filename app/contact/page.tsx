import type { Metadata } from 'next';
import ContactForm from './ContactForm';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export const metadata: Metadata = {
  title: 'Contact Us | Orggly',
  description: 'Get in touch with the Orggly team. We\'re here to help with any questions about our platform.',
};

export default function ContactPage() {
  return (
    <main 
      className="min-h-screen py-12 px-4 sm:px-6 lg:px-8"
      style={{ background: 'var(--page-background)' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-6 hover:underline transition-colors font-body"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowBackIcon sx={{ fontSize: 20 }} />
          <span>Back to Home</span>
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <h1 
            className="text-display mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            Contact Us
          </h1>
          <p 
            className="text-body"
            style={{ color: 'var(--text-secondary)' }}
          >
            Have questions? We're here to help. Send us a message and we'll respond as soon as possible.
          </p>
        </div>

        {/* Contact Form Card */}
        <div
          className="p-8 sm:p-10"
          style={{
            background: 'var(--card-background)',
            borderRadius: 'var(--radius-card-lg)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <ContactForm />
        </div>

        {/* Additional Info */}
        <div 
          className="mt-8 p-6 rounded-xl"
          style={{ background: 'var(--accent-primary-soft)' }}
        >
          <h2 
            className="text-headline mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            What to expect
          </h2>
          <ul className="space-y-2 text-body-small" style={{ color: 'var(--text-secondary)' }}>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--accent-primary)' }}>•</span>
              <span>We typically respond within 24-48 hours</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--accent-primary)' }}>•</span>
              <span>You'll receive a confirmation email once your message is sent</span>
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--accent-primary)' }}>•</span>
              <span>For urgent platform issues, please mention "URGENT" in your subject</span>
            </li>
          </ul>
        </div>

        {/* FAQ Link */}
        <div className="mt-8 text-center">
          <p className="text-body-small" style={{ color: 'var(--text-muted)' }}>
            Looking for quick answers?{' '}
            <Link 
              href="/legal/terms-of-service"
              className="hover:underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              Check our Terms of Service
            </Link>
            {' '}or{' '}
            <Link 
              href="/legal/privacy-policy"
              className="hover:underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
