# Wellness App
1) Goal (1–2 sentences) 
	Wellness center appointment booking system with a focus on variety-seeking health enthusiasts booking different services such as gym-time, pilates classes, spa treatments, and massages with different duration options. 
2) Roles & Permissions (Minimum: 2 roles) 
Role 1: Admin
• Approve/Reject appointment requests
• Check room availability and keep schedule updated
• Verify client profile and membership status
Role 2:  User
• Log into account and use verified profile to book appointments/services
• Submit appointment request
• Change appointment date/time or cancel an existing appointment 
3) Core Features (5–8 items) 
Register for an account as either an admin or a client/user and log in to manage personal data
Admin can create, update, and delete services and change or set service durations
Users can view their completed and upcoming appointments
Users can add ratings and/or comments to services they have completed
Users can manage upcoming appointments to address any possible overlapping time slots
Admin can deactivate a user’s membership status after a service is complete

4) Pages / Views (Minimum: 5) 
1. Login / Register with valid membership
2. Choose service
3. Choose date and time
4. Profile and membership status 
5. Previous and upcoming bookings 
6. Class/services reviews in chronological list

5) Data Tables (Draft Only) (Minimum: 4 tables) 
Just list table names and a few key fields (no advanced DB knowledge needed). 
Table/Collection 
Key Fields (examples)
  1) Users 
id, name, email, password, membership number, preferred location
2) Admin Actions
id, admin_id, service_id, action (approve/reject/remove), created_at
3) Services 
service_id, service_name, description, vacancy_status
4) Requests
id, request_id, service_id, time_slot, status (Pending/Accepted/ Rejected), created_at.

Relationship idea (1 line): A user submits a service request for approval by the admin. 

7) Team Plan + Risks (Required) 
Work split (who does what): 
• Christina: Frontend (Service selection pages, date/time selection, user profile and booking history pages).
• Vitoria: Backend (Database design (users, services, requests), appointment booking logic and conflict handling, admin approval/rejection workflow).

Two risks + simple plan to handle them: 
1. Risk: Overlapping appointments could be booked for the same service or time slot.
Plan: Validate time slots on the backend before confirming bookings and block already-approved time slots from being selected.
2. Risk: Users may try to book services without a valid membership or approval.
Plan: Require verification for memberships before allowing booking requests and restrict admin actions to admin-only routes.

Unique Feature (1 sentence) 
Our unique feature is: A service-based booking system that allows users to choose different service types with customizable duration options while preventing scheduling conflicts through admin approval. 
Mini Example: Wellness booking app: Roles = Admin/User; pages = Choose Service, Choose Time, My Bookings, Admin Dashboard; analytics = number of bookings per service.
