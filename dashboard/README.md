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

2. Create `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
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

## Security Notes

- All API requests require authentication via JWT token
- Tokens are stored in localStorage (consider using httpOnly cookies in production)
- Admin routes are protected by middleware
- Change default admin credentials immediately

## License

ISC
