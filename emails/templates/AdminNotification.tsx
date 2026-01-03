import { Text, Link, Hr } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';

interface AdminNotificationProps {
  submitterName: string;
  submitterEmail: string;
  tokenSymbol: string;
  tokenName: string;
  contractAddress: string;
  role: string;
  message?: string;
  submittedAt: string;
  conversationUrl: string;
}

export default function AdminNotification({
  submitterName,
  submitterEmail,
  tokenSymbol,
  tokenName,
  contractAddress,
  role,
  message,
  submittedAt,
  conversationUrl
}: AdminNotificationProps) {
  return (
    <EmailLayout preview={`New project submission: ${tokenSymbol}`}>
      <Text style={heading}>🚀 New Project Submission</Text>
      
      <Text style={paragraph}>
        A new project has been submitted to Orggly and is waiting for your review.
      </Text>
      
      <Hr style={divider} />
      
      <div style={infoBlock}>
        <Text style={label}>Submitter:</Text>
        <Text style={value}>{submitterName}</Text>
        
        <Text style={label}>Email:</Text>
        <Text style={value}>{submitterEmail}</Text>
        
        <Text style={label}>Token:</Text>
        <Text style={value}>{tokenSymbol} - {tokenName}</Text>
        
        <Text style={label}>Contract Address:</Text>
        <Text style={valueCode}>{contractAddress}</Text>
        
        <Text style={label}>Role:</Text>
        <Text style={value}>{role}</Text>
        
        {message && (
          <>
            <Text style={label}>Message:</Text>
            <Text style={valueMessage}>{message}</Text>
          </>
        )}
        
        <Text style={label}>Submitted:</Text>
        <Text style={value}>{submittedAt}</Text>
      </div>
      
      <Hr style={divider} />
      
      <Text style={paragraph}>
        <Link href={conversationUrl} style={link}>
          View and respond in your Orggly admin panel →
        </Link>
      </Text>
      
      <Text style={helpText}>
        Log in to Orggly to connect your wallet and approve or reject this submission.
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

const valueCode = {
  fontSize: '14px',
  color: '#7C4DFF',
  fontFamily: 'monospace',
  margin: '0 0 8px 0',
  wordBreak: 'break-all' as const,
};

const valueMessage = {
  fontSize: '15px',
  color: '#1A1A1E',
  lineHeight: '1.5',
  fontStyle: 'italic',
  margin: '0 0 8px 0',
  padding: '12px',
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  borderLeft: '3px solid #7C4DFF',
};

const link = {
  color: '#7C4DFF',
  textDecoration: 'none',
  fontWeight: 600,
};

const helpText = {
  fontSize: '14px',
  color: '#6F7280',
  margin: '8px 0 0 0',
};




