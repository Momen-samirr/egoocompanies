# Google Maps API Key Configuration for Vercel Deployment

## Overview
To ensure your Google Maps API key works with your Vercel deployment at `https://dashapp.egoobus.com`, you need to configure domain restrictions in Google Cloud Console.

## Steps to Configure

### 1. Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one if you haven't)
3. Navigate to **APIs & Services** → **Credentials**

### 2. Find Your API Key
1. Locate your API key: `AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q`
2. Click on the API key to edit it

### 3. Configure Application Restrictions

#### Option A: HTTP Referrer Restrictions (Recommended for Web Apps)
1. Under **Application restrictions**, select **HTTP referrers (web sites)**
2. Click **Add an item** and add the following referrers:
   ```
   https://dashapp.egoobus.com/*
   https://*.egoobus.com/*
   http://localhost:3000/*
   http://localhost:3001/*
   ```
3. Click **Save**

#### Option B: IP Address Restrictions (If you have a static IP)
- Not recommended for Vercel as IPs can change
- Only use if you have a static IP for your backend

### 4. Configure API Restrictions
1. Under **API restrictions**, select **Restrict key**
2. Make sure these APIs are enabled:
   - ✅ Maps JavaScript API
   - ✅ Places API (if used)
   - ✅ Geocoding API (if used)
   - ✅ Directions API (if used)
   - ✅ Distance Matrix API (if used)
3. Click **Save**

### 5. Verify API is Enabled
1. Go to **APIs & Services** → **Library**
2. Search for and ensure these APIs are **ENABLED**:
   - Maps JavaScript API
   - Any other Maps-related APIs you're using

## Testing

After configuration:
1. Wait a few minutes for changes to propagate
2. Visit `https://dashapp.egoobus.com`
3. Check browser console for any API key errors
4. Verify maps are loading correctly

## Troubleshooting

### Error: "This API key is not authorized"
- Check that the domain is correctly added in HTTP referrers
- Ensure there are no typos in the domain
- Wait a few minutes for changes to propagate

### Error: "RefererNotAllowedMapError"
- Verify the referrer pattern matches your domain exactly
- Check that you're using `https://` (not `http://`) for production
- Ensure wildcards are used correctly (`*` at the end)

### Maps Not Loading
- Check browser console for specific error messages
- Verify the API key is correct in your Vercel environment variables
- Ensure Maps JavaScript API is enabled in Google Cloud Console

## Security Best Practices

1. **Use HTTP Referrer Restrictions**: This is the most secure option for web applications
2. **Don't Use IP Restrictions**: Vercel uses dynamic IPs, so IP restrictions won't work
3. **Limit API Access**: Only enable the APIs you actually use
4. **Monitor Usage**: Regularly check API usage in Google Cloud Console to detect abuse
5. **Rotate Keys**: Consider rotating your API key periodically

## Current Configuration

Your API key: `AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q`

**Required Referrers:**
- `https://dashapp.egoobus.com/*`
- `http://localhost:3000/*` (for local development)
- `http://localhost:3001/*` (for local development)

## Additional Notes

- Changes to API key restrictions can take up to 5 minutes to propagate
- You can test locally using `http://localhost:3000` before deploying
- If you add more Vercel preview deployments, add their domains to the referrer list

