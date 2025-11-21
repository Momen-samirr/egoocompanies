# Google Play Store Submission Checklist for egoo

This comprehensive checklist ensures your egoo app is fully prepared for Google Play Store submission.

## Pre-Build Configuration

### ✅ App Configuration
- [x] **App Name**: Updated to "egoo" in `app.json`
- [x] **Package Name**: `com.becodemy.ridewavedriver` (valid and consistent)
- [x] **Version**: 1.0.0 (synced between app.json and build.gradle)
- [x] **App Slug**: "egoo" (no hyphens)
- [x] **Scheme**: "egoo" (updated)

### ✅ Build Configuration
- [x] **Release Signing**: Production keystore configuration added
- [x] **Version Management**: EAS autoIncrement enabled, synced with app.json
- [x] **Build Type**: AAB (Android App Bundle) configured for production
- [x] **EAS Configuration**: Production profile configured for app-bundle

### ✅ Permissions
- [x] **POST_NOTIFICATIONS**: Added for Android 13+ support
- [x] **Location Permissions**: ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION configured
- [x] **Deprecated Permissions**: Removed WRITE_EXTERNAL_STORAGE and READ_EXTERNAL_STORAGE
- [x] **Duplicate Permissions**: Cleaned up in app.json

### ⚠️ Privacy Policy
- [ ] **Privacy Policy URL**: ⚠️ **ACTION REQUIRED** - Update placeholder in `app.json`
  - Current: `"privacy": "https://your-domain.com/privacy-policy"`
  - Replace with your actual privacy policy URL
  - Must be publicly accessible via HTTPS
  - See `PRIVACY_POLICY_REQUIREMENTS.md` for details

### ✅ Assets
- [x] **App Icon**: 1024x1024 pixels ✓ (verified)
- [x] **Adaptive Icon**: 1024x1024 pixels ✓ (verified)
- [x] **Splash Screen**: 1284x2778 pixels ✓ (verified)
- [ ] **High-Res Icon for Store**: 512x512 pixels (prepare from app icon)
- [ ] **Feature Graphic**: 1024x500 pixels (create for store listing)
- [ ] **Screenshots**: At least 2, up to 8 (capture from app)

## Build Process

### Production Build
- [ ] **EAS Build**: Run `eas build --platform android --profile production`
- [ ] **Build Success**: Verify build completes without errors
- [ ] **Build Type**: Confirm AAB (Android App Bundle) is generated
- [ ] **Signing**: Verify release keystore is used (EAS manages this automatically)
- [ ] **Version Code**: Confirm autoIncrement is working (check build output)
- [ ] **Download Build**: Download the AAB file from EAS

### Local Build (Optional)
- [ ] **Keystore Setup**: If building locally, configure `keystore.properties`
- [ ] **Release Build**: Run `./gradlew bundleRelease` (generates AAB)
- [ ] **Verify Signing**: Confirm release keystore is used

## Testing

### Device Testing
- [ ] **Install AAB**: Install on physical Android device(s)
- [ ] **Android 10+**: Test on Android 10, 11, 12, 13+
- [ ] **Different Devices**: Test on various screen sizes and manufacturers
- [ ] **App Launch**: Verify app launches correctly
- [ ] **Permissions**: Test permission requests (location, notifications)
- [ ] **Core Features**: Test ride matching, navigation, notifications
- [ ] **UI/UX**: Verify UI displays correctly on all tested devices
- [ ] **No Crashes**: Ensure no crashes during testing

### Functional Testing
- [ ] **Location Services**: Verify location tracking works
- [ ] **Notifications**: Verify push notifications work (Firebase)
- [ ] **Google Maps**: Verify maps and navigation work
- [ ] **WebSocket**: Verify real-time communication works
- [ ] **Authentication**: Verify login/signup flows work
- [ ] **Core Features**: Test all main app features

## Google Play Console Setup

### App Listing
- [ ] **Create App**: Create new app in Google Play Console
- [ ] **Package Name**: Use `com.becodemy.ridewavedriver`
- [ ] **Default Language**: Select primary language
- [ ] **App Name**: "egoo" (or display name as preferred)
- [ ] **App Type**: Select "App" (not game)
- [ ] **Free/Paid**: Select free or paid

### Store Listing Information
- [ ] **App Title**: "egoo" (30 characters max)
- [ ] **Short Description**: 80 characters max (compelling one-liner)
- [ ] **Full Description**: Up to 4,000 characters
  - Describe app features
  - Highlight key benefits
  - Include app category (Transportation/Driver)
- [ ] **App Icon**: Upload 512x512 high-res icon
- [ ] **Feature Graphic**: Upload 1024x500 banner
- [ ] **Screenshots**: Upload at least 2 screenshots
  - Phone screenshots (required)
  - Tablet screenshots (optional)
- [ ] **App Category**: Select "Maps & Navigation" or "Travel & Local"
- [ ] **Tags**: Add relevant keywords

### App Content
- [ ] **Privacy Policy**: Enter privacy policy URL (update in app.json first)
- [ ] **Content Rating**: Complete questionnaire
  - Category: Transportation/Navigation
  - Likely rating: Everyone or Teen
