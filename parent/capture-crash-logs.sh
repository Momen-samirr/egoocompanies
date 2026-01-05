#!/bin/bash
# Script to capture crash logs from the parent app

echo "Clearing logcat..."
adb logcat -c

echo "Starting logcat capture. Launch the app now, then press Ctrl+C after it crashes..."
echo "Logs will be saved to crash-logs.txt"
echo ""

adb logcat -v time *:E ReactNative:V ReactNativeJS:V RideWaveParent:V AndroidRuntime:E > crash-logs.txt 2>&1






