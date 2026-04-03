#!/bin/bash

# Script to run driver app on specific device (aed407cf)
# Usage: ./run-on-device.sh

DEVICE_ID="ede976ad"
APP_PACKAGE="com.becodemy.ridewavedriver"

echo "🚗 Running Driver App (Ridewave-Driver) on device: $DEVICE_ID"
echo ""

# Check if device is connected
if ! adb devices | grep -q "$DEVICE_ID.*device"; then
    echo "❌ Error: Device $DEVICE_ID not found or not authorized!"
    echo "Connected devices:"
    adb devices
    exit 1
fi

# Change to script directory
cd "$(dirname "$0")"

# Set ANDROID_SERIAL to force ADB to use this device
export ANDROID_SERIAL=$DEVICE_ID

echo "📱 Building APK for device $DEVICE_ID..."
cd android

# Build the debug APK
./gradlew assembleDebug

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK not found at $APK_PATH"
    exit 1
fi

echo "📲 Installing APK on device $DEVICE_ID..."
adb -s "$DEVICE_ID" install -r "$APK_PATH"

if [ $? -eq 0 ]; then
    echo "🚀 Starting app on device $DEVICE_ID..."
    adb -s "$DEVICE_ID" shell am start -n "$APP_PACKAGE/.MainActivity"
    
    echo ""
    echo "✅ App installed and started on device $DEVICE_ID!"
    echo "💡 To start Metro bundler, run: npm start"
else
    echo "❌ Failed to install APK"
    exit 1
fi
