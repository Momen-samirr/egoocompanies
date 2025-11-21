# Release Keystore Setup Guide

## Overview

To publish the egoo app to Google Play Store, you need a release keystore to sign your app. This document explains how to set up and manage the release keystore.

## Option 1: EAS Build (Recommended)

If you're using EAS Build (Expo Application Services), EAS can automatically manage your keystore:

1. **First-time setup**: When you run `eas build --platform android --profile production`, EAS will generate a keystore for you if one doesn't exist.

2. **Existing keystore**: If you already have a keystore, you can upload it to EAS:
   ```bash
   eas credentials
   ```

3. **Benefits**:
   - EAS securely stores your keystore
   - Automatic signing for all builds
   - No need to manage keystore files locally

## Option 2: Local Keystore (For Local Builds)

If you need to build release APKs/AABs locally:

### Step 1: Generate the Keystore

Run the provided script:
```bash
cd android/app
./generate-release-keystore.sh
```

Or manually generate using keytool:
```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore release.keystore \
  -alias egoo-release-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 36500 \
  -storepass <your-keystore-password> \
  -keypass <your-key-password> \
  -dname "CN=egoo, OU=Mobile, O=Becodemy, L=City, ST=State, C=US"
```

### Step 2: Configure Keystore Properties

1. Copy the example file:
   ```bash
   cp android/app/keystore.properties.example android/app/keystore.properties
   ```

2. Edit `keystore.properties` and fill in your keystore information:
   ```properties
   MYAPP_RELEASE_STORE_FILE=../release.keystore
   MYAPP_RELEASE_KEY_ALIAS=egoo-release-key
   MYAPP_RELEASE_STORE_PASSWORD=your-keystore-password
   MYAPP_RELEASE_KEY_PASSWORD=your-key-password
   ```

### Step 3: Build Release APK/AAB

```bash
cd android
./gradlew assembleRelease  # For APK
./gradlew bundleRelease    # For AAB (recommended for Play Store)
```

## Security Best Practices

1. **Never commit keystore files or passwords to version control**
   - `release.keystore` is in `.gitignore`
   - `keystore.properties` is in `.gitignore`
   - Only commit `keystore.properties.example`

2. **Backup your keystore securely**
   - Store in a secure password manager
   - Keep multiple backups in different secure locations
   - Document the keystore password and key alias

3. **Keep keystore information secure**
   - Never share keystore files or passwords
   - Use environment variables for CI/CD pipelines
   - For EAS builds, let EAS manage the keystore

## Important Notes

- **You cannot change the keystore after publishing to Google Play Store**
- If you lose your keystore, you won't be able to update your app
- The keystore is tied to your app's package name (`com.becodemy.ridewavedriver`)
- EAS Build is the recommended approach for most use cases

## Troubleshooting

### Build fails with "Keystore file not found"
- Ensure `keystore.properties` exists in `android/app/`
- Check that the `MYAPP_RELEASE_STORE_FILE` path is correct
- Verify the keystore file exists at the specified path

### Build fails with "Keystore was tampered with, or password was incorrect"
- Double-check your passwords in `keystore.properties`
- Ensure there are no extra spaces or characters
- Verify the key alias matches exactly

### For EAS Builds
- Use `eas credentials` to view and manage your keystore
- EAS automatically handles signing, so no local configuration needed

