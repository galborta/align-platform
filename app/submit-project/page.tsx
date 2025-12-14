'use client'

import { useState } from 'react'
import { BackgroundShapes } from '@/components/BackgroundShapes'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import { supabase } from '@/lib/supabase'

const ROLE_OPTIONS = [
  'Founder',
  'Team Member',
  'Community Member',
  'Investor',
  'Other'
] as const

type Role = typeof ROLE_OPTIONS[number]

export default function SubmitProjectPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contractAddress: '',
    role: '' as Role | '',
    message: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be less than 100 characters'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.contractAddress.trim()) {
      newErrors.contractAddress = 'Contract address is required'
    }

    if (!formData.role) {
      newErrors.role = 'Please select your role'
    }

    if (formData.message.length > 500) {
      newErrors.message = 'Message must be less than 500 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      const { data, error } = await supabase
        .from('project_submissions')
        .insert([{
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          contract_address: formData.contractAddress.trim(),
          role: formData.role as Role,
          message: formData.message.trim() || null,
          status: 'pending'
        }])
        .select()
        .single()

      if (error) throw error

      setSubmitted(true)
      console.log('Submission successful:', data)
    } catch (error: any) {
      console.error('Submission error:', error)
      
      // Check for duplicate submission
      if (error.code === '23505') {
        setErrors({ 
          contractAddress: 'A pending or approved application already exists for this contract address' 
        })
      } else {
        setErrors({ 
          submit: 'Failed to submit application. Please try again.' 
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="page-wrapper">
        <BackgroundShapes />
        
        <main className="relative z-10">
          <div className="submit-container">
            {/* Logo Placeholder */}
            <div className="logo-placeholder">
              <svg width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
                <rect width="8" height="32" x="4" y="4" fill="var(--text-primary)" rx="2"/>
                <rect width="8" height="32" x="24" y="4" fill="var(--text-primary)" rx="2"/>
                <rect width="12" height="4" x="12" y="18" fill="var(--text-primary)" rx="2"/>
                <text x="45" y="28" fill="var(--text-primary)" fontFamily="var(--font-heading)" fontSize="20" fontWeight="700">ALIGN</text>
              </svg>
            </div>

            {/* Success Message */}
            <div className="success-card">
              <div className="success-icon">✓</div>
              <h1 className="text-title">Application Submitted!</h1>
              <p className="text-body">
                Thank you for your interest in joining Align. We've received your application and will review it within 48 hours.
              </p>
              <p className="text-body-small">
                You'll receive an email at <strong>{formData.email}</strong> with next steps.
              </p>
              <button
                onClick={() => window.location.href = '/'}
                className="secondary-button"
              >
                Return to Home
              </button>
            </div>
          </div>
        </main>

        <style jsx>{`
          .success-card {
            text-align: center;
            padding: var(--space-xxl) var(--space-lg);
          }

          .success-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto var(--space-lg);
            background: var(--accent-success);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            font-weight: bold;
          }

          .success-card .text-title {
            margin-bottom: var(--space-md);
            color: var(--text-primary);
          }

          .success-card .text-body {
            margin-bottom: var(--space-md);
            color: var(--text-secondary);
          }

          .success-card .text-body-small {
            margin-bottom: var(--space-xl);
            color: var(--text-muted);
          }

          .secondary-button {
            background: white;
            color: var(--accent-primary);
            border: 2px solid var(--accent-primary);
            padding: var(--space-sm) var(--space-lg);
            border-radius: var(--radius-control);
            font-family: var(--font-body);
            font-size: var(--text-label);
            font-weight: var(--weight-semibold);
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .secondary-button:hover {
            background: var(--accent-primary-soft);
            transform: translateY(-2px);
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <BackgroundShapes />
      
      <main className="relative z-10">
        <div className="submit-container">
          {/* Logo Placeholder */}
          <div className="logo-placeholder">
            <svg width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
              <rect width="8" height="32" x="4" y="4" fill="var(--text-primary)" rx="2"/>
              <rect width="8" height="32" x="24" y="4" fill="var(--text-primary)" rx="2"/>
              <rect width="12" height="4" x="12" y="18" fill="var(--text-primary)" rx="2"/>
              <text x="45" y="28" fill="var(--text-primary)" fontFamily="var(--font-heading)" fontSize="20" fontWeight="700">ALIGN</text>
            </svg>
          </div>

          {/* Header */}
          <div className="header-section">
            <h1 className="text-title">Submit Your Project</h1>
            <p className="text-body">
              Join the Align community. We'll review your application and get back to you within 48 hours.
            </p>
          </div>

          {/* Form Card */}
          <div className="form-card">
            <form onSubmit={handleSubmit}>
              {/* Name Field */}
              <TextField
                label="Your Name"
                placeholder="Enter your name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
                inputProps={{ maxLength: 100 }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-body)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    '& fieldset': {
                      borderColor: 'var(--border-subtle)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'var(--accent-primary)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'var(--accent-primary)',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-secondary)',
                    '&.Mui-focused': {
                      color: 'var(--accent-primary)',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'var(--text-primary)',
                  },
                }}
              />

              {/* Email Field */}
              <TextField
                label="Your Email"
                type="email"
                placeholder="your@email.com"
                fullWidth
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                error={!!errors.email}
                helperText={errors.email}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-body)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    '& fieldset': {
                      borderColor: 'var(--border-subtle)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'var(--accent-primary)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'var(--accent-primary)',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-secondary)',
                    '&.Mui-focused': {
                      color: 'var(--accent-primary)',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'var(--text-primary)',
                  },
                }}
              />

              {/* Contract Address Field */}
              <TextField
                label="Token Contract Address"
                placeholder="Solana address or Ethereum 0x..."
                fullWidth
                required
                value={formData.contractAddress}
                onChange={(e) => handleChange('contractAddress', e.target.value)}
                error={!!errors.contractAddress}
                helperText={errors.contractAddress}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-body)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    '& fieldset': {
                      borderColor: 'var(--border-subtle)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'var(--accent-primary)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'var(--accent-primary)',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-secondary)',
                    '&.Mui-focused': {
                      color: 'var(--accent-primary)',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'var(--text-primary)',
                  },
                }}
              />

              {/* Role Select */}
              <FormControl 
                fullWidth 
                required
                error={!!errors.role}
              >
                <InputLabel
                  sx={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-secondary)',
                    '&.Mui-focused': {
                      color: 'var(--accent-primary)',
                    },
                  }}
                >
                  Your Role in Project
                </InputLabel>
                <Select
                  value={formData.role}
                  label="Your Role in Project"
                  onChange={(e) => handleChange('role', e.target.value)}
                  sx={{
                    fontFamily: 'var(--font-body)',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--border-subtle)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--accent-primary)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--accent-primary)',
                      borderWidth: '2px',
                    },
                    '& .MuiSelect-select': {
                      color: 'var(--text-primary)',
                    },
                  }}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <MenuItem 
                      key={role} 
                      value={role}
                      sx={{
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {role}
                    </MenuItem>
                  ))}
                </Select>
                {errors.role && (
                  <p className="error-text">{errors.role}</p>
                )}
              </FormControl>

              {/* Message Field */}
              <div className="message-field">
                <TextField
                  label="Additional Message (Optional)"
                  placeholder="Tell us about your project..."
                  fullWidth
                  multiline
                  rows={4}
                  value={formData.message}
                  onChange={(e) => handleChange('message', e.target.value)}
                  error={!!errors.message}
                  helperText={errors.message}
                  inputProps={{ maxLength: 500 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      fontFamily: 'var(--font-body)',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      '& fieldset': {
                        borderColor: 'var(--border-subtle)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'var(--accent-primary)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'var(--accent-primary)',
                        borderWidth: '2px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-secondary)',
                      '&.Mui-focused': {
                        color: 'var(--accent-primary)',
                      },
                    },
                    '& .MuiInputBase-input': {
                      color: 'var(--text-primary)',
                    },
                  }}
                />
                <div className="character-counter">
                  {formData.message.length} / 500
                </div>
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="submit-error">
                  {errors.submit}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="submit-button"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          </div>
        </div>
      </main>

      <style jsx>{`
        .page-wrapper {
          min-height: 100vh;
          background: var(--page-background);
          position: relative;
          overflow-x: hidden;
        }

        main {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-xl) var(--space-md);
        }

        .submit-container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }

        .logo-placeholder {
          display: flex;
          justify-content: center;
          margin-bottom: var(--space-xl);
        }

        .header-section {
          text-align: center;
          margin-bottom: var(--space-xl);
        }

        .text-title {
          font-family: var(--font-heading);
          font-size: var(--text-display);
          font-weight: var(--weight-bold);
          color: var(--text-primary);
          margin-bottom: var(--space-sm);
          line-height: var(--line-height-tight);
        }

        .text-body {
          font-family: var(--font-body);
          font-size: var(--text-body);
          color: var(--text-secondary);
          line-height: var(--line-height-normal);
          max-width: 500px;
          margin: 0 auto;
        }

        .form-card {
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-xl);
          box-shadow: var(--shadow-card);
        }

        form {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .message-field {
          position: relative;
        }

        .character-counter {
          font-family: var(--font-body);
          font-size: var(--text-caption);
          color: var(--text-muted);
          text-align: right;
          margin-top: var(--space-xs);
        }

        .error-text {
          font-family: var(--font-body);
          font-size: var(--text-caption);
          color: #EF4444;
          margin-top: var(--space-xxs);
          margin-left: var(--space-sm);
        }

        .submit-error {
          padding: var(--space-sm);
          background: #FEE2E2;
          border: 1px solid #EF4444;
          border-radius: 12px;
          color: #991B1B;
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          text-align: center;
        }

        .submit-button {
          width: 100%;
          background: var(--accent-primary);
          color: white;
          padding: var(--space-sm) var(--space-lg);
          border: none;
          border-radius: var(--radius-control);
          font-family: var(--font-body);
          font-size: var(--text-label);
          font-weight: var(--weight-semibold);
          cursor: pointer;
          box-shadow: var(--shadow-chip);
          transition: all 0.2s ease;
          margin-top: var(--space-md);
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-floating);
        }

        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Responsive Design */
        @media (min-width: 768px) {
          .submit-button {
            width: auto;
            min-width: 200px;
            align-self: flex-end;
          }
        }

        @media (max-width: 768px) {
          main {
            padding: var(--space-lg) var(--space-md);
          }

          .text-title {
            font-size: 32px;
          }

          .form-card {
            padding: var(--space-lg);
          }
        }
      `}</style>
    </div>
  )
}
