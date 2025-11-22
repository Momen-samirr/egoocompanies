# RideWave Admin Dashboard

A comprehensive admin dashboard for managing the RideWave ride-sharing platform.

## Features

- **Dashboard Overview**: Real-time statistics and key metrics
- **User Management**: View, search, and manage users
- **Driver Management**: Manage drivers, verify documents, update status
- **Ride Management**: Track and monitor all rides
- **Analytics**: Visual charts and reports

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- MongoDB database running
- Backend server running (check your server/.env for PORT, default is 8000)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file (copy from `.env.example`):
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# Google Maps API Key (required for map features)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# WebSocket Server URL (required for live map)
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8080
```

**For local development with a server on another machine:**
```env
NEXT_PUBLIC_API_URL=http://192.168.1.7:8000/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q
NEXT_PUBLIC_WEBSOCKET_URL=ws://192.168.1.7:8080
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Default Admin Credentials

After running the seed script:
- Email: `admin@ridewave.com`
- Password: `admin123`

**Important**: Change the default password after first login!

## Backend Setup

1. Navigate to the server directory:
```bash
cd ../server
```

2. Install dependencies:
```bash
npm install
```

3. Update Prisma schema (MongoDB uses db push instead of migrations):
```bash
npx prisma db push
npx prisma generate
```

4. Seed admin user:
```bash
npx ts-node scripts/seed-admin.ts
```

5. Start the server:
```bash
npm run dev
```

## Project Structure

```
dashboard/
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── page.tsx          # Dashboard overview
│   │   ├── users/            # User management
│   │   ├── drivers/          # Driver management
│   │   ├── rides/            # Ride management
│   │   └── analytics/        # Analytics page
│   └── page.tsx              # Login page
├── components/
│   ├── layout/               # Layout components
│   ├── dashboard/            # Dashboard components
│   └── common/               # Shared components
├── lib/
│   ├── api.ts                # API client
│   └── auth.ts               # Authentication utilities
└── types/
    └── index.ts              # TypeScript types
```

## API Endpoints

All admin endpoints are prefixed with `/api/v1/admin`:

- `POST /admin/login` - Admin login
- `GET /admin/dashboard/stats` - Get dashboard statistics
- `GET /admin/users` - Get all users
- `GET /admin/users/:id` - Get user details
- `GET /admin/drivers` - Get all drivers
- `GET /admin/drivers/:id` - Get driver details
- `PUT /admin/drivers/:id/status` - Update driver status
- `PUT /admin/drivers/:id/verify` - Verify driver documents
- `GET /admin/rides` - Get all rides
- `GET /admin/rides/:id` - Get ride details
- `GET /admin/analytics` - Get analytics data

## Technologies Used

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Axios** - HTTP client
- **Heroicons** - Icons

## Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

## Deployment to Vercel

### Prerequisites

1. Create a Vercel account at [vercel.com](https://vercel.com)
2. Install Vercel CLI (optional):
```bash
npm i -g vercel
```

### Deployment Steps

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Import your project to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables in Vercel:**
   - Go to your project settings → Environment Variables
   - Add the following variables:
     ```
     NEXT_PUBLIC_API_URL=https://your-production-server.com/api/v1
     NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
     NEXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-server.com
     ```
   - **Important**: Use `https://` and `wss://` for production URLs (secure connections)

4. **Deploy:**
   - Vercel will automatically deploy on every push to your main branch
   - Or click "Deploy" in the Vercel dashboard

### Environment Variables for Production

When deploying to Vercel, make sure to set:

- `NEXT_PUBLIC_API_URL`: Your production backend API URL
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Your Google Maps API key
- `NEXT_PUBLIC_WEBSOCKET_URL`: Your production WebSocket server URL (use `wss://` for secure WebSocket)

**Note**: All `NEXT_PUBLIC_*` variables are exposed to the browser. Never put sensitive secrets in these variables.

### CORS Configuration

Make sure your backend server allows requests from your Vercel domain. Add your Vercel URL to CORS allowed origins in your server configuration.

## Security Notes

- All API requests require authentication via JWT token
- Tokens are stored in localStorage (consider using httpOnly cookies in production)
- Admin routes are protected by middleware
- Change default admin credentials immediately
- Use HTTPS/WSS in production for secure connections

## License

ISC
