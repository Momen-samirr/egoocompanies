# RideWave Admin Dashboard - Setup Guide

## 🎉 Implementation Complete!

The Next.js admin dashboard for RideWave has been successfully implemented. Here's what has been created:

## 📁 What Was Created

### Backend (Server)

1. **Prisma Schema Updates**
   - Added `Admin` model with roles (SUPER_ADMIN, ADMIN, SUPPORT)
   - Added `AdminRole` enum

2. **Admin Controller** (`server/controllers/admin.controller.ts`)
   - Admin login with JWT authentication
   - Dashboard statistics endpoint
   - User management (list, view details)
   - Driver management (list, view details, update status, verify documents)
   - Ride management (list, view details)
   - Analytics endpoint

3. **Admin Routes** (`server/routes/admin.route.ts`)
   - All admin API endpoints organized

4. **Admin Middleware** (`server/middleware/isAuthenticated.ts`)
   - `isAuthenticatedAdmin` middleware for protecting admin routes

5. **Seed Script** (`server/scripts/seed-admin.ts`)
   - Creates default admin user

### Frontend (Dashboard)

1. **Next.js 14 App** with:
   - TypeScript
   - Tailwind CSS
   - App Router structure

2. **Pages Created**:
   - Login page (`/`)
   - Dashboard overview (`/dashboard`)
   - Users management (`/dashboard/users`)
   - User details (`/dashboard/users/[id]`)
   - Drivers management (`/dashboard/drivers`)
   - Driver details (`/dashboard/drivers/[id]`)
   - Rides management (`/dashboard/rides`)
   - Ride details (`/dashboard/rides/[id]`)
   - Analytics (`/dashboard/analytics`)

3. **Components**:
   - Sidebar navigation
   - Header
   - Stats cards
   - Data tables with pagination
   - Charts (using Recharts)

4. **Utilities**:
   - API client with interceptors
   - Authentication helpers
   - TypeScript types

## 🚀 Quick Start

### Step 1: Install Backend Dependencies

```bash
cd server
npm install
```

### Step 2: Update Database Schema

Since you're using MongoDB, Prisma doesn't support traditional migrations. Instead, use `db push`:

```bash
cd server
npx prisma db push
npx prisma generate
```

This will push the schema changes (including the new Admin model) to your MongoDB database.

### Step 3: Seed Admin User

```bash
cd server
npx ts-node scripts/seed-admin.ts
```

**Default Credentials:**
- Email: `admin@ridewave.com`
- Password: `admin123`

⚠️ **IMPORTANT**: Change the password after first login!

### Step 4: Start Backend Server

```bash
cd server
npm run dev
```

Server should run on `http://localhost:8000` (or the port specified in your .env file)

### Step 5: Setup Dashboard

```bash
cd dashboard
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**Note**: Make sure the port matches your server's PORT in `server/.env` (default is 8000).

### Step 6: Start Dashboard

```bash
cd dashboard
npm run dev
```

Dashboard should run on `http://localhost:3000`

## 📋 Features Implemented

### ✅ Dashboard Overview
- Total users, drivers, rides statistics
- Active drivers and rides count
- Revenue metrics (today, week, month, total)
- Recent rides activity feed

### ✅ User Management
- List all users with pagination
- Search users by name, email, or phone
- View user details
- View user ride history

### ✅ Driver Management
- List all drivers with pagination
- Search and filter by status
- Update driver status (active/inactive)
- Verify driver documents
- View driver details and ride history
- View driver earnings

### ✅ Ride Management
- List all rides with pagination
- Filter by status
- View detailed ride information
- View user and driver details for each ride

### ✅ Analytics
- Revenue by vehicle type (bar chart)
- Ride status distribution (pie chart)
- Time period selection (week, month, year)

## 🔐 Security Features

- JWT-based authentication
- Protected admin routes
- Token stored in localStorage (consider httpOnly cookies for production)
- Automatic token refresh handling
- Unauthorized request handling

## 🎨 UI/UX Features

- Responsive design (mobile, tablet, desktop)
- Clean, modern interface
- Tailwind CSS styling
- Loading states
- Error handling
- Pagination for large datasets
- Search and filtering
- Status badges with color coding

## 📊 API Endpoints

All endpoints are prefixed with `/api/v1/admin`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/login` | Admin login |
| GET | `/admin/dashboard/stats` | Dashboard statistics |
| GET | `/admin/users` | Get all users (paginated) |
| GET | `/admin/users/:id` | Get user details |
| GET | `/admin/drivers` | Get all drivers (paginated) |
| GET | `/admin/drivers/:id` | Get driver details |
| PUT | `/admin/drivers/:id/status` | Update driver status |
| PUT | `/admin/drivers/:id/verify` | Verify driver documents |
| GET | `/admin/rides` | Get all rides (paginated) |
| GET | `/admin/rides/:id` | Get ride details |
| GET | `/admin/analytics` | Get analytics data |

## 🔄 Next Steps (Optional Enhancements)

1. **Real-time Updates**
   - WebSocket integration for live ride tracking
   - Real-time driver location updates

2. **Advanced Analytics**
   - More chart types
   - Export reports (PDF/CSV)
   - Custom date range selection

3. **Notifications**
   - Push notifications for admins
   - Email notifications for important events

4. **Document Management**
   - Upload/view driver documents
   - Document verification workflow

5. **Financial Management**
   - Payout management
   - Commission calculations
   - Transaction history

6. **User Actions**
   - Suspend/activate users
   - Send notifications to users/drivers

7. **Settings**
   - Platform configuration
   - Commission rates
   - Service area management

## 🐛 Troubleshooting

### Database Connection Issues
- Ensure MongoDB is running
- Check `DATABASE_URL` in `.env`

### Authentication Issues
- Verify `ACCESS_TOKEN_SECRET` is set in server `.env`
- Check token expiration (default: 7 days)

### CORS Issues
- Backend CORS is configured to allow all origins
- For production, update CORS settings in `server/app.ts`

### Dashboard Not Loading
- Verify backend is running on port 5000
- Check `NEXT_PUBLIC_API_URL` in dashboard `.env.local`
- Check browser console for errors

## 📝 Notes

- The dashboard uses client-side rendering for all pages
- Authentication is handled via localStorage
- All API calls include JWT token in Authorization header
- Pagination is implemented for all list views
- Search and filtering work on the backend

## 🎯 Testing

1. Login with default credentials
2. Check dashboard overview loads correctly
3. Navigate through all sections
4. Test search and filtering
5. View detail pages
6. Test driver status updates

## 📞 Support

For issues or questions, check:
- Server logs for backend errors
- Browser console for frontend errors
- Network tab for API request/response details

---

**Happy Admin Dashboard Management! 🚀**

