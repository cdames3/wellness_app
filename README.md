# Wellness Center Studio

Wellness Center Studio is a full-stack wellness booking application built for a school project. It simulates how a modern multi-location wellness business could manage members, classes, services, instructors, reviews, attendance, and day-to-day studio operations in one system.

The application includes a public-facing landing page, a member dashboard, and a separate admin operations dashboard. The current build focuses on a polished user experience while also including practical backend rules for scheduling, account protection, attendance tracking, and review management.

## Project Purpose

This project was designed to model a real wellness business with:

- multiple studio locations
- different service types such as pilates, massage, spa, and open gym
- member accounts and secure login
- instructor scheduling and availability management
- booking and payment simulation
- admin tools for services, staff, attendance, and schedules

The goal was to create a system that feels believable as a real wellness platform while still being manageable as a course project.

## Main User Roles

### Public Visitor

A visitor can:

- view the landing page
- browse service previews
- see current service ratings
- register for an account
- sign in as a member or admin

### Member

A member can:

- register without manually entering a membership number
- receive an automatically generated membership number
- sign in with either email or membership number
- verify their email address
- request a password reset
- browse services by price, type, and rating
- choose a location for a booking
- choose an instructor when applicable
- choose a live available class or service time
- complete a demo payment flow during booking
- view upcoming bookings
- view past bookings
- view no-show records and open gym credits
- leave reviews for completed services
- update profile details, email, and password

### Admin

An admin can:

- manage services
- create new services
- edit services inline
- deactivate services
- permanently delete services when allowed
- manage instructors and their weekly work windows
- add new instructors to the system
- view an employee directory
- see instructor availability
- create one-time instructor overrides for specific classes
- view schedules by service, instructor, calendar, and location
- cancel member bookings when needed
- mark attendance after a class has passed
- mark members as no-shows

## Core Application Features

## 1. Authentication and Accounts

The app supports:

- account registration
- secure login
- cookie-based session handling
- email verification
- forgot-password flow
- password reset with expiring tokens

Membership numbers are generated automatically at registration time. Emails are normalized to lowercase so members can log in more reliably.

## 2. Booking System

Members can book services through a guided flow:

1. choose a service
2. choose a location
3. optionally choose a preferred instructor
4. choose a valid upcoming time
5. complete a demo payment step

The system prevents booking past sessions and checks slot capacity before confirming a booking.

Bookings are created as immediately booked rather than waiting for admin approval.

## 3. Location-Based Scheduling

The project supports seven studio locations:

- Atlanta
- Sandy Springs
- Peachtree Corners
- Lawrenceville
- Duluth
- Roswell
- Alpharetta

Each location can have different instructor coverage and different class times.

Instructor-led services now use smaller, more believable schedules. Instead of showing a class every possible interval all day, each location only offers a limited number of real sessions per day. Each instructor-led class slot is tied to one instructor, which makes the schedule feel more like a real studio with limited rooms and staffing.

Open Gym remains broadly available and uses 30-minute booking intervals, but in the admin location view it is displayed as one clean open-hours block rather than repeated dozens of times.

## 4. Services

The default services included in the app are:

- Pilates Flow
- Deep Tissue Massage
- Spa Reset
- Open Gym Session

Each service includes:

- name
- description
- category
- duration
- capacity
- price
- booking mode
- location availability
- assigned instructors
- schedule configuration
- rating summary

## 5. Instructors and Employee Management

The instructor system is a major part of the app.

Admins can:

- add new instructors
- edit instructor name, title, bio, email, and phone
- assign instructors to services
- assign instructors to locations
- define weekly work windows
- use a one-time override to swap coverage for a specific class

The admin instructor page is organized as a two-column workspace so staff management, directory review, and override tools can all be viewed clearly without feeling cluttered.

## 6. Attendance and No-Show Handling

Once a class or service time has passed, the admin can:

- confirm that a member attended
- mark the member as a no-show

If a member is marked as a no-show:

- regular instructor-led services trigger a demo 20% no-show fee
- open gym sessions create a one-time reschedule credit instead

Members can view no-show records on their side of the app.

## 7. Reviews and Ratings

Members can leave reviews only for completed bookings.

The app calculates a live service rating summary based on the median of submitted review scores. The median is rounded up so each service card can display a clean star rating and summary line.

This rating appears in the public experience and admin service displays.

## 8. Admin Schedule Views

The admin side includes several ways to understand the schedule:

- service management
- instructor availability explorer
- one-time override tools
- monthly calendar view
- future sessions
- past sessions
- location schedule board

The new locations page lets the admin choose a studio and see that location’s schedule day by day in a cleaner, less cluttered format.

## Payment Behavior

This project uses a demo payment flow for school purposes.

Important notes:

- the checkout does not process real payments
- any 16-digit number can be used as a demo card
- the system only stores the last four digits
- a cardholder name is required for the demo checkout flow

