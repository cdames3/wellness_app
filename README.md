# Wellness Center Studio

A full-stack wellness booking platform for members and staff. The app supports public browsing, member scheduling, reviews, admin service management, instructor overrides, attendance tracking, and a styled dashboard experience for both roles.

## Current Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Deployment: Render Blueprint via [`render.yaml`](/Users/vitorialima/Documents/GitHub/wellness_app/render.yaml)

## What The App Does

### Public Experience

- Browse the wellness studio landing page
- View service cards with live median star ratings from reviews
- See an editorial preview of the studio offerings
- Register or log in as a member or admin

### Member Experience

- Create an account without entering a membership number
- Receive an auto-generated membership number during registration
- Log in with either email or membership number
- Book a class or service using:
  - real schedule windows per service
  - studio location selection
  - instructor selection when applicable
  - mock checkout during booking
- View upcoming bookings, past bookings, and no-shows separately
- Leave reviews for completed bookings
- Edit profile information, email, and password
- Use a one-time Open Gym credit after an Open Gym no-show

### Admin Experience

- Manage services from a dedicated admin dashboard
- Create new services
- Edit service details inline
- Deactivate services
- Edit pricing, duration, capacity, and descriptions
- Manage instructor schedule overrides by date, time, and location
- View a monthly calendar of upcoming sessions
- View grouped future sessions and past sessions
- Confirm attendance after a class has passed
- Mark a member as a no-show
- Cancel bookings when needed

## Service Scheduling Logic

The app currently ships with these default schedule patterns:

- `Open Gym Session`: every 30 minutes from 6:00 AM to 12:00 AM
- `Pilates Flow`: every 90 minutes from 6:00 AM to 8:00 PM
- `Deep Tissue Massage`: hourly sessions from 9:00 AM to 6:00 PM
- `Spa Reset`: every 45 minutes from 10:00 AM to 7:00 PM

Locations are included for:

- Atlanta
- Sandy Springs
- Peachtree Corners
- Lawrenceville
- Duluth
- Roswell
- Alpharetta

## Booking, Attendance, And No-Show Rules

- Members can only book future class times
- Capacity is checked before a booking is created
- Bookings are created as immediately booked, not pending approval
- Attendance can only be marked after the session start time has passed
- If an admin marks a member as `No-show`:
  - regular classes/services get a demo 20% no-show fee
  - `Open Gym Session` gets a one-time reschedule credit instead

## Reviews And Ratings

- Members can review completed bookings
- Services display a live rounded-up median rating
- Ratings update automatically as new reviews are submitted

## Auth And Session Handling

The app now uses cookie-based sessions instead of storing the login token in browser `localStorage`.

- Session cookies are `HttpOnly`
- Production cookies are configured for secure cross-site usage
- Sessions are stored in MongoDB when the database is connected
- Demo mode still uses an in-memory fallback session store for local development

This is more secure than the previous browser-stored token approach, but the project still has a few important public-launch improvements left. See `Public Launch Checklist` below.

## Demo Mode

If MongoDB is not available and demo mode is allowed, the backend falls back to local demo data stored under [`backend-auth/data/`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/data).

In non-production development mode, the backend can seed demo accounts:

- Admin: `admin@wellness.local` / `admin123`
- Member: `vitoria.test@example.com` / `test1234`

For production, Render is configured to disable demo mode and demo-user seeding by default.

## Project Structure

- [`frontend`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend): React app
- [`frontend/src/App.jsx`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend/src/App.jsx): main application UI and client logic
- [`frontend/src/styles.css`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend/src/styles.css): main styling system
- [`frontend/src/assets`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend/src/assets): editorial service and hero imagery
- [`backend-auth`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth): Express API
- [`backend-auth/models/User.js`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/models/User.js): user model
- [`backend-auth/models/Service.js`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/models/Service.js): service model
- [`backend-auth/models/Booking.js`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/models/Booking.js): booking model
- [`backend-auth/models/Review.js`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/models/Review.js): review model
- [`backend-auth/models/Session.js`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/models/Session.js): persisted session model
- [`render.yaml`](/Users/vitorialima/Documents/GitHub/wellness_app/render.yaml): Render deployment blueprint

## Local Setup

### 1. Backend

From [`backend-auth`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth):

```bash
npm install
cp .env.example .env
npm run dev
```

### 2. Frontend

From [`frontend`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend):

```bash
npm install
npm run dev
```

### 3. Open The App

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Environment Variables

### Backend

Create [`backend-auth/.env`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/.env) from [`backend-auth/.env.example`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/.env.example).

```env
NODE_ENV=development
MONGO_URI=your-mongodb-connection-string
PORT=5000
CORS_ORIGINS=http://localhost:5173
HOST=127.0.0.1
ALLOW_DEMO_MODE=true
SEED_DEMO_USERS=true
SESSION_DURATION_DAYS=7
ADMIN_NAME=Wellness Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me
ADMIN_MEMBERSHIP_NUMBER=ADMIN-001
```

### Frontend

[`frontend/.env.example`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend/.env.example):

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

For local development, the project can also run through Vite proxy mode using `/api`.

## Render Deployment

This repo includes a Render Blueprint file at [`render.yaml`](/Users/vitorialima/Documents/GitHub/wellness_app/render.yaml).

### What The Blueprint Creates

- `wellness-backend`: Node web service from [`backend-auth`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth)
- `wellness-frontend`: static site from [`frontend`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend)

### Production Defaults In The Blueprint

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `ALLOW_DEMO_MODE=false`
- `SEED_DEMO_USERS=false`

### Render Setup Steps

1. Push this repo to GitHub.
2. In Render, create a new Blueprint from the repo.
3. Let Render load [`render.yaml`](/Users/vitorialima/Documents/GitHub/wellness_app/render.yaml).
4. Set backend secrets:
   - `MONGO_URI`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
5. Once Render gives you URLs, set:
   - backend `CORS_ORIGINS=https://your-frontend-url.onrender.com`
   - frontend `VITE_API_BASE_URL=https://your-backend-url.onrender.com/api`
6. Redeploy both services.

## Public Launch Checklist

The app is much farther along than an MVP, but it is still not fully production-hardened for public launch. Before opening it to real users, these are the next most important upgrades:

### Highest Priority

- Replace the mock payment flow with a real provider such as Stripe Checkout or Stripe Payment Element
- Add request validation middleware for auth, bookings, services, and reviews
- Add rate limiting for login, register, payment, and admin routes
- Add security middleware such as Helmet
- Rotate any secrets or database credentials that were ever committed or exposed

### Strongly Recommended

- Add automated tests for auth, booking capacity, attendance, and admin permissions
- Add password reset and email verification flows
- Add structured server logging and monitoring
- Compress and optimize the large frontend images before launch
- Consider moving from the current custom session handling to a more fully managed production auth/session strategy as the app grows

## Current Known Limitations

- Payments are demo-only right now
- Demo mode is helpful for development, but it should stay disabled in production
- Frontend images are currently heavy and should be optimized
- There are no automated tests yet

## Git And Repo Safety Notes

- `node_modules` should never be committed
- `.env` files should never be committed
- local demo persistence under [`backend-auth/data/`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/data) is ignored by git

## Verification

At the current checkpoint:

- frontend build passes with `npm run build`
- backend syntax check passes with `node -c backend-auth/server.js`
