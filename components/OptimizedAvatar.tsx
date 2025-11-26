'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Avatar as MuiAvatar, AvatarProps as MuiAvatarProps } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'

interface OptimizedAvatarProps extends Omit<MuiAvatarProps, 'src'> {
  src?: string | null
  alt?: string
  size?: number
}

/**
 * Optimized Avatar component using Next.js Image for lazy loading
 * Falls back to MUI Avatar if no src provided
 */
export function OptimizedAvatar({ 
  src, 
  alt = 'User avatar', 
  size = 48,
  sx,
  children,
  ...props 
}: OptimizedAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  // If no src or error loading, show fallback
  if (!src || imageError) {
    return (
      <MuiAvatar
        sx={{
          width: size,
          height: size,
          bgcolor: '#7C4DFF',
          ...sx
        }}
        {...props}
      >
        {children || <PersonIcon />}
      </MuiAvatar>
    )
  }

  return (
    <MuiAvatar
      sx={{
        width: size,
        height: size,
        bgcolor: imageLoaded ? 'transparent' : '#7C4DFF',
        position: 'relative',
        overflow: 'hidden',
        ...sx
      }}
      {...props}
    >
      {!imageLoaded && (children || <PersonIcon />)}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={`${size}px`}
        style={{
          objectFit: 'cover',
          opacity: imageLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        loading="lazy"
        quality={75}
      />
    </MuiAvatar>
  )
}





