# Wellness App

A wellness center booking app with two roles:

- `user`: register, log in, update profile, request bookings, cancel upcoming bookings, view booking history, and leave reviews for completed services
- `admin`: log in, approve or reject bookings, and manage the services catalog

## Current Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB with a built-in demo fallback mode when the database is unreachable

## Project Structure

- [`frontend`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend): React app
- [`backend-auth`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth): Express API

## Features Built

- Account registration and login
- Role-based member and admin views
- Service browsing
- Booking creation with slot-capacity checks
- Booking approval and rejection
- Profile updates
- Booking cancellation
- Admin service creation, editing, and deactivation
- Upcoming and past booking history
- Service reviews for completed bookings

## Local Setup

### 1. Backend

In [`backend-auth`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth):

```bash
npm install
cp .env.example .env
npm run dev
```

### 2. Frontend

In [`frontend`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend):

```bash
npm install
npm run dev
```

### 3. Open the App

Open the frontend URL shown by Vite, usually:

```text
http://localhost:5173
```

## Environment Variables

Create [`backend-auth/.env`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/.env) from [`backend-auth/.env.example`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth/.env.example):

```env
MONGO_URI=your-mongodb-connection-string
PORT=5000
CORS_ORIGINS=http://localhost:5173
```

Create [`frontend/.env`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend/.env) from [`frontend/.env.example`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend/.env.example):

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

If MongoDB is unavailable, the backend starts in demo mode so the app still works for development.

## Demo Admin Account

When the backend runs in demo mode, it seeds this admin login:

- Email: `admin@wellness.local`
- Password: `admin123`

## GitHub Cleanup Notes

- `node_modules` is ignored and should not be committed
- `.env` files are ignored and should not be committed
- If a real MongoDB password was ever pushed to GitHub before cleanup, rotate that password before sharing the repo publicly

## Recommended Next Steps

- Deploy with Render using [`render.yaml`](/Users/vitorialima/Documents/GitHub/wellness_app/render.yaml)
- Add route protection with persistent auth tokens
- Add automated tests
- Add admin membership management

## Deployment on Render

This repo includes a Render Blueprint file at [`render.yaml`](/Users/vitorialima/Documents/GitHub/wellness_app/render.yaml).

Render’s docs say Blueprints use a root-level `render.yaml`, support monorepos with `rootDir`, and allow one repo to define both a Node web service and a static site. Render also documents static sites for React/Vite apps and web services for Express apps. I used that setup here.

### What the blueprint creates

- `wellness-backend`: Node web service from [`backend-auth`](/Users/vitorialima/Documents/GitHub/wellness_app/backend-auth)
- `wellness-frontend`: static site from [`frontend`](/Users/vitorialima/Documents/GitHub/wellness_app/frontend)

### Render setup steps

1. Push this repo to GitHub.
2. In Render, create a new Blueprint and connect the repo.
3. Let Render read [`render.yaml`](/Users/vitorialima/Documents/GitHub/wellness_app/render.yaml).
4. Set `MONGO_URI` on the backend service.
5. After Render gives the frontend a URL, set:
   `CORS_ORIGINS=https://your-frontend-url.onrender.com`
6. Set the frontend env var:
   `VITE_API_BASE_URL=https://your-backend-url.onrender.com/api`
7. Redeploy both services.

### Notes

- The frontend uses `VITE_API_BASE_URL` instead of a hardcoded localhost API URL.
- The backend uses `CORS_ORIGINS` instead of a single hardcoded frontend URL.
- Render web services expect your app to bind to `PORT`, and the backend already does that.
