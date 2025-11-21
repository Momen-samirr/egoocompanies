# Production Build Steps - Driver App

## ✅ Fix Applied
The UserHandle serialization error has been fixed by:
1. Removing `expo-device` dependency
2. Patching `expo-modules-core` to handle UserHandle objects gracefully

## Next Steps

### 1. Verify the Patch is Saved
The patch file is located at:
- `patches/expo-modules-core+1.12.19.patch`

This will be automatically applied during `npm install` via the `postinstall` script.

### 2. Create Production Build

```bash
cd driver

# Make sure dependencies are installed with the patch
npm install --legacy-peer-deps

# Build production AAB for Google Play Store
eas build --platform android --profile production
```

This will:
- Create a production app bundle (AAB)
- Upload it to EAS servers
- Provide a download link when complete

### 3. Download and Upload to Google Play Console

1. **Download the AAB** from the EAS build output
2. **Go to Google Play Console**: https://play.google.com/console
3. **Navigate to**: Your App → Production (or Internal Testing)
4. **Create a new release**:
   - Click "Create new release"
   - Upload the new AAB file
   - Add release notes explaining the fix:
     ```
     Bug Fixes:
     - Fixed app crash on subsequent launches
     - Resolved UserHandle serialization error
     ```
5. **Review and publish** the release

### 4. Alternative: Direct Submission via EAS

If you have EAS Submit configured:

```bash
# Build and submit directly to Google Play
eas build --platform android --profile production --auto-submit
```

## Important Notes

- **Version Number**: EAS will auto-increment the version (configured in `eas.json`)
- **Testing**: Make sure to test the production build before releasing to all users
- **Patch Persistence**: The patch will be applied automatically in future builds as long as `patch-package` runs in `postinstall`

## Verification Checklist

Before releasing:
- [ ] App opens successfully on first launch
- [ ] App opens successfully on subsequent launches (no crash)
- [ ] Push notifications work
- [ ] Location services work
- [ ] All core features function correctly
- [ ] Production build created successfully
- [ ] Tested production build on a physical device

