// API endpoint for incrementing view count
// Bypasses Firestore rules by using server-side Firebase Admin

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// Initialize Firebase Admin
const initFirebaseAdmin = () => {
  if (getApps().length === 0) {
    try {
      // Try to use environment variable first
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        initializeApp({
          credential: cert(serviceAccount)
        })
      } else if (process.env.FIREBASE_PROJECT_ID) {
        // Use application default credentials with project ID
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        })
      } else {
        // Fallback for local development
        initializeApp()
      }
    } catch (error) {
      console.error('Firebase Admin init error:', error)
      return null
    }
  }
  return getFirestore()
}

// Simple in-memory rate limiting
const viewTracker = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_VIEWS_PER_WINDOW = 5 // Max 5 views per minute per IP per tab

function checkRateLimit(ip, tabId) {
  const key = `${ip}:${tabId}`
  const now = Date.now()
  const record = viewTracker.get(key)
  
  if (!record) {
    viewTracker.set(key, { count: 1, timestamp: now })
    return true
  }
  
  // Reset if window expired
  if (now - record.timestamp > RATE_LIMIT_WINDOW) {
    viewTracker.set(key, { count: 1, timestamp: now })
    return true
  }
  
  // Check limit
  if (record.count >= MAX_VIEWS_PER_WINDOW) {
    return false
  }
  
  record.count++
  return true
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of viewTracker.entries()) {
    if (now - record.timestamp > RATE_LIMIT_WINDOW * 2) {
      viewTracker.delete(key)
    }
  }
}, 60000) // Clean up every minute

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { tabId } = req.body
  
  if (!tabId) {
    return res.status(400).json({ error: 'Missing tabId' })
  }

  try {
    // Get client IP
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.socket.remoteAddress || 
               'unknown'
    
    // Check rate limit
    if (!checkRateLimit(ip, tabId)) {
      return res.status(429).json({ 
        error: 'Rate limited',
        message: 'Too many views from this IP'
      })
    }

    // Initialize Firebase Admin
    const db = initFirebaseAdmin()
    if (!db) {
      return res.status(500).json({ error: 'Firebase not initialized' })
    }

    // Increment view count
    const tabRef = db.collection('tabs').doc(tabId)
    await tabRef.update({
      viewCount: FieldValue.increment(1)
    })

    return res.status(200).json({ 
      success: true,
      message: 'View recorded'
    })

  } catch (error) {
    console.error('Error incrementing view:', error)
    
    // If document doesn't exist, return 404
    if (error.code === 'not-found') {
      return res.status(404).json({ error: 'Tab not found' })
    }
    
    return res.status(500).json({ 
      error: 'Failed to record view',
      details: error.message 
    })
  }
}