- [ ] **Target Audience**: Specify target audience (professional drivers)
- [ ] **Data Safety**: Complete data safety section
  - Declare data collection (location, user data)
  - Explain data usage
  - List third-party services (Google Maps, Firebase)

### Pricing & Distribution
- [ ] **Pricing**: Set app as free or paid
- [ ] **Countries**: Select countries for distribution
- [ ] **Age Restrictions**: Set if applicable

### Release Management
- [ ] **Create Release**: Create production release
- [ ] **Upload AAB**: Upload the production AAB file
- [ ] **Release Notes**: Write release notes for version 1.0.0
  - Initial release
  - Key features
  - Improvements

## Pre-Submission Checks

### Technical Requirements
- [ ] **Target API Level**: App targets latest required API (API 30+)
- [ ] **64-bit Support**: App supports 64-bit architectures (Expo handles this)
- [ ] **AAB Format**: Using Android App Bundle (not APK)
- [ ] **App Size**: Check app size is reasonable
- [ ] **Permissions**: All permissions are justified

### Policy Compliance
- [ ] **Google Play Policies**: Review and ensure compliance
- [ ] **Content Policies**: Ensure no prohibited content
- [ ] **Location Data**: Privacy policy explains location usage
- [ ] **User Data**: Privacy policy explains data handling
- [ ] **Third-Party Services**: Privacy policy mentions Google Maps, Firebase

### Final Verification
- [ ] **Store Listing**: All required fields completed
- [ ] **Graphics**: All required graphics uploaded
- [ ] **Privacy Policy**: URL is accessible and comprehensive
- [ ] **Permissions**: Justified in Play Console
- [ ] **Content Rating**: Completed and appropriate
- [ ] **Release Notes**: Written and clear

## Submission Process

### Internal Testing (Recommended First Step)
- [ ] **Create Internal Testing Track**: Set up internal testing in Play Console
- [ ] **Upload AAB**: Upload to internal testing track first
- [ ] **Add Testers**: Add internal testers (email addresses)
- [ ] **Test Link**: Share test link with testers
- [ ] **Feedback**: Collect feedback and fix issues
- [ ] **Iterate**: Make improvements based on feedback

### Alpha/Beta Testing (Optional)
- [ ] **Create Alpha Track**: Set up alpha testing
- [ ] **Upload Build**: Upload AAB to alpha track
- [ ] **Test Group**: Invite testers to alpha group
- [ ] **Monitor**: Monitor crashes and feedback

### Production Release
- [ ] **Create Production Release**: Set up production release
- [ ] **Upload AAB**: Upload production AAB
- [ ] **Review Release**: Double-check release notes and version
- [ ] **Submit for Review**: Submit app for Google Play review
- [ ] **Monitor Status**: Check review status in Play Console

## Post-Submission

### Review Process
- [ ] **Review Timeline**: Google typically reviews within 1-7 days
- [ ] **Respond to Issues**: If rejected, address issues promptly
- [ ] **Resubmit**: Fix issues and resubmit if needed

### After Approval
- [ ] **App Live**: Verify app is live in Play Store
- [ ] **Monitor**: Monitor downloads, ratings, reviews
- [ ] **Support**: Respond to user reviews and feedback
- [ ] **Updates**: Plan for future updates

## Important Files and Documentation

### Configuration Files
- `app.json` - Main app configuration
- `eas.json` - EAS build configuration
- `android/app/build.gradle` - Android build configuration
- `android/app/src/main/AndroidManifest.xml` - Android manifest

### Documentation
- `KEYSTORE_SETUP.md` - Keystore management guide
- `PRIVACY_POLICY_REQUIREMENTS.md` - Privacy policy guide
- `ASSET_VERIFICATION.md` - Asset requirements guide
- `GOOGLE_PLAY_SUBMISSION_CHECKLIST.md` - This checklist

## Quick Reference Commands

### EAS Build
```bash
# Production build
eas build --platform android --profile production

# Check build status
eas build:list

# Download build
eas build:download
```

### Local Build (if configured)
```bash
cd android
./gradlew bundleRelease
```

### Testing
```bash
# Install on device
adb install path/to/app.aab

# Or use EAS build download and install
```

## Critical Reminders

1. **Privacy Policy**: ⚠️ **MUST UPDATE** before submission - Replace placeholder URL in `app.json`
2. **Store Assets**: Prepare screenshots, feature graphic, and high-res icon
3. **Testing**: Test thoroughly on multiple devices and Android versions
4. **Keystore**: Keep keystore secure - you cannot update app without it
5. **Version Code**: EAS will auto-increment, but verify it's working correctly

## Support Resources

- **EAS Documentation**: https://docs.expo.dev/build/introduction/
- **Google Play Console**: https://play.google.com/console
- **Google Play Policies**: https://play.google.com/about/developer-content-policy/
- **Android App Bundle Guide**: https://developer.android.com/guide/app-bundle

---

**Last Updated**: Based on current app configuration
**App Name**: egoo
**Package**: com.becodemy.ridewavedriver
**Version**: 1.0.0

