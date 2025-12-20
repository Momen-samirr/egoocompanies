# WhatsApp Group Notifications Setup

This document describes how to configure WhatsApp group notifications for trip monitoring.

## Overview

When a driver starts a scheduled trip (status changes to ACTIVE), the system automatically sends a WhatsApp message to a managers' group containing trip details.

## Environment Variables

Add the following environment variables to your `.env` file in the server root directory:

```env
# WhatsApp Group Configuration
WHATSAPP_PROVIDER=green-api
WHATSAPP_MANAGERS_GROUP_ID=120363123456789012@g.us

# Green API Credentials
GREEN_API_INSTANCE_ID=your_instance_id
GREEN_API_TOKEN=your_api_token
```

### Variable Descriptions

- **WHATSAPP_PROVIDER**: Currently set to `green-api`. Reserved for future extensibility.
- **WHATSAPP_MANAGERS_GROUP_ID**: The WhatsApp group ID where managers will receive notifications. Format: `[numbers]@g.us` (e.g., `120363123456789012@g.us`)
- **GREEN_API_INSTANCE_ID**: Your Green API instance ID (obtained from Green API dashboard)
- **GREEN_API_TOKEN**: Your Green API authentication token (obtained from Green API dashboard)

## Getting Your Green API Credentials

1. Register at [https://green-api.com](https://green-api.com)
2. Create a new instance in the dashboard
3. Copy your `instanceId` and `apiToken` from the instance settings
4. Add them to your `.env` file

## Getting Your WhatsApp Group ID

### Method 1: Using Green API Dashboard

1. Log into your Green API dashboard
2. Navigate to your instance
3. Use the API explorer or group management tools to list your groups
4. Find your managers' group and copy the Group JID (format: `[numbers]@g.us`)

### Method 2: Using Green API Get Groups Endpoint

```bash
curl -X POST "https://api.green-api.com/waInstance{instanceId}/getGroups/{apiToken}"
```

The response will contain a list of groups with their IDs.

## Important Notes

1. **Group ID Format**: The group ID must be in the format `[numbers]@g.us`. For example: `120363123456789012@g.us`
2. **WhatsApp Number**: Your WhatsApp number (connected to Green API) must be a member of the managers' group
3. **Non-Blocking**: WhatsApp notification failures will NOT prevent trip activation. Errors are logged but do not affect the trip start process.
4. **Error Handling**: If WhatsApp credentials are not configured, the system will log a warning and continue normally.

## Testing

To test the integration:

1. Ensure all environment variables are set correctly
2. Start a scheduled trip as a driver
3. Check the managers' WhatsApp group for the notification
4. Check server logs for success/error messages

## Troubleshooting

### No notification received

- Verify `WHATSAPP_MANAGERS_GROUP_ID` is set correctly
- Check that your WhatsApp number is a member of the group
- Verify Green API credentials are correct
- Check server logs for error messages

### Invalid group ID format error

- Ensure group ID follows format: `[numbers]@g.us`
- Remove any spaces or special characters
- Verify the group ID from Green API dashboard

### API authentication errors

- Verify `GREEN_API_INSTANCE_ID` and `GREEN_API_TOKEN` are correct
- Check that your Green API instance is active
- Ensure your WhatsApp number is connected to the instance
