import { Text, Hr } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';

interface ContactFormProps {
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
}

export default function ContactForm({
  name,
  email,
  subject,
  message,
  submittedAt
}: ContactFormProps) {
  return (
    <EmailLayout preview={`Contact Form: ${subject}`}>
      <Text style={heading}>📬 New Contact Form Submission</Text>
      
      <Text style={paragraph}>
        Someone has submitted a message through the Orggly contact form.
      </Text>
      
      <Hr style={divider} />
      
      <div style={infoBlock}>
        <Text style={label}>Name:</Text>
        <Text style={value}>{name}</Text>
        
        <Text style={label}>Email:</Text>
        <Text style={value}>{email}</Text>
        
        <Text style={label}>Subject:</Text>
        <Text style={value}>{subject}</Text>
        
        <Text style={label}>Message:</Text>
        <Text style={valueMessage}>{message}</Text>
        
        <Text style={label}>Submitted:</Text>
        <Text style={value}>{submittedAt}</Text>
      </div>
      
      <Hr style={divider} />
      
      <Text style={helpText}>
        You can reply directly to this email to respond to {name}.
      </Text>
    </EmailLayout>
  );
}

// Styles
const heading = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#1A1A1E',
  margin: '0 0 16px 0',
};

const paragraph = {
  fontSize: '16px',
  color: '#1A1A1E',
  lineHeight: '1.6',
  margin: '0 0 16px 0',
};

const divider = {
  borderColor: '#E5E7F0',
  margin: '24px 0',
};

const infoBlock = {
  backgroundColor: '#F7F8FB',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '24px',
};

const label = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#6F7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '12px 0 4px 0',
};

const value = {
  fontSize: '16px',
  color: '#1A1A1E',
  margin: '0 0 8px 0',
};

const valueMessage = {
  fontSize: '15px',
  color: '#1A1A1E',
  lineHeight: '1.5',
  fontStyle: 'normal',
  margin: '0 0 8px 0',
  padding: '12px',
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  borderLeft: '3px solid #7C4DFF',
  whiteSpace: 'pre-wrap' as const,
};

const helpText = {
  fontSize: '14px',
  color: '#6F7280',
  margin: '8px 0 0 0',
};
