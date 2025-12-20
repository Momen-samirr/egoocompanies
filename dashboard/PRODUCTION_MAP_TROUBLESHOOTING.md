# Google Maps Not Showing in Production - Troubleshooting Guide

## Problem

Maps work fine in localhost but don't show up in production (dashapp.egoobus.com).

## Most Common Causes

### 1. Environment Variable Not Set in Vercel (MOST LIKELY)

**Problem:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is not set in Vercel environment variables.

**Solution:**

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the variable:
   - **Name:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - **Value:** `AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q`
   - **Environment:** Select **Production** (and Preview if needed)
4. **Redeploy** your application after adding the variable

**How to Check:**

- Open browser console on production site
- Look for error message: "Google Maps API Key is missing"
- Or check the detailed error message in the UI

---

### 2. API Key Domain Restrictions

**Problem:** The API key in Google Cloud Console is restricted to localhost only.

**Solution:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your API key: `AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q`
4. Under **Application restrictions**, select **HTTP referrers (web sites)**
5. Make sure these referrers are added:
   ```
   https://dashapp.egoobus.com/*
   https://*.egoobus.com/*
   http://localhost:3000/*
   http://localhost:3001/*
   ```
6. Click **Save**
7. Wait 2-5 minutes for changes to propagate

**How to Check:**

- Error message will show: "RefererNotAllowedMapError" or "This API key is not authorized"
- Check browser console for specific error messages

---

### 3. Maps JavaScript API Not Enabled

**Problem:** The Maps JavaScript API is not enabled in Google Cloud Console.

**Solution:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Library**
3. Search for "Maps JavaScript API"
4. Click on it and ensure it's **ENABLED**
5. If not enabled, click **Enable**

---

### 4. API Key Quota/Billing Issues

**Problem:** API key has exceeded quota or billing is not enabled.

**Solution:**

1. Go to Google Cloud Console → **Billing**
2. Ensure billing is enabled for your project
3. Check **APIs & Services** → **Dashboard** for quota errors
4. Verify no quota limits have been exceeded

---

## Step-by-Step Debugging

### Step 1: Check Browser Console

1. Open production site: https://dashapp.egoobus.com
2. Open browser DevTools (F12)
3. Go to **Console** tab
4. Look for error messages related to Google Maps
5. The improved error handling will show specific error messages

### Step 2: Verify Environment Variable

1. In production site, check if the error says "API Key is missing"
2. If yes, go to Vercel and add the environment variable
3. Redeploy after adding

### Step 3: Check API Key Restrictions

1. Open browser console
2. Look for "RefererNotAllowedMapError" or "This API key is not authorized"
3. If found, check Google Cloud Console restrictions
4. Ensure production domain is in the allowed referrers list

### Step 4: Verify API is Enabled

1. Go to Google Cloud Console → **APIs & Services** → **Library**
2. Search for "Maps JavaScript API"
3. Verify it shows as **ENABLED**

---

## Quick Fix Checklist

- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in Vercel environment variables
- [ ] Environment variable is set for **Production** environment
- [ ] Application has been **redeployed** after adding environment variable
- [ ] Production domain `https://dashapp.egoobus.com/*` is in Google Cloud Console HTTP referrer restrictions
- [ ] Maps JavaScript API is enabled in Google Cloud Console
- [ ] Billing is enabled in Google Cloud Console
- [ ] Waited 2-5 minutes after making changes (for propagation)

---

## Error Messages Reference

### "Google Maps API Key is missing"

**Cause:** Environment variable not set in Vercel  
**Fix:** Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Vercel and redeploy

### "RefererNotAllowedMapError"

**Cause:** Domain not in API key restrictions  
**Fix:** Add production domain to HTTP referrer restrictions in Google Cloud Console

### "This API key is not authorized"

**Cause:** API not enabled or wrong API key  
**Fix:** Enable Maps JavaScript API and verify API key is correct

### Maps show as grey/blank

**Cause:** API key issue or API not enabled  
**Fix:** Follow all steps above

---

## After Making Changes

1. **Always redeploy** in Vercel after adding/changing environment variables
2. **Wait 2-5 minutes** after changing Google Cloud Console settings
3. **Clear browser cache** or use incognito mode to test
4. **Check browser console** for updated error messages

---

## Need More Help?

If issues persist after following all steps:

1. Check browser console for the exact error message
2. Verify the error message shown in the improved UI
3. Check Vercel deployment logs
4. Verify API key in Google Cloud Console matches the one in Vercel
