# Asset Verification Guide for Google Play Store

## Overview

This document outlines the asset requirements for publishing egoo to Google Play Store.

## App Icons

### Requirements

1. **App Icon (icon.png)**
   - **Location**: `assets/icon.png`
   - **Recommended Size**: 1024x1024 pixels
   - **Minimum Size**: 512x512 pixels
   - **Format**: PNG with transparency support
   - **Design Guidelines**:
     - Square format
     - Important content should be centered
     - Leave padding around edges (safe zone)
     - No text unless it's part of the logo
     - High contrast for visibility

2. **Adaptive Icon (adaptive-icon.png)**
   - **Location**: `assets/adaptive-icon.png`
   - **Recommended Size**: 1024x1024 pixels (foreground)
   - **Format**: PNG
   - **Background Color**: Defined in `app.json` (currently: #ffffff)
   - **Design Guidelines**:
     - Foreground image should be centered
     - Background color provides the base layer
     - Icon will be masked/cropped by Android
     - Important elements should be in the center 66% (safe zone)
     - No transparency in foreground (background color shows through)

### Current Configuration

From `app.json`:
```json
"icon": "./assets/icon.png",
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  }
}
```

## Splash Screen

### Requirements

1. **Splash Screen (splash.png)**
   - **Location**: `assets/splash.png`
   - **Recommended Size**: 1242x2688 pixels (for all devices) or 1920x1080 pixels
   - **Format**: PNG
   - **Design Guidelines**:
     - Should match app branding
     - Include logo or app name
     - Simple and clean design
     - Fast loading

### Current Configuration

From `app.json`:
```json
"splash": {
  "image": "./assets/splash.png",
  "resizeMode": "contain",
  "backgroundColor": "#ffffff"
}
```

## Google Play Store Listing Assets

These assets are required for your Google Play Store listing (not part of the app bundle):

### 1. High-Res Icon
- **Size**: 512x512 pixels
- **Format**: PNG (32-bit with alpha channel)
- **Usage**: Displayed in Google Play Store
- **Note**: Can be the same as `icon.png` if it's 512x512 or larger

### 2. Feature Graphic
- **Size**: 1024x500 pixels
- **Format**: PNG or JPG
- **Usage**: Banner displayed at the top of your app listing
- **Requirements**:
  - Text is allowed but should be minimal
  - Should represent your app's branding
  - No phone mockups or frames

### 3. Screenshots
- **Minimum**: 2 screenshots
- **Maximum**: 8 screenshots per device type
- **Sizes** (choose based on target devices):
  - Phone: 16:9 or 9:16 aspect ratio (e.g., 1080x1920 or 1920x1080)
  - Tablet (7"): 1024x600 minimum
  - Tablet (10"): 1280x800 minimum
- **Format**: PNG or JPG
- **Requirements**:
  - Must be actual app screenshots
  - Can include text overlays or captions
  - Should showcase key features

### 4. App Video (Optional)
- **Format**: YouTube link or MP4 file
- **Duration**: Up to 2 minutes
- **Usage**: Shown at the top of your app listing

## Verification Checklist

### App Bundle Assets (in app)
- [ ] `icon.png` exists and is at least 512x512 pixels (1024x1024 recommended)
- [ ] `adaptive-icon.png` exists and is properly sized
- [ ] `splash.png` exists and displays correctly
- [ ] Icons are high quality and properly designed
- [ ] Adaptive icon background color is appropriate
- [ ] No text in icons (unless part of logo)
- [ ] Icons are properly centered

### Store Listing Assets (for Play Console)
- [ ] High-res icon (512x512) prepared
- [ ] Feature graphic (1024x500) created
- [ ] At least 2 screenshots captured
- [ ] Screenshots showcase key features
- [ ] All assets are in correct format and size

## Testing Your Assets

1. **Preview Icons**:
   - Use Android Studio's Asset Studio to preview adaptive icons
   - Test on different device types and Android versions

2. **Preview Splash Screen**:
   - Test on actual devices
   - Ensure it displays correctly on various screen sizes

3. **Validate Store Assets**:
   - Use Google Play Console's preview feature
   - Check how assets appear on different devices

## Common Issues and Fixes

### Icon Issues
- **Problem**: Icon appears blurry
  - **Solution**: Ensure icon is at least 1024x1024 pixels and properly exported
  
- **Problem**: Adaptive icon doesn't display correctly
  - **Solution**: Ensure important content is in center 66% safe zone, check background color

### Splash Screen Issues
- **Problem**: Splash screen doesn't fill screen
  - **Solution**: Check `resizeMode` in app.json (currently "contain")

## Asset Generation Tools

1. **Android Asset Studio** (online)
   - https://romannurik.github.io/AndroidAssetStudio/
   - Generates all required icon sizes

2. **Icon Generator Tools**:
   - Various online tools available
   - Ensure output meets size requirements

3. **Screenshot Tools**:
   - Android Studio Emulator
   - Physical device screenshots
   - Third-party tools

## Next Steps

1. **Verify Current Assets**:
   ```bash
   # Check if files exist
   ls -lh assets/icon.png assets/adaptive-icon.png assets/splash.png
   
   # If ImageMagick is installed, check dimensions
   identify assets/*.png
   ```

2. **Prepare Store Listing Assets**:
   - Create feature graphic (1024x500)
   - Capture screenshots from app
   - Prepare high-res icon (512x512) if different from app icon

3. **Test on Devices**:
   - Install app on physical devices
   - Verify icons and splash screen display correctly
   - Take screenshots for store listing

## Important Notes

- **App icons** are packaged with the app and distributed to users
- **Store listing assets** are only shown in Google Play Store, not in the app
- Assets should be optimized for size while maintaining quality
- Use consistent branding across all assets
- Follow Google's Material Design guidelines where applicable

