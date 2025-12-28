import { Text, Hr } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';

interface SubmissionReceivedProps {
  submitterName: string;
  tokenSymbol: string;
  tokenName: string;
  submittedAt: string;
}

export default function SubmissionReceived({
  submitterName,
  tokenSymbol,
  tokenName,
  submittedAt
}: SubmissionReceivedProps) {
  return (
    <EmailLayout preview={`We received your submission for ${tokenSymbol}`}>
      <Text style={heading}>📬 Submission Received!</Text>
      
      <Text style={paragraph}>
        Hi {submitterName},
      </Text>
      
      <Text style={paragraph}>
        Thank you for submitting <strong>{tokenSymbol} - {tokenName}</strong> to Orggly! 
        We're excited that you're interested in joining our community.
      </Text>
      
      <div style={infoBox}>
        <Text style={infoHeading}>📋 Your Submission Details</Text>
        <Text style={infoText}>
          <strong>Project:</strong> {tokenSymbol} - {tokenName}
        </Text>
        <Text style={infoText}>
          <strong>Submitted:</strong> {submittedAt}
        </Text>
        <Text style={infoText}>
          <strong>Status:</strong> Under Review
        </Text>
      </div>
      
      <Hr style={divider} />
      
      <div style={timelineBox}>
        <Text style={timelineHeading}>⏱️ What Happens Next?</Text>
        <Text style={timelineText}>
          Our team will review your submission and get back to you <strong>within 48 hours</strong>. 
          Here's what we look at:
        </Text>
        <ul style={list}>
          <li style={listItem}>Project legitimacy and smart contract verification</li>
          <li style={listItem}>Community size and engagement</li>
          <li style={listItem}>Project roadmap and vision</li>
          <li style={listItem}>Team background and transparency</li>
        </ul>
      </div>
      
      <Hr style={divider} />
      
      <Text style={paragraph}>
        Once approved, you'll receive a unique link to set up your complete project profile on Orggly. 
        If we need any additional information, we'll reach out via this email.
      </Text>
      
      <div style={noteBlock}>
        <Text style={noteText}>
          💡 <strong>Tip:</strong> Keep an eye on your inbox (and spam folder, just in case) 
          for our response within the next 48 hours.
        </Text>
      </div>
      
      <Hr style={divider} />
      
      <Text style={paragraph}>
        Thanks again for your submission. We're looking forward to potentially having you on Orggly!
      </Text>
      
      <Text style={signature}>
        The Orggly Team
      </Text>
      
      <Hr style={divider} />
      
      <Text style={helpText}>
        Questions? Reply to this email and we'll be happy to help.
      </Text>
    </EmailLayout>
  );
}

// Styles matching Orggly design system
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
  margin: '12px 0 0 0',
};

const listItem = {
  fontSize: '15px',
  color: '#1A1A1E',
  lineHeight: '1.8',
  marginBottom: '6px',
};

const divider = {
  borderColor: '#E5E7F0',
  margin: '32px 0',
};

const infoBox = {
  backgroundColor: '#F7F8FB',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '24px',
};

const infoHeading = {
  fontSize: '14px',
  fontWeight: 700,
  color: '#1A1A1E',
  margin: '0 0 12px 0',
};

const infoText = {
  fontSize: '14px',
  color: '#1A1A1E',
  lineHeight: '1.6',
  margin: '6px 0',
};

const timelineBox = {
  backgroundColor: '#EEE7FF',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '24px',
};

const timelineHeading = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#7C4DFF',
  margin: '0 0 12px 0',
};

const timelineText = {
  fontSize: '15px',
  color: '#1A1A1E',
  lineHeight: '1.6',
  margin: '0',
};

const noteBlock = {
  backgroundColor: '#FFF4ED',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '24px',
};

const noteText = {
  fontSize: '14px',
  color: '#1A1A1E',
  lineHeight: '1.6',
  margin: '0',
};

const signature = {
  fontSize: '16px',
  color: '#1A1A1E',
  fontWeight: 600,
  margin: '24px 0 0 0',
};

const helpText = {
  fontSize: '14px',
  color: '#A3A7B5',
  margin: '0',
  textAlign: 'center' as const,
};

