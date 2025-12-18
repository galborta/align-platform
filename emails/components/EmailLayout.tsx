import { Html, Head, Body, Container, Section, Text } from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  children: React.ReactNode;
  preview: string;  // Preview text shown in email inbox
}

export default function EmailLayout({ children, preview }: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <title>{preview}</title>
      </Head>
      <Body style={main}>
        <Container style={container}>
          {/* Orggly Logo / Header */}
          <Section style={header}>
            <Text style={logo}>Orggly</Text>
          </Section>
          
          {/* Email Content */}
          <Section style={content}>
            {children}
          </Section>
          
          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © 2024 Orggly. All rights reserved.
            </Text>
            <Text style={footerText}>
              You're receiving this email because you submitted a project to Orggly.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles matching Orggly design system
const main = {
  backgroundColor: '#E3F06F',  // var(--page-background)
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: '40px 0',
};

const container = {
  backgroundColor: '#FFFFFF',  // var(--card-background)
  borderRadius: '24px',
  margin: '0 auto',
  padding: '40px',
  maxWidth: '600px',
  boxShadow: '0 20px 40px 0 rgba(15, 23, 42, 0.06)',
};

const header = {
  marginBottom: '32px',
  textAlign: 'center' as const,
};

const logo = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#1A1A1E',  // var(--text-primary)
  margin: 0,
};

const content = {
  marginBottom: '32px',
};

const footer = {
  borderTop: '1px solid #E5E7F0',  // var(--border-subtle)
  paddingTop: '24px',
  marginTop: '40px',
};

const footerText = {
  fontSize: '12px',
  color: '#A3A7B5',  // var(--text-muted)
  lineHeight: '1.5',
  margin: '4px 0',
  textAlign: 'center' as const,
};