This keeps the project usable for demos without integrating a paid third-party processor.

## Security and Data Protection

The application includes several important protections:

- passwords are hashed before storage
- cookie-based sessions are used instead of browser-stored auth tokens
- session cookies are HttpOnly
- CSRF protection is applied to write requests
- Helmet security headers are enabled
- rate limiting protects auth, booking, and admin write actions
- request validation is used for major payloads
- password reset tokens expire automatically
- email verification tokens expire automatically
- password resets invalidate existing sessions

For demo payments, the system intentionally avoids storing full card numbers.

## Demo Mode and Persistence

When MongoDB is unavailable in development, the backend can fall back to demo mode. In that case, local data is saved under `backend-auth/data/` so demo users and bookings are not lost every time the backend restarts.

In development, demo accounts can be seeded automatically:

- Admin: `admin@wellness.local` / `admin123`
- Member: `vitoria.test@example.com` / `test1234`

For production deployment, demo mode and demo-user seeding are disabled by default in the Render configuration.

## Technology Stack

### Frontend

- React 19
- Vite
- custom CSS

### Backend

- Node.js
- Express
- Mongoose
- MongoDB

### Security / Utility

- Helmet
- express-rate-limit
- dotenv
- Nodemailer

### Deployment

- Render Blueprint via `render.yaml`

## Project Structure

```text
wellness_app/
├── backend-auth/
│   ├── data/
│   ├── lib/
│   ├── models/
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
├── render.yaml
└── README.md
```

## Important Files

### Frontend

- `frontend/src/App.jsx`
  Main application component, page switching, dashboard logic, booking flow, and admin interface logic.

- `frontend/src/styles.css`
  Main styling system for the landing page, member dashboard, and admin dashboard.

- `frontend/src/assets/`
  Stores the images used throughout the editorial service cards and landing page.

### Backend

- `backend-auth/server.js`
  Main API server, auth/session logic, service scheduling rules, booking logic, review handling, and admin routes.

- `backend-auth/models/User.js`
  User schema for members and admins.

- `backend-auth/models/Service.js`
  Service schema with pricing, capacity, booking mode, locations, schedule, and overrides.

- `backend-auth/models/Instructor.js`
  Instructor schema with service assignments, location assignments, and weekly availability.

- `backend-auth/models/Booking.js`
  Booking schema including payment summary, attendance state, and no-show rules.

- `backend-auth/models/Review.js`
  Review schema for service feedback.

- `backend-auth/models/Session.js`
  Session storage model for persisted auth sessions.

- `backend-auth/models/AuthToken.js`
  Verification and password reset token model.

- `backend-auth/lib/validation.js`
  Shared request validation utilities.

- `backend-auth/lib/business-rules.js`
  Reusable booking and no-show business logic used by tests.

- `backend-auth/lib/mailer.js`
  Email delivery helper for verification and password reset flows.

## Local Development Setup

### 1. Start the backend

From `backend-auth`:

```bash
npm install
cp .env.example .env
npm run dev
```

### 2. Start the frontend

From `frontend`:

```bash
npm install
npm run dev
```

### 3. Open the app

Open the local Vite address shown in the terminal, usually:

```text
http://localhost:5173
```

## Environment Variables

### Backend

Create `backend-auth/.env` from `backend-auth/.env.example`.

Important backend variables include:

- `NODE_ENV`
- `MONGO_URI`
- `PORT`
- `CORS_ORIGINS`
- `HOST`
- `APP_BASE_URL`
- `ALLOW_DEMO_MODE`
- `SEED_DEMO_USERS`
- `SESSION_DURATION_DAYS`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_MEMBERSHIP_NUMBER`
- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`

### Frontend

The frontend supports:

- `VITE_API_BASE_URL`

In local development, the app can also run through Vite proxy mode using `/api`.

## Testing

Backend tests can be run with:

```bash
cd backend-auth
npm test
```

Frontend production build can be checked with:

```bash
cd frontend
npm run build
```

## Deployment

This project includes a Render Blueprint in `render.yaml`.

The blueprint creates:

- `wellness-backend` as a Node web service
- `wellness-frontend` as a static site

Production defaults in the blueprint disable demo mode and expect a real MongoDB connection plus real environment variables.

General deployment flow:

1. push the repository to GitHub
2. create a Render Blueprint from the repo
3. add required backend secrets such as MongoDB and admin credentials
4. configure the frontend API base URL
5. redeploy both services

## Notes for School Demo Use

This project intentionally mixes realistic behavior with a school-demo-friendly setup.

Examples:

- payment is mocked instead of connected to a live provider
- demo mode can be used locally when MongoDB is unavailable
- demo email links can print in the terminal when SMTP is not configured
- seeded demo accounts make it easier to demonstrate both member and admin workflows

Even with those demo conveniences, the project still includes real architectural ideas such as session-based auth, role-based access control, validation, attendance handling, instructor scheduling, and multi-location booking logic.
