import { Text, Hr } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';
import EmailButton from '../components/EmailButton';

interface ProjectApprovedProps {
  submitterName: string;
  tokenSymbol: string;
  tokenName: string;
  creationLink: string;
}

export default function ProjectApproved({
  submitterName,
  tokenSymbol,
  tokenName,
  creationLink
}: ProjectApprovedProps) {
  return (
    <EmailLayout preview={`Your project ${tokenSymbol} has been approved!`}>
      <Text style={heading}>🎉 Great News!</Text>
      
      <Text style={paragraph}>
        Hi {submitterName},
      </Text>
      
      <Text style={paragraph}>
        Your project <strong>{tokenSymbol} - {tokenName}</strong> has been selected to join Orggly!
      </Text>
      
      <Text style={paragraph}>
        You can now complete your project profile using the button below. This unique link will allow you to:
      </Text>
      
      <ul style={list}>
        <li style={listItem}>Set up your complete project page</li>
        <li style={listItem}>Add team information and social links</li>
        <li style={listItem}>Upload legal documents</li>
        <li style={listItem}>Configure your community settings</li>
      </ul>
      
      <EmailButton href={creationLink}>
        Complete Your Profile →
      </EmailButton>
      
      <Hr style={divider} />
      
      <div style={noteBlock}>
        <Text style={noteHeading}>📝 Important Notes:</Text>
        <Text style={noteText}>
          • This link never expires - take your time setting up your project
        </Text>
        <Text style={noteText}>
          • You can save drafts as you work (auto-saves every 30 seconds)
        </Text>
        <Text style={noteText}>
          • Your contract address is locked and cannot be changed
        </Text>
        <Text style={noteText}>
          • If you have questions, reply to this email or message us on Orggly
        </Text>
      </div>
      
      <Hr style={divider} />
      
      <Text style={paragraph}>
        Welcome to Orggly! We're excited to have you in our community.
      </Text>
      
      <Text style={signature}>
        The Orggly Team
      </Text>
      
      <Hr style={divider} />
      
      <div style={linkBlock}>
        <Text style={linkLabel}>Your unique creation link:</Text>
        <Text style={linkUrl}>{creationLink}</Text>
        <Text style={linkHelp}>
          (You can bookmark this link or click the button above)
        </Text>
      </div>
    </EmailLayout>
  );
}

// Styles
const heading = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#1A1A1E',
  margin: '0 0 24px 0',
};

const paragraph = {
  fontSize: '16px',
  color: '#1A1A1E',
  lineHeight: '1.6',
  margin: '0 0 16px 0',
};

const list = {
  paddingLeft: '24px',
  margin: '0 0 24px 0',
};

const listItem = {
  fontSize: '16px',
  color: '#1A1A1E',
  lineHeight: '1.8',
  marginBottom: '8px',
};

const divider = {
  borderColor: '#E5E7F0',
  margin: '32px 0',
};

const noteBlock = {
  backgroundColor: '#EEE7FF',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '24px',
};

const noteHeading = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#7C4DFF',
  margin: '0 0 12px 0',
};

const noteText = {
  fontSize: '14px',
  color: '#1A1A1E',
  lineHeight: '1.6',
  margin: '6px 0',
};

const signature = {
  fontSize: '16px',
  color: '#1A1A1E',
  fontWeight: 600,
  margin: '24px 0 0 0',
};

const linkBlock = {
  backgroundColor: '#F7F8FB',
  borderRadius: '12px',
  padding: '16px',
};

const linkLabel = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#6F7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px 0',
};

const linkUrl = {
  fontSize: '13px',
  color: '#7C4DFF',
  fontFamily: 'monospace',
  wordBreak: 'break-all' as const,
  margin: '0 0 8px 0',
};

const linkHelp = {
  fontSize: '12px',
  color: '#A3A7B5',
  margin: '0',
};



