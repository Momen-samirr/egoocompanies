# Privacy Policy Requirements for Google Play Store

## Overview

Google Play Store **requires** a privacy policy URL for apps that:
- Collect user location data
- Request sensitive permissions
- Handle user data

Since egoo collects location data for ride matching and navigation, you **must** provide a privacy policy URL.

## Current Configuration

In `app.json`, the privacy policy URL is set to:
```
"privacy": "https://your-domain.com/privacy-policy"
```

**⚠️ ACTION REQUIRED:** Replace this placeholder with your actual privacy policy URL before publishing to Google Play Store.

## Privacy Policy Content Requirements

Your privacy policy must cover:

### 1. Data Collection
- What data is collected (location, user information, device information)
- How data is collected (via app permissions, user input, etc.)

### 2. Location Data
- **Required:** Explain why location data is collected (ride matching, navigation)
- How location data is used
- When location data is collected (always, during active use, etc.)
- Third-party services that may access location data (Google Maps)

### 3. User Data Handling
- How user data is stored
- Data retention policies
- User rights (access, deletion, etc.)

### 4. Third-Party Services
Your privacy policy should mention:
- **Google Maps Platform** - Used for mapping and navigation
- **Firebase** - Used for push notifications and analytics
- Any other third-party SDKs or services

### 5. Security
- How data is protected
- Security measures in place

### 6. Contact Information
- How users can contact you about privacy concerns
- Email or contact form

## Sample Privacy Policy Structure

Here's a basic structure you can use:

```
1. Introduction
   - App name (egoo)
   - Last updated date

2. Information We Collect
   - Location data (required for ride matching)
   - User account information
   - Device information
   - Usage data

3. How We Use Your Information
   - To provide ride matching services
   - To improve app functionality
   - For navigation and routing

4. Third-Party Services
   - Google Maps Platform
   - Firebase (notifications, analytics)

5. Data Storage and Security
   - Where data is stored
   - Security measures

6. Your Rights
   - Access your data
   - Delete your data
   - Opt-out options

7. Children's Privacy
   - Age restrictions (if applicable)

8. Changes to Privacy Policy
   - How users will be notified

9. Contact Us
   - Email address or contact form
```

## Where to Host Your Privacy Policy

Options:
1. **Your website** - `https://your-domain.com/privacy-policy`
2. **GitHub Pages** - Free hosting for static pages
3. **Privacy policy generators** - Various online tools available
4. **Google Sites** - Free option for hosting

## Updating app.json

Once you have your privacy policy URL, update `app.json`:

```json
"android": {
  ...
  "privacy": "https://your-actual-domain.com/privacy-policy"
}
```

## Google Play Console Requirements

When submitting to Google Play Console:
1. Navigate to **App content** → **Privacy policy**
2. Enter your privacy policy URL
3. Ensure the URL is publicly accessible
4. The URL must use HTTPS (required by Google Play)

## Important Notes

- The privacy policy must be accessible **before** you submit your app
- Google Play will reject apps without a valid privacy policy if they collect location data
- Your privacy policy should be comprehensive and accurate
- Keep your privacy policy updated as you add features or change data collection practices
- Consider having a lawyer review your privacy policy, especially if you handle sensitive data

## Checklist

- [ ] Privacy policy URL created and accessible
- [ ] Privacy policy covers all data collection (especially location)
- [ ] Privacy policy mentions third-party services (Google Maps, Firebase)
- [ ] Privacy policy includes contact information
- [ ] Privacy policy URL updated in `app.json`
- [ ] Privacy policy URL is HTTPS
- [ ] Privacy policy is publicly accessible (no authentication required)

