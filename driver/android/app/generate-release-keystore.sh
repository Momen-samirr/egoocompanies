#!/bin/bash

# Script to generate a release keystore for the egoo app
# This keystore will be used to sign release builds for Google Play Store

echo "Generating release keystore for egoo..."
echo ""

# Navigate to the app directory
cd "$(dirname "$0")"

KEYSTORE_NAME="release.keystore"
KEY_ALIAS="egoo-release-key"
VALIDITY_YEARS=100

# Check if keystore already exists
if [ -f "$KEYSTORE_NAME" ]; then
    echo "WARNING: $KEYSTORE_NAME already exists!"
    read -p "Do you want to overwrite it? (yes/no): " overwrite
    if [ "$overwrite" != "yes" ]; then
        echo "Aborted. Existing keystore will be kept."
        exit 1
    fi
fi

echo "Please enter the following information for your keystore:"
echo "(Keep this information secure! You'll need it to update the app in the future)"
echo ""

read -sp "Keystore password: " KEYSTORE_PASSWORD
echo ""
read -sp "Key password (press Enter to use same as keystore password): " KEY_PASSWORD
echo ""

# Use keystore password as key password if not provided
if [ -z "$KEY_PASSWORD" ]; then
    KEY_PASSWORD="$KEYSTORE_PASSWORD"
fi

# Generate the keystore
keytool -genkeypair -v \
    -storetype PKCS12 \
    -keystore "$KEYSTORE_NAME" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$((VALIDITY_YEARS * 365))" \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "CN=egoo, OU=Mobile, O=Becodemy, L=City, ST=State, C=US"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Keystore generated successfully: $KEYSTORE_NAME"
    echo ""
    echo "Next steps:"
    echo "1. Copy android/app/keystore.properties.example to android/app/keystore.properties"
    echo "2. Update keystore.properties with your keystore information"
    echo "3. Keep your keystore file and passwords secure!"
    echo "4. For EAS builds, you can let EAS manage the keystore automatically"
    echo ""
    echo "IMPORTANT: Back up your keystore file and passwords in a secure location!"
else
    echo ""
    echo "✗ Failed to generate keystore. Please check the error messages above."
    exit 1
fi

