import { Text, Hr } from '@react-email/components';
import * as React from 'react';
import EmailLayout from '../components/EmailLayout';

interface ProjectRejectedProps {
  submitterName: string;
  tokenSymbol: string;
  tokenName: string;
}

export default function ProjectRejected({
  submitterName,
  tokenSymbol,
  tokenName
}: ProjectRejectedProps) {
  return (
    <EmailLayout preview={`Update on your Orggly submission`}>
      <Text style={heading}>Your Orggly Submission</Text>
      
      <Text style={paragraph}>
        Hi {submitterName},
      </Text>
      
      <Text style={paragraph}>
        Thank you for your interest in joining Orggly with <strong>{tokenSymbol} - {tokenName}</strong>.
      </Text>
      
      <Text style={paragraph}>
        After reviewing your submission, we've decided not to move forward with adding your project at this time. This decision could be due to several factors:
      </Text>
      
      <ul style={list}>
        <li style={listItem}>Project stage or maturity</li>
        <li style={listItem}>Community size or activity level</li>
        <li style={listItem}>Strategic fit with our platform</li>
        <li style={listItem}>Current platform capacity</li>
      </ul>
      
      <Hr style={divider} />
      
      <div style={encourageBlock}>
        <Text style={encourageHeading}>We Encourage You to Reapply</Text>
        <Text style={encourageText}>
          You're welcome to submit again in the future once your project has developed further. We're always looking for exciting new projects to join our community.
        </Text>
      </div>
      
      <Hr style={divider} />
      
      <Text style={paragraph}>
        We appreciate your understanding and wish you the best with your project.
      </Text>
      
      <Text style={signature}>
        Best regards,<br />
        The Orggly Team
      </Text>
      
      <Hr style={divider} />
      
      <Text style={helpText}>
        If you have questions about this decision, feel free to reply to this email.
      </Text>
    </EmailLayout>
  );
}

// Styles
const heading = {
  fontSize: '24px',
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
  color: '#6F7280',
  lineHeight: '1.8',
  marginBottom: '8px',
};

const divider = {
  borderColor: '#E5E7F0',
  margin: '32px 0',
};

const encourageBlock = {
  backgroundColor: '#E3F8ED',
  borderRadius: '12px',
  padding: '20px',
  marginBottom: '24px',
};

const encourageHeading = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#36C170',
  margin: '0 0 12px 0',
};

const encourageText = {
  fontSize: '15px',
  color: '#1A1A1E',
  lineHeight: '1.6',
  margin: '0',
};

const signature = {
  fontSize: '16px',
  color: '#1A1A1E',
  lineHeight: '1.6',
  margin: '24px 0 0 0',
};

const helpText = {
  fontSize: '14px',
  color: '#A3A7B5',
  margin: '0',
};



