/**
 * Job Attachments - File upload/download helpers for job resources
 * 
 * Allows job posters to attach reference files, briefs, specifications, etc.
 * Files are stored in Supabase Storage and URLs are saved in the jobs table.
 */

import { supabase } from '@/lib/supabase'

const STORAGE_BUCKET = 'job-attachments'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Font files
  'font/ttf',
  'application/x-font-ttf',
  'font/otf',
  'application/x-font-otf',
  'font/woff',
  'application/font-woff',
  'font/woff2',
  'application/font-woff2'
]

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Upload a file to Supabase Storage
 * Returns the public URL of the uploaded file
 */
export async function uploadJobAttachment(
  file: File,
  jobId: string,
  customFilename?: string
): Promise<UploadResult> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`
      }
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        success: false,
        error: 'File type not allowed. Supported: PDF, images, ZIP, Word, Excel, text files, fonts (TTF, OTF, WOFF)'
      }
    }

    // Create unique filename: jobs/{jobId}/{timestamp}-{sanitized-filename}
    const timestamp = Date.now()
    const filenameToUse = customFilename || file.name
    const sanitizedName = filenameToUse.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `jobs/${jobId}/${timestamp}-${sanitizedName}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Upload error:', error)
      return {
        success: false,
        error: error.message || 'Failed to upload file'
      }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    return {
      success: true,
      url: publicUrl
    }
  } catch (error) {
    console.error('Upload exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteJobAttachment(url: string): Promise<boolean> {
  try {
    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/job-attachments/{path}
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(/\/object\/public\/job-attachments\/(.+)$/)
    
    if (!pathMatch) {
      console.error('Could not parse file path from URL:', url)
      return false
    }

    const filePath = pathMatch[1]

    // Delete from storage
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Delete exception:', error)
    return false
  }
}

/**
 * Get filename from URL
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const filename = pathParts[pathParts.length - 1]
    // Remove timestamp prefix if present
    return filename.replace(/^\d+-/, '')
  } catch (error) {
    return 'attachment'
  }
}

/**
 * Get file extension from filename or URL
 */
export function getFileExtension(filenameOrUrl: string): string {
  const name = getFilenameFromUrl(filenameOrUrl)
  const parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Get file icon based on extension
 */
export function getFileIcon(filenameOrUrl: string): string {
  const ext = getFileExtension(filenameOrUrl)
  
  switch (ext) {
    case 'pdf':
      return '📄'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return '🖼️'
    case 'zip':
      return '📦'
    case 'doc':
    case 'docx':
      return '📝'
    case 'xls':
    case 'xlsx':
      return '📊'
    case 'txt':
      return '📃'
    case 'ttf':
    case 'otf':
    case 'woff':
    case 'woff2':
      return '🔤'
    default:
      return '📎'
  }
}

