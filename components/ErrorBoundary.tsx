'use client'

import { useEffect } from 'react'

/**
 * Global error handler for wallet rejections and other unhandled promise rejections
 * 
 * This component catches wallet rejection errors (code 4001) that occur when users
 * click "Cancel" on wallet popups. These errors are expected behavior and should
 * not pollute the console or crash the app.
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      
      // Check if this is a wallet rejection error (code 4001)
      if (error && typeof error === 'object' && 'code' in error && error.code === 4001) {
        // User rejected wallet request - this is expected behavior
        console.debug('Wallet request cancelled by user')
        event.preventDefault() // Prevent the error from showing in console
        return
      }
      
      // Check for other common wallet rejection patterns
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message).toLowerCase()
        if (
          message.includes('user rejected') ||
          message.includes('user denied') ||
          message.includes('user cancelled') ||
          message.includes('user canceled')
        ) {
          console.debug('Wallet request cancelled by user')
          event.preventDefault()
          return
        }
      }
      
      // For other errors, log them normally
      console.error('Unhandled promise rejection:', error)
    }
    
    // Add the event listener
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])
  
  return null // This component doesn't render anything
}



