# Live Map Feature - Setup Guide

## Overview

The Live Map feature provides real-time tracking of drivers and active rides on a Google Maps interface. This allows administrators to monitor the fleet in real-time.

## Features

✅ **Real-time Driver Tracking**
- Live location updates from connected drivers
- Driver status indicators (active/inactive)
- Vehicle type visualization
- Click on markers to view driver details

✅ **Active Ride Monitoring**
- Display active ride routes on the map
- Visual representation of pickup and destination
- Real-time ride status updates

✅ **Filtering & Controls**
- Filter drivers by status (active/inactive)
- Filter by vehicle type (Car, Motorcycle, CNG)
- Toggle active rides display
- Connection status indicator

✅ **Interactive Features**
- Click driver markers for detailed info
- Navigate to driver details page
- Real-time WebSocket connection
- Auto-reconnect on disconnect

## Setup Instructions

### 1. Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Maps JavaScript API"
4. Create credentials (API Key)
5. Add the API key to your `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8080
```

### 2. WebSocket Server

Make sure the WebSocket server is running:

```bash
cd socket
node server.js
```

The server should be running on port 8080.

### 3. Driver App Configuration

Ensure drivers are sending location updates with the following format:

```javascript
{
  type: "locationUpdate",
  role: "driver",
  driver: "driver_id",
  data: {
    latitude: 23.8103,
    longitude: 90.4125,
    name: "Driver Name",
    status: "active",
    vehicleType: "Car"
  }
}
```

### 4. Access the Map

1. Start the dashboard: `npm run dev`
2. Navigate to `/dashboard/map`
3. The map will automatically connect to the WebSocket server
4. Driver locations will appear as they connect

## Architecture

### WebSocket Communication

- **Admin Connection**: `ws://localhost:8080?role=admin`
- **Driver Updates**: Sent via `locationUpdate` messages
- **Real-time Broadcast**: All admin clients receive updates simultaneously

### Data Flow

```
Driver App → WebSocket Server → Admin Dashboard
                ↓
         Store in memory
                ↓
         Broadcast to admins
```

### Map Components

- **Google Maps**: Main map display
- **Markers**: Driver locations with custom icons
- **Polylines**: Active ride routes
- **Info Windows**: Driver details on click

## API Endpoints

### Get Active Rides
```
GET /api/v1/admin/active-rides
```

Returns all active rides (Accepted, In Progress) with location data.

## Troubleshooting

### Map Not Loading
- Check Google Maps API key is set correctly
- Verify API key has Maps JavaScript API enabled
- Check browser console for errors

### No Drivers Showing
- Verify WebSocket server is running
- Check WebSocket connection status (green/red indicator)
- Ensure drivers are sending location updates
- Check WebSocket server logs

### Connection Issues
- Verify `NEXT_PUBLIC_WEBSOCKET_URL` is correct
- Check firewall settings
- Ensure WebSocket server is accessible
- Check CORS settings if needed

## Future Enhancements

- [ ] Geocoding for ride locations
- [ ] Heat map of driver activity
- [ ] Historical route playback
- [ ] Driver path history
- [ ] Zone-based analytics
- [ ] Real-time ride matching visualization
- [ ] Driver performance metrics on map
- [ ] Custom map styles
- [ ] Clustering for dense areas

## Security Notes

- WebSocket connections should be secured (WSS) in production
- Implement authentication for WebSocket connections
- Rate limit location updates
- Consider data retention policies

