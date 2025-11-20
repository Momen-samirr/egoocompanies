# Device Configuration Guide

This project is configured to use specific Android devices for the user and driver apps.

## Configured Devices

- **User App Device**: `ede976ad` (tapas_global - 23021RAAEG)
- **Driver App Device**: `aed407cf` (RMX5051 - RE6079L1)

## Usage

### Running on Specific Devices

#### For User App (RideWave)
```bash
cd user
npm run android:device
```

This will build and install the app on device `ede976ad`.

#### For Driver App (Ridewave-Driver)
```bash
cd driver
npm run android:device
```

This will build and install the app on device `aed407cf`.

### Alternative: Using ADB Directly

If you prefer to use ADB commands directly:

#### List all connected devices:
```bash
adb devices
```

#### Set default device for user app:
```bash
export ANDROID_SERIAL=ede976ad
cd user
npm run android
```

#### Set default device for driver app:
```bash
export ANDROID_SERIAL=aed407cf
cd driver
npm run android
```

### Running Both Apps Simultaneously

You can run both apps on their respective devices by opening two terminal windows:

**Terminal 1 (User App):**
```bash
cd user
npm run android:device
```

**Terminal 2 (Driver App):**
```bash
cd driver
npm run android:device
```

### Verifying Device Connection

Before running the apps, make sure your devices are connected and recognized:

```bash
adb devices
```

You should see both devices listed with status "device":
```
List of devices attached
aed407cf    device
ede976ad    device
```

**Note**: The scripts build the APK using Gradle and then use `adb -s <device-id>` to install it directly on the specified device. This ensures the correct device is always targeted, even when multiple devices are connected.

**Note**: If a device shows as "unauthorized", you need to:
1. Check the device screen for a USB debugging authorization prompt
2. Tap "Allow" or "OK" to authorize the computer
3. Run `adb devices` again to verify it now shows as "device"

### Starting Metro Bundler

After installing the app, you'll need to start Metro bundler separately:

**For User App:**
```bash
cd user
npm start
```

**For Driver App:**
```bash
cd driver
npm start
```

Or you can run both in separate terminals if you need both apps running simultaneously.

### Troubleshooting

1. **Device not found**: Make sure USB debugging is enabled on both devices
2. **Permission denied**: Run `adb kill-server && adb start-server` and try again
3. **Device offline**: Unplug and replug the USB cable, or restart ADB
4. **App installs on wrong device**: The scripts use `adb -s <device-id>` to ensure installation on the correct device. If you still see issues, verify device IDs with `adb devices`
5. **Metro bundler not connecting**: Make sure Metro is running (`npm start`) and that your device and computer are on the same network (or use USB debugging with port forwarding)

### Changing Device IDs

If you need to change the device IDs, update the scripts in:
- `user/package.json` - Update the `android:device` script
- `driver/package.json` - Update the `android:device` script

