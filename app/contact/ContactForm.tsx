'use client';

import { useState, FormEvent } from 'react';
import toast from 'react-hot-toast';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }

    // Validate email
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Validate subject
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.trim().length > 150) {
      newErrors.subject = 'Subject must be 150 characters or less';
    }

    // Validate message
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    } else if (formData.message.trim().length > 1000) {
      newErrors.message = 'Message must be 1000 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          toast.error(`Too many requests. ${data.details || 'Please try again later.'}`);
        } else {
          toast.error(data.details || data.error || 'Failed to send message');
        }
        return;
      }

      toast.success("Message sent successfully! We'll respond soon.");
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      setErrors({});

    } catch (error) {
      console.error('Contact form error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name Field */}
      <div>
        <label 
          htmlFor="name" 
          className="block text-label mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          Name <span style={{ color: 'var(--accent-primary)' }}>*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-lg font-body"
          style={{
            backgroundColor: 'var(--card-background)',
            border: errors.name 
              ? '2px solid #EF4444' 
              : '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
          placeholder="Your name"
          maxLength={100}
          onFocus={(e) => {
            if (!errors.name) {
              e.target.style.borderColor = 'var(--accent-primary)';
            }
          }}
          onBlur={(e) => {
            if (!errors.name) {
              e.target.style.borderColor = 'var(--border-subtle)';
            }
          }}
        />
        {errors.name && (
          <p className="mt-1 text-caption" style={{ color: '#EF4444' }}>
            {errors.name}
          </p>
        )}
      </div>

      {/* Email Field */}
      <div>
        <label 
          htmlFor="email" 
          className="block text-label mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          Email <span style={{ color: 'var(--accent-primary)' }}>*</span>
        </label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-lg font-body"
          style={{
            backgroundColor: 'var(--card-background)',
            border: errors.email 
              ? '2px solid #EF4444' 
              : '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
          placeholder="your.email@example.com"
          onFocus={(e) => {
            if (!errors.email) {
              e.target.style.borderColor = 'var(--accent-primary)';
            }
          }}
          onBlur={(e) => {
            if (!errors.email) {
              e.target.style.borderColor = 'var(--border-subtle)';
            }
          }}
        />
        {errors.email && (
          <p className="mt-1 text-caption" style={{ color: '#EF4444' }}>
            {errors.email}
          </p>
        )}
      </div>

      {/* Subject Field */}
      <div>
        <label 
          htmlFor="subject" 
          className="block text-label mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          Subject <span style={{ color: 'var(--accent-primary)' }}>*</span>
        </label>
        <input
          type="text"
          id="subject"
          value={formData.subject}
          onChange={(e) => handleChange('subject', e.target.value)}
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-lg font-body"
          style={{
            backgroundColor: 'var(--card-background)',
            border: errors.subject 
              ? '2px solid #EF4444' 
              : '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
          placeholder="What's this about?"
          maxLength={150}
          onFocus={(e) => {
            if (!errors.subject) {
              e.target.style.borderColor = 'var(--accent-primary)';
            }
          }}
          onBlur={(e) => {
            if (!errors.subject) {
              e.target.style.borderColor = 'var(--border-subtle)';
            }
          }}
        />
        {errors.subject && (
          <p className="mt-1 text-caption" style={{ color: '#EF4444' }}>
            {errors.subject}
          </p>
        )}
      </div>

      {/* Message Field */}
      <div>
        <label 
          htmlFor="message" 
          className="block text-label mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          Message <span style={{ color: 'var(--accent-primary)' }}>*</span>
        </label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => handleChange('message', e.target.value)}
          disabled={isSubmitting}
          rows={6}
          className="w-full px-4 py-3 rounded-lg font-body resize-y"
          style={{
            backgroundColor: 'var(--card-background)',
            border: errors.message 
              ? '2px solid #EF4444' 
              : '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            outline: 'none',
            minHeight: '120px'
          }}
          placeholder="Tell us how we can help..."
          maxLength={1000}
          onFocus={(e) => {
            if (!errors.message) {
              e.target.style.borderColor = 'var(--accent-primary)';
            }
          }}
          onBlur={(e) => {
            if (!errors.message) {
              e.target.style.borderColor = 'var(--border-subtle)';
            }
          }}
        />
        <div className="flex justify-between items-center mt-1">
          {errors.message ? (
            <p className="text-caption" style={{ color: '#EF4444' }}>
              {errors.message}
            </p>
          ) : (
            <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
              {formData.message.length} / 1000 characters
            </p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 rounded-full font-label flex items-center justify-center gap-2 transition-all"
        style={{
          backgroundColor: isSubmitting ? 'var(--text-muted)' : 'var(--accent-primary)',
          color: '#FFFFFF',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          opacity: isSubmitting ? 0.6 : 1
        }}
        onMouseEnter={(e) => {
          if (!isSubmitting) {
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSubmitting) {
            e.currentTarget.style.opacity = '1';
          }
        }}
      >
        {isSubmitting ? (
          <>
            <CircularProgress size={20} style={{ color: '#FFFFFF' }} />
            <span>Sending...</span>
          </>
        ) : (
          <>
            <SendIcon sx={{ fontSize: 20 }} />
            <span>Send Message</span>
          </>
        )}
      </button>
    </form>
  );
}
