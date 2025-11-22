# Vercel Deployment Guide

This guide will help you deploy the RideWave Admin Dashboard to Vercel.

## Quick Start

### 1. Prepare Your Repository

Make sure your code is pushed to GitHub, GitLab, or Bitbucket.

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New..." → "Project"
3. Import your repository
4. Vercel will auto-detect Next.js

### 3. Configure Environment Variables

In the Vercel project settings, add these environment variables:

#### Required Variables

```
NEXT_PUBLIC_API_URL=https://your-backend-server.com/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-server.com
```

#### Example Values

**For Production:**
```
NEXT_PUBLIC_API_URL=https://api.yourapp.com/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q
NEXT_PUBLIC_WEBSOCKET_URL=wss://ws.yourapp.com
```

**Important Notes:**
- Use `https://` (not `http://`) for API URLs in production
- Use `wss://` (not `ws://`) for WebSocket URLs in production (secure WebSocket)
- All `NEXT_PUBLIC_*` variables are exposed to the browser

### 4. Deploy

1. Click "Deploy"
2. Wait for the build to complete
3. Your dashboard will be live at `https://your-project.vercel.app`

## Environment Variables Setup

### In Vercel Dashboard

1. Go to your project → Settings → Environment Variables
2. Add each variable for:
   - **Production**: Your production environment
   - **Preview**: For preview deployments (optional)
   - **Development**: For local development (optional)

### Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
vercel env add NEXT_PUBLIC_WEBSOCKET_URL
```

## Backend Server Configuration

### CORS Setup

Your backend server must allow requests from your Vercel domain. Add your Vercel URL to CORS allowed origins:

```javascript
// Example Express CORS configuration
const cors = require('cors');
app.use(cors({
  origin: [
    'https://your-project.vercel.app',
    'https://your-custom-domain.com'
  ],
  credentials: true
}));
```

### WebSocket Server

For production, your WebSocket server should:
1. Use `wss://` (secure WebSocket) instead of `ws://`
2. Have a valid SSL certificate
3. Allow connections from your Vercel domain

## Custom Domain (Optional)

1. Go to your project → Settings → Domains
2. Add your custom domain
3. Follow Vercel's DNS configuration instructions
4. Update your environment variables if needed

## Troubleshooting

### Build Fails

- Check that all environment variables are set
- Verify your `package.json` has correct build scripts
- Check Vercel build logs for specific errors

### API Requests Fail

- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS configuration on your backend
- Ensure backend server is accessible from the internet

### Map Not Loading

- Verify `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set correctly
- Check Google Cloud Console for API key restrictions
- Ensure Maps JavaScript API is enabled in Google Cloud

### WebSocket Not Connecting

- Verify `NEXT_PUBLIC_WEBSOCKET_URL` uses `wss://` in production
- Check WebSocket server is accessible from the internet
- Verify WebSocket server allows connections from Vercel domain

## Continuous Deployment

Vercel automatically deploys:
- **Production**: On push to main/master branch
- **Preview**: On push to other branches or pull requests

You can disable auto-deployment in project settings if needed.

## Monitoring

- View deployment logs in Vercel dashboard
- Check function logs for serverless function issues
- Monitor analytics in Vercel dashboard

## Support

For issues:
1. Check Vercel build logs
2. Check browser console for client-side errors
3. Verify all environment variables are set correctly
4. Check backend server logs

