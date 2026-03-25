const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { randomUUID, scryptSync, timingSafeEqual, createHash } = require('crypto');
require('dotenv').config();
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const User = require('./models/User');
const Review = require('./models/Review');
const Session = require('./models/Session');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || (IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1');
const ALLOW_DEMO_MODE = process.env.ALLOW_DEMO_MODE === 'true' || !IS_PRODUCTION;
const SEED_DEMO_USERS = process.env.SEED_DEMO_USERS === 'true' || !IS_PRODUCTION;
const SESSION_COOKIE_NAME = 'wellness_session';
const SESSION_DURATION_DAYS = Math.max(1, Number(process.env.SESSION_DURATION_DAYS || 7));
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
const DEMO_DATA_PATH = path.join(__dirname, 'data', 'demo-data.json');
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const studioLocations = [
  {
    id: 'atlanta-buckhead',
    name: 'Atlanta',
    address: '1458 Peachtree Square NE, Atlanta, GA 30309',
  },
  {
    id: 'sandy-springs',
    name: 'Sandy Springs',
    address: '6120 Roswell Road, Sandy Springs, GA 30328',
  },
  {
    id: 'peachtree-corners',
    name: 'Peachtree Corners',
    address: '4980 Medlock Bridge Road, Peachtree Corners, GA 30092',
  },
  {
    id: 'lawrenceville',
    name: 'Lawrenceville',
    address: '875 Grayson Highway, Lawrenceville, GA 30046',
  },
  {
    id: 'duluth',
    name: 'Duluth',
    address: '3200 Satellite Boulevard, Duluth, GA 30096',
  },
  {
    id: 'roswell',
    name: 'Roswell',
    address: '1145 Canton Street, Roswell, GA 30075',
  },
  {
    id: 'alpharetta',
    name: 'Alpharetta',
    address: '2200 Avalon Boulevard, Alpharetta, GA 30009',
  },
];

function createLocations(instructors = []) {
  return studioLocations.map((location, index) => ({
    ...location,
    instructors: instructors[index % instructors.length] || instructors,
  }));
}

function createServiceConfig({ bookingMode, startHour, endHour, intervalMinutes, instructors }) {
  return {
    bookingMode,
    schedule: { startHour, endHour, intervalMinutes },
    locations: bookingMode === 'self-led' ? createLocations([]) : createLocations(instructors),
    scheduleOverrides: [],
  };
}

function getDefaultServicePrice(service) {
  const normalizedName = String(service?.name || '').toLowerCase();
  const normalizedCategory = String(service?.category || '').toLowerCase();

  if (normalizedName.includes('pilates')) {
    return 32;
  }

  if (normalizedCategory.includes('massage')) {
    return 140;
  }

  if (normalizedCategory.includes('spa')) {
    return 95;
  }

  if (normalizedName.includes('gym') || normalizedCategory.includes('fitness')) {
    return 22;
  }

  return 45;
}

function getDefaultServiceCapacity(service) {
  const normalizedName = String(service?.name || '').toLowerCase();
  const normalizedCategory = String(service?.category || '').toLowerCase();

  if (normalizedName.includes('pilates')) {
    return 8;
  }

  if (normalizedCategory.includes('massage')) {
    return 3;
  }

  if (normalizedCategory.includes('spa')) {
    return 4;
  }

  if (normalizedName.includes('gym') || normalizedCategory.includes('fitness')) {
    return 60;
  }

  return 1;
}

const defaultServices = [
  {
    name: 'Pilates Flow',
    description: 'A guided pilates class focused on flexibility and core strength.',
    durationMinutes: 60,
    category: 'Class',
    capacity: 8,
    price: 32,
    ...createServiceConfig({
      bookingMode: 'instructor-led',
      startHour: 6,
      endHour: 20,
      intervalMinutes: 90,
      instructors: [
        ['Ashley Monroe', 'Maria Torres'],
        ['Ashley Monroe', 'Nina Brooks'],
        ['Maria Torres', 'Leah Bryant'],
        ['Leah Bryant', 'Sofia Bennett'],
        ['Nina Brooks', 'Maria Torres'],
        ['Ashley Monroe', 'Sofia Bennett'],
        ['Leah Bryant', 'Nina Brooks'],
      ],
    }),
  },
  {
    name: 'Deep Tissue Massage',
    description: 'A restorative massage session for stress relief and muscle recovery.',
    durationMinutes: 60,
    category: 'Massage',
    capacity: 3,
    price: 140,
    ...createServiceConfig({
      bookingMode: 'instructor-led',
      startHour: 9,
      endHour: 18,
      intervalMinutes: 60,
      instructors: [
        ['Jasmine Cole', 'Elena Hart'],
        ['Jasmine Cole', 'Riley Scott'],
        ['Elena Hart', 'Ava Coleman'],
        ['Riley Scott', 'Jasmine Cole'],
        ['Ava Coleman', 'Elena Hart'],
        ['Riley Scott', 'Ava Coleman'],
        ['Jasmine Cole', 'Elena Hart'],
      ],
    }),
  },
  {
    name: 'Spa Reset',
    description: 'A calming spa treatment with aromatherapy and relaxation time.',
    durationMinutes: 45,
    category: 'Spa',
    capacity: 4,
    price: 95,
    ...createServiceConfig({
      bookingMode: 'instructor-led',
      startHour: 10,
      endHour: 19,
      intervalMinutes: 45,
      instructors: [
        ['Camila Reed', 'Olivia Stone'],
        ['Olivia Stone', 'Mia Larson'],
        ['Camila Reed', 'Mia Larson'],
        ['Olivia Stone', 'Zoe Harper'],
        ['Zoe Harper', 'Camila Reed'],
        ['Mia Larson', 'Olivia Stone'],
        ['Camila Reed', 'Zoe Harper'],
      ],
    }),
  },
  {
    name: 'Open Gym Session',
    description: 'Independent gym time for members who want a flexible workout window.',
    durationMinutes: 90,
    category: 'Fitness',
    capacity: 60,
    price: 22,
    ...createServiceConfig({
      bookingMode: 'self-led',
      startHour: 6,
      endHour: 24,
      intervalMinutes: 30,
      instructors: [],
    }),
  },
];

const demoAdmin = {
  name: 'Wellness Admin',
  email: 'admin@wellness.local',
  password: 'admin123',
  membershipNumber: 'ADMIN-001',
  role: 'admin',
};

const demoMember = {
  name: 'Vitoria Test',
  email: 'vitoria.test@example.com',
  password: 'test1234',
  membershipNumber: 'MEM-1001',
  role: 'user',
};

let databaseReady = false;
const sessions = new Map();
let memoryServices = defaultServices.map((service) => ({
  ...service,
  _id: randomUUID(),
  active: true,
}));
let memoryBookings = [];
let memoryUsers = [];
let memoryReviews = [];

app.disable('x-powered-by');

function getDefaultServiceConfig(service) {
  if (String(service?.name).toLowerCase().includes('gym')) {
    return createServiceConfig({
      bookingMode: 'self-led',
      startHour: 6,
      endHour: 24,
      intervalMinutes: 30,
      instructors: [],
    });
  }

  if (String(service?.name).toLowerCase().includes('pilates')) {
    return createServiceConfig({
      bookingMode: 'instructor-led',
      startHour: 6,
      endHour: 20,
      intervalMinutes: 90,
      instructors: [['Ashley Monroe', 'Maria Torres']],
    });
  }

  if (String(service?.category).toLowerCase().includes('massage')) {
    return createServiceConfig({
      bookingMode: 'instructor-led',
      startHour: 9,
      endHour: 18,
      intervalMinutes: 60,
      instructors: [['Jasmine Cole', 'Elena Hart']],
    });
  }

  return createServiceConfig({
    bookingMode: 'instructor-led',
    startHour: 10,
    endHour: 19,
    intervalMinutes: 45,
    instructors: [['Camila Reed', 'Olivia Stone']],
  });
}

function withServiceDefaults(service) {
  if (!service) {
    return null;
  }

  const fallback = getDefaultServiceConfig(service);
  const plainService = typeof service.toObject === 'function' ? service.toObject() : { ...service };

  return {
    ...plainService,
    price: plainService.price ?? getDefaultServicePrice(plainService),
    capacity:
      isSelfLedService(plainService) && Number(plainService.capacity || 0) <= 12
        ? 60
        : plainService.capacity ?? getDefaultServiceCapacity(plainService),
    bookingMode: plainService.bookingMode || fallback.bookingMode,
    schedule: {
      ...fallback.schedule,
      ...(plainService.schedule || {}),
    },
    locations: Array.isArray(plainService.locations) && plainService.locations.length > 0
      ? plainService.locations.map((location) => ({
          ...location,
          instructors: Array.isArray(location.instructors) ? location.instructors : [],
        }))
      : fallback.locations,
    scheduleOverrides: Array.isArray(plainService.scheduleOverrides) ? plainService.scheduleOverrides : [],
  };
}

function formatTimeLabel(timeValue) {
  const [hourValue, minuteValue] = String(timeValue).split(':').map(Number);
  const period = hourValue >= 12 ? 'PM' : 'AM';
  const normalizedHour = hourValue % 12 === 0 ? 12 : hourValue % 12;
  const paddedMinutes = String(minuteValue).padStart(2, '0');
  return `${normalizedHour}:${paddedMinutes} ${period}`;
}

function buildAppointmentDate(date, time) {
  return new Date(`${date}T${time}:00`);
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isSelfLedService(service) {
  return service?.bookingMode === 'self-led' || String(service?.name || '').toLowerCase().includes('open gym');
}

function isUpcomingAppointment(appointmentDate) {
  return appointmentDate.getTime() > Date.now();
}

function loadDemoState() {
  try {
    if (!fs.existsSync(DEMO_DATA_PATH)) {
      return;
    }

    const raw = fs.readFileSync(DEMO_DATA_PATH, 'utf8');
    if (!raw.trim()) {
      return;
    }

    const data = JSON.parse(raw);
    memoryServices = Array.isArray(data.services) && data.services.length > 0
      ? data.services.map(withServiceDefaults)
      : memoryServices;
    memoryBookings = Array.isArray(data.bookings) ? data.bookings : [];
    memoryUsers = Array.isArray(data.users) ? data.users : [];
    memoryReviews = Array.isArray(data.reviews) ? data.reviews : [];
  } catch (error) {
    console.warn(`Unable to load demo data. Starting with fresh in-memory state. (${error.message})`);
  }
}

function persistDemoState() {
  if (databaseReady) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(DEMO_DATA_PATH), { recursive: true });
    fs.writeFileSync(
      DEMO_DATA_PATH,
      JSON.stringify(
        {
          services: memoryServices,
          bookings: memoryBookings,
          users: memoryUsers,
          reviews: memoryReviews,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.warn(`Unable to persist demo data. (${error.message})`);
  }
}

function generateServiceSlots(serviceInput, date, locationId) {
  const service = withServiceDefaults(serviceInput);
  const schedule = service.schedule;
  const locations = service.locations || [];
  const selectedLocation = locations.find((location) => location.id === locationId) || locations[0];
  const instructors = Array.isArray(selectedLocation?.instructors) ? selectedLocation.instructors : [];
  const slotCount = Math.max(0, ((schedule.endHour - schedule.startHour) * 60) / schedule.intervalMinutes);

  return Array.from({ length: slotCount }, (_, index) => {
    const totalMinutes = schedule.startHour * 60 + index * schedule.intervalMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const matchingOverride = service.scheduleOverrides.find(
      (override) =>
        override.date === date &&
        override.time === time &&
        override.locationId === selectedLocation?.id
    );
    const defaultInstructor =
      service.bookingMode === 'self-led'
        ? ''
        : matchingOverride?.instructorName || instructors[index % Math.max(instructors.length, 1)] || '';

    return {
      time,
      label: formatTimeLabel(time),
      instructorName: defaultInstructor,
      instructorOptions: instructors,
    };
  }).filter((slot) => {
    const appointment = buildAppointmentDate(date, slot.time);
    return !Number.isNaN(appointment.getTime()) && isUpcomingAppointment(appointment);
  });
}

async function listServices(includeInactive = false) {
  if (databaseReady) {
    const query = includeInactive ? {} : { active: true };
    const services = await Service.find(query).sort({ createdAt: 1 });
    return services.map(withServiceDefaults);
  }

  return memoryServices
    .filter((service) => (includeInactive ? true : service.active))
    .map(withServiceDefaults);
}

async function findServiceById(id) {
  return databaseReady
    ? withServiceDefaults(await Service.findById(id))
    : withServiceDefaults(memoryServices.find((service) => service._id === id) || null);
}

async function createService(serviceData) {
  return databaseReady ? withServiceDefaults(await Service.create(serviceData)) : (() => {
    const service = {
      _id: randomUUID(),
      ...serviceData,
      active: serviceData.active ?? true,
    };
    memoryServices.push(service);
    persistDemoState();
    return withServiceDefaults(service);
  })();
}

async function updateServiceById(id, updates) {
  return databaseReady
    ? withServiceDefaults(await Service.findByIdAndUpdate(id, updates, { new: true }))
    : (() => {
        const service = memoryServices.find((item) => item._id === id);
        if (!service) {
          return null;
        }
        Object.assign(service, updates);
        persistDemoState();
        return withServiceDefaults(service);
      })();
}

async function listReviews() {
  return databaseReady
    ? (await Review.find().populate('service').sort({ createdAt: -1 })).map((review) => ({
        ...review.toObject(),
        service: withServiceDefaults(review.service),
      }))
    : [...memoryReviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function findBookingById(id) {
  return databaseReady
    ? (() => Booking.findById(id).populate('service').then((booking) => (
        booking
          ? {
              ...booking.toObject(),
              service: withServiceDefaults(booking.service),
            }
          : null
      )))()
    : memoryBookings.find((booking) => booking._id === id) || null;
}

async function createReview(reviewData) {
  return databaseReady ? Review.create(reviewData) : (() => {
    const review = {
      _id: randomUUID(),
      ...reviewData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryReviews.push(review);
    persistDemoState();
    return review;
  })();
}

async function findReviewByBookingId(bookingId) {
  return databaseReady
    ? Review.findOne({ booking: bookingId }).populate('service')
    : memoryReviews.find((review) => review.booking === bookingId) || null;
}

async function updateBookingById(id, updates) {
  return databaseReady
    ? (() => Booking.findByIdAndUpdate(id, updates, { new: true }).populate('service').then((booking) => (
        booking
          ? {
              ...booking.toObject(),
              service: withServiceDefaults(booking.service),
            }
          : null
      )))()
    : (() => {
        const booking = memoryBookings.find((item) => item._id === id);
        if (!booking) {
          return null;
        }
        Object.assign(booking, updates, { updatedAt: new Date().toISOString() });
        persistDemoState();
        return booking;
      })();
}

function hashPassword(password) {
  const salt = randomUUID();
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalKey] = String(storedHash).split(':');
  if (!salt || !originalKey) {
    return false;
  }

  const candidateKey = scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalKey, 'hex');

  if (candidateKey.length !== originalBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateKey, originalBuffer);
}

function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    membershipNumber: user.membershipNumber,
    membershipActive: user.membershipActive,
  };
}

function hashSessionToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((cookieMap, cookiePair) => {
      const separatorIndex = cookiePair.indexOf('=');
      if (separatorIndex === -1) {
        return cookieMap;
      }

      const key = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();
      cookieMap[key] = decodeURIComponent(value);
      return cookieMap;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  parts.push(`Path=${options.path || '/'}`);

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function setSessionCookie(res, token) {
  res.append('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'None' : 'Lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  }));
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'None' : 'Lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  }));
}

async function createSession(user) {
  const token = randomUUID();
  const sessionUser = sanitizeUser(user);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  if (databaseReady) {
    await Session.create({
      user: sessionUser._id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      lastSeenAt: new Date(),
    });
  } else {
    sessions.set(token, {
      user: sessionUser,
      expiresAt: expiresAt.toISOString(),
    });
  }

  return token;
}

async function findUserByEmail(email) {
  const normalizedEmail = String(email).toLowerCase();
  return databaseReady
    ? User.findOne({ email: normalizedEmail })
    : memoryUsers.find((user) => user.email === normalizedEmail) || null;
}

function normalizeMembershipNumber(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

async function findUserByMembershipNumber(membershipNumber) {
  const normalizedMembershipNumber = normalizeMembershipNumber(membershipNumber);
  if (!normalizedMembershipNumber) {
    return null;
  }

  return databaseReady
    ? User.findOne({ membershipNumber: normalizedMembershipNumber })
    : memoryUsers.find((user) => normalizeMembershipNumber(user.membershipNumber) === normalizedMembershipNumber) || null;
}

async function findUserByIdentifier(identifier) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    return null;
  }

  if (normalizedIdentifier.includes('@')) {
    return findUserByEmail(normalizedIdentifier);
  }

  return findUserByMembershipNumber(normalizedIdentifier);
}

async function generateMembershipNumber() {
  let candidate = '';

  do {
    candidate = `MEM-${Math.floor(100000 + Math.random() * 900000)}`;
  } while (await findUserByMembershipNumber(candidate));

  return candidate;
}

async function findUserById(id) {
  return databaseReady
    ? User.findById(id)
    : memoryUsers.find((user) => user._id === id) || null;
}

async function createUser(userData) {
  return databaseReady ? User.create(userData) : (() => {
    const user = {
      _id: randomUUID(),
      ...userData,
      email: String(userData.email).toLowerCase(),
      membershipNumber: normalizeMembershipNumber(userData.membershipNumber),
      membershipActive: userData.membershipActive ?? true,
    };
    memoryUsers.push(user);
    persistDemoState();
    return user;
  })();
}

async function updateUserById(id, updates) {
  return databaseReady
    ? User.findByIdAndUpdate(id, updates, { new: true })
    : (() => {
        const user = memoryUsers.find((item) => item._id === id);
        if (!user) {
          return null;
        }
        Object.assign(user, updates);
        persistDemoState();
        return user;
      })();
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[SESSION_COOKIE_NAME] || req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'] || '';
}

async function getSessionUser(req) {
  const token = getSessionToken(req);
  if (!token) {
    return null;
  }

  if (databaseReady) {
    const session = await Session.findOne({
      tokenHash: hashSessionToken(token),
      expiresAt: { $gt: new Date() },
    }).populate('user');

    if (!session || !session.user) {
      return null;
    }

    session.lastSeenAt = new Date();
    await session.save();
    return sanitizeUser(session.user);
  }

  const sessionRecord = sessions.get(token);
  if (!sessionRecord) {
    return null;
  }

  if (new Date(sessionRecord.expiresAt).getTime() <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return sessionRecord.user;
}

async function deleteSession(token) {
  if (!token) {
    return;
  }

  if (databaseReady) {
    await Session.deleteOne({ tokenHash: hashSessionToken(token) });
    return;
  }

  sessions.delete(token);
}

async function requireAuth(req, res, next) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    clearSessionCookie(res);
    return res.status(401).json({ message: 'Please log in first.' });
  }

  const fullUser = await findUserById(sessionUser._id);
  if (!fullUser) {
    await deleteSession(getSessionToken(req));
    clearSessionCookie(res);
    return res.status(401).json({ message: 'Your session is no longer valid. Please log in again.' });
  }

  req.user = sanitizeUser(fullUser);
  return next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access is required for this action.' });
  }

  return next();
}

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigin =
    !requestOrigin || corsOrigins.includes(requestOrigin) ? requestOrigin : corsOrigins[0];

  if (allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});
app.use(express.json({ limit: '1mb' }));

async function seedServices() {
  const serviceCount = await Service.countDocuments();

  if (serviceCount === 0) {
    await Service.insertMany(defaultServices);
    console.log('🌱 Seeded starter wellness services');
  }
}

async function seedDemoUsers() {
  if (!SEED_DEMO_USERS) {
    return;
  }

  const existingAdmin = await findUserByEmail(demoAdmin.email);
  if (!existingAdmin) {
    await createUser({
      name: demoAdmin.name,
      email: demoAdmin.email,
      passwordHash: hashPassword(demoAdmin.password),
      role: demoAdmin.role,
      membershipNumber: demoAdmin.membershipNumber,
      membershipActive: true,
    });
    console.log('Seeded demo admin account');
  }

  const existingMember = await findUserByEmail(demoMember.email);
  if (!existingMember) {
    await createUser({
      name: demoMember.name,
      email: demoMember.email,
      passwordHash: hashPassword(demoMember.password),
      role: demoMember.role,
      membershipNumber: demoMember.membershipNumber,
      membershipActive: true,
    });
    console.log('Seeded demo member account');
  }
}

async function seedBootstrapAdmin() {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();

  if (!IS_PRODUCTION || !adminEmail || !adminPassword) {
    return;
  }

  const existingAdmin = await findUserByEmail(adminEmail);
  if (existingAdmin) {
    return;
  }

  await createUser({
    name: String(process.env.ADMIN_NAME || 'Wellness Admin').trim(),
    email: adminEmail,
    passwordHash: hashPassword(adminPassword),
    role: 'admin',
    membershipNumber: normalizeMembershipNumber(process.env.ADMIN_MEMBERSHIP_NUMBER || 'ADMIN-001'),
    membershipActive: true,
  });

  console.log('Seeded production admin account from environment variables');
}

async function connectDatabase() {
  if (!MONGO_URI) {
    if (!ALLOW_DEMO_MODE) {
      throw new Error('MONGO_URI is required when demo mode is disabled.');
    }

    console.warn('MONGO_URI is missing. Starting in demo mode with in-memory data.');
    loadDemoState();
    await seedDemoUsers();
    persistDemoState();
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    databaseReady = true;
    console.log('Connected to Wellness database');
    await seedServices();
    await seedBootstrapAdmin();
    await seedDemoUsers();
  } catch (error) {
    if (!ALLOW_DEMO_MODE) {
      throw new Error(`Database connection failed and demo mode is disabled. (${error.message})`);
    }

    console.warn(`Database connection failed. Starting in demo mode instead. (${error.message})`);
    loadDemoState();
    await seedDemoUsers();
    persistDemoState();
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Wellness backend is running' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    if (String(password).trim().length < 8) {
      return res.status(400).json({ message: 'Your password should be at least 8 characters long.' });
    }

    const membershipNumber = await generateMembershipNumber();

    const newUser = await createUser({
      name: String(name).trim(),
      email: String(email).toLowerCase(),
      passwordHash: hashPassword(String(password).trim()),
      membershipNumber,
      membershipActive: true,
      role: 'user',
    });

    const token = await createSession(newUser);
    setSessionCookie(res, token);
    return res.status(201).json({
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create your account right now.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, email, password } = req.body;
    const loginIdentifier = String(identifier || email || '').trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Email or membership number and password are required.' });
    }

    const user = await findUserByIdentifier(loginIdentifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Incorrect email, membership number, or password.' });
    }

    const token = await createSession(user);
    setSessionCookie(res, token);
    return res.json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to log in right now.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await deleteSession(getSessionToken(req));
    clearSessionCookie(res);
    return res.json({ ok: true });
  } catch (error) {
    clearSessionCookie(res);
    return res.status(500).json({ message: 'Unable to log out right now.' });
  }
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { name, membershipActive, email, currentPassword, newPassword } = req.body;
    const updates = {};

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (req.user.role === 'admin' && typeof membershipActive === 'boolean') {
      updates.membershipActive = membershipActive;
    }

    if (typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== req.user.email) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Please confirm your current password before changing your email.' });
      }

      const existingUser = await findUserByEmail(email);
      if (existingUser && String(existingUser._id) !== String(req.user._id)) {
        return res.status(409).json({ message: 'That email is already being used by another account.' });
      }

      const fullUser = await findUserById(req.user._id);
      if (!fullUser || !verifyPassword(currentPassword, fullUser.passwordHash)) {
        return res.status(401).json({ message: 'Your current password is incorrect.' });
      }

      updates.email = email.trim().toLowerCase();
    }

    if (typeof newPassword === 'string' && newPassword.trim()) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Please confirm your current password before setting a new one.' });
      }

      const fullUser = await findUserById(req.user._id);
      if (!fullUser || !verifyPassword(currentPassword, fullUser.passwordHash)) {
        return res.status(401).json({ message: 'Your current password is incorrect.' });
      }

      if (newPassword.trim().length < 8) {
        return res.status(400).json({ message: 'Your new password should be at least 8 characters long.' });
      }

      updates.passwordHash = hashPassword(newPassword.trim());
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Please provide at least one profile change.' });
    }

    const updatedUser = await updateUserById(req.user._id, updates);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    const token = getSessionToken(req);
    if (token && !databaseReady && sessions.has(token)) {
      const existingSession = sessions.get(token);
      sessions.set(token, {
        ...existingSession,
        user: sanitizeUser(updatedUser),
      });
    }

    return res.json({ user: sanitizeUser(updatedUser) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update your profile right now.' });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await listServices(false);
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load services right now.' });
  }
});

app.get('/api/services/:id/availability', async (req, res) => {
  try {
    const { date, locationId } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Please choose a date first.' });
    }

    const service = await findServiceById(req.params.id);
    if (!service || !service.active) {
      return res.status(404).json({ message: 'Selected service was not found.' });
    }

    const slots = generateServiceSlots(service, String(date), String(locationId || ''));
    return res.json({
      serviceId: service._id,
      bookingMode: service.bookingMode,
      locations: service.locations,
      slots,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load service availability right now.' });
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await listReviews();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load reviews right now.' });
  }
});

app.get('/api/admin/services', requireAuth, requireAdmin, async (req, res) => {
  try {
    const services = await listServices(true);
    res.json(services);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load services right now.' });
  }
});

app.post('/api/admin/services', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, durationMinutes, category, capacity, price } = req.body;

    if (!name || !description || !durationMinutes || !category || !capacity || price === undefined) {
      return res.status(400).json({ message: 'All service fields are required.' });
    }

    const parsedDuration = Number(durationMinutes);
    const parsedCapacity = Number(capacity);
    const parsedPrice = Number(price);

    if (
      !Number.isFinite(parsedDuration) ||
      parsedDuration < 15 ||
      !Number.isFinite(parsedCapacity) ||
      parsedCapacity < 1 ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      return res.status(400).json({ message: 'Duration, capacity, and price must be valid positive values.' });
    }

    const defaults = getDefaultServiceConfig({ name, category });
    const service = await createService({
      name: String(name).trim(),
      description: String(description).trim(),
      durationMinutes: parsedDuration,
      category: String(category).trim(),
      capacity: parsedCapacity,
      price: parsedPrice,
      bookingMode: defaults.bookingMode,
      schedule: defaults.schedule,
      locations: defaults.locations,
      scheduleOverrides: [],
      active: true,
    });

    return res.status(201).json(service);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create the service right now.' });
  }
});

app.patch('/api/admin/services/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, durationMinutes, category, capacity, price, active, bookingMode, schedule, locations } = req.body;
    const updates = {};

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof description === 'string' && description.trim()) {
      updates.description = description.trim();
    }

    if (typeof category === 'string' && category.trim()) {
      updates.category = category.trim();
    }

    if (durationMinutes !== undefined) {
      const parsedDuration = Number(durationMinutes);
      if (!Number.isFinite(parsedDuration) || parsedDuration < 15) {
        return res.status(400).json({ message: 'Duration must be at least 15 minutes.' });
      }
      updates.durationMinutes = parsedDuration;
    }

    if (capacity !== undefined) {
      const parsedCapacity = Number(capacity);
      if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
        return res.status(400).json({ message: 'Capacity must be at least 1.' });
      }
      updates.capacity = parsedCapacity;
    }

    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ message: 'Price must be a valid amount.' });
      }
      updates.price = parsedPrice;
    }

    if (typeof active === 'boolean') {
      updates.active = active;
    }

    if (typeof bookingMode === 'string' && ['self-led', 'instructor-led'].includes(bookingMode)) {
      updates.bookingMode = bookingMode;
    }

    if (schedule && typeof schedule === 'object') {
      updates.schedule = {
        startHour: Number(schedule.startHour),
        endHour: Number(schedule.endHour),
        intervalMinutes: Number(schedule.intervalMinutes),
      };
    }

    if (Array.isArray(locations)) {
      updates.locations = locations.map((location) => ({
        id: String(location.id),
        name: String(location.name),
        address: String(location.address),
        instructors: Array.isArray(location.instructors) ? location.instructors.map((item) => String(item).trim()).filter(Boolean) : [],
      }));
    }

    const updatedService = await updateServiceById(req.params.id, updates);
    if (!updatedService) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    return res.json(updatedService);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update the service right now.' });
  }
});

app.post('/api/admin/services/:id/overrides', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { date, time, locationId, instructorName } = req.body;
    if (!date || !time || !locationId || !instructorName) {
      return res.status(400).json({ message: 'Date, time, location, and instructor are required.' });
    }

    const service = databaseReady ? await Service.findById(req.params.id) : memoryServices.find((item) => item._id === req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const shapedService = withServiceDefaults(service);
    const location = shapedService.locations.find((item) => item.id === locationId);
    if (!location) {
      return res.status(404).json({ message: 'Location not found for this service.' });
    }

    if (!location.instructors.includes(instructorName)) {
      return res.status(400).json({ message: 'That instructor is not assigned to the selected location.' });
    }

    const allowedTimes = generateServiceSlots(shapedService, String(date), locationId).map((slot) => slot.time);
    if (!allowedTimes.includes(time)) {
      return res.status(400).json({ message: 'That time is not available for this service schedule.' });
    }

    const override = {
      id: randomUUID(),
      date: String(date),
      time: String(time),
      locationId: String(locationId),
      instructorName: String(instructorName).trim(),
    };

    const existingOverrides = Array.isArray(service.scheduleOverrides) ? service.scheduleOverrides : [];
    const filteredOverrides = existingOverrides.filter(
      (item) => !(item.date === override.date && item.time === override.time && item.locationId === override.locationId)
    );
    filteredOverrides.push(override);

    const updatedService = await updateServiceById(req.params.id, { scheduleOverrides: filteredOverrides });
    return res.json(updatedService);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save the instructor override right now.' });
  }
});

app.delete('/api/admin/services/:id/overrides/:overrideId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const service = databaseReady ? await Service.findById(req.params.id) : memoryServices.find((item) => item._id === req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const existingOverrides = Array.isArray(service.scheduleOverrides) ? service.scheduleOverrides : [];
    const nextOverrides = existingOverrides.filter((item) => item.id !== req.params.overrideId);
    const updatedService = await updateServiceById(req.params.id, { scheduleOverrides: nextOverrides });
    return res.json(updatedService);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to remove that override right now.' });
  }
});

app.patch('/api/admin/services/:id/deactivate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updatedService = await updateServiceById(req.params.id, { active: false });
    if (!updatedService) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    return res.json(updatedService);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to deactivate the service right now.' });
  }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { email: req.user.email };
    const bookings = databaseReady
      ? (await Booking.find(query).populate('service').sort({ appointmentDate: 1, createdAt: -1 })).map((booking) => ({
          ...booking.toObject(),
          service: withServiceDefaults(booking.service),
        }))
      : memoryBookings
          .filter((booking) => (req.user.role === 'admin' ? true : booking.email === req.user.email))
          .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load bookings right now.' });
  }
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  try {
    const {
      serviceId,
      bookingDate,
      slotTime,
      locationId,
      instructorName = '',
      notes = '',
      paymentCardholderName = '',
      paymentCardNumber = '',
      creditBookingId = '',
    } = req.body;

    if (!req.user.membershipActive) {
      return res.status(403).json({ message: 'Your membership is inactive. Please contact the wellness center.' });
    }

    if (!serviceId || !bookingDate || !slotTime || !locationId) {
      return res.status(400).json({ message: 'Please choose a service, location, and time.' });
    }

    const service = await findServiceById(serviceId);
    if (!service || !service.active) {
      return res.status(404).json({ message: 'Selected service was not found.' });
    }

    const location = service.locations.find((item) => item.id === locationId);
    if (!location) {
      return res.status(404).json({ message: 'Selected location was not found for this service.' });
    }

    const validSlots = generateServiceSlots(service, String(bookingDate), locationId);
    const selectedSlot = validSlots.find((slot) => slot.time === slotTime);
    if (!selectedSlot) {
      return res.status(400).json({ message: 'That class time is not available for the selected service.' });
    }

    if (service.bookingMode === 'instructor-led') {
      const validInstructorNames = selectedSlot.instructorOptions;
      if (!instructorName || !validInstructorNames.includes(instructorName)) {
        return res.status(400).json({ message: 'Please choose a valid instructor for this class.' });
      }
    }

    const appointment = buildAppointmentDate(bookingDate, slotTime);
    if (Number.isNaN(appointment.getTime())) {
      return res.status(400).json({ message: 'Appointment date is invalid.' });
    }

    if (!isUpcomingAppointment(appointment)) {
      return res.status(400).json({ message: 'Please choose an upcoming class time.' });
    }

    const startWindow = new Date(appointment);

    const overlappingApprovedOrPending = databaseReady
      ? await Booking.countDocuments({
          service: service._id,
          locationId,
          status: { $in: ['Pending', 'Approved'] },
          appointmentDate: startWindow,
        })
      : memoryBookings.filter((booking) => {
          const bookingDateTime = new Date(booking.appointmentDate);
          return (
            String(booking.service._id || booking.service) === String(service._id) &&
            booking.locationId === locationId &&
            ['Pending', 'Approved'].includes(booking.status) &&
            bookingDateTime.getTime() === startWindow.getTime()
          );
        }).length;

    if (overlappingApprovedOrPending >= service.capacity) {
      return res.status(409).json({
        message: 'That time slot is currently full. Please choose another time.',
      });
    }

    const normalizedCreditBookingId = String(creditBookingId || '').trim();
    const normalizedCardholder = String(paymentCardholderName).trim();
    const digitsOnlyCardNumber = String(paymentCardNumber).replace(/\D/g, '');
    let paymentStatus = 'Paid';
    let paymentAmount = Number(service.price || 0);
    let paymentLast4 = '';
    let creditSourceBooking = null;

    if (normalizedCreditBookingId) {
      creditSourceBooking = await findBookingById(normalizedCreditBookingId);

      if (!creditSourceBooking) {
        return res.status(404).json({ message: 'The open gym credit could not be found.' });
      }

      if (req.user.role !== 'admin' && creditSourceBooking.email !== req.user.email) {
        return res.status(403).json({ message: 'You can only use your own open gym credit.' });
      }

      if (!isSelfLedService(service) || !isSelfLedService(creditSourceBooking.service)) {
        return res.status(400).json({ message: 'Credits can only be applied to open gym sessions.' });
      }

      if (String(creditSourceBooking.service?._id || creditSourceBooking.service) !== String(service._id)) {
        return res.status(400).json({ message: 'This credit can only be used for another open gym session.' });
      }

      if (creditSourceBooking.attendanceStatus !== 'No-show' || !creditSourceBooking.creditEligible) {
        return res.status(400).json({ message: 'That booking does not have an available reschedule credit.' });
      }

      if (creditSourceBooking.creditRedeemedForBookingId) {
        return res.status(400).json({ message: 'That credit has already been used.' });
      }

      paymentStatus = 'Credit Applied';
      paymentLast4 = creditSourceBooking.paymentLast4 || '';
    } else {
      if (!normalizedCardholder || digitsOnlyCardNumber.length < 12) {
        return res.status(400).json({
          message: 'Please enter a cardholder name and a valid card number to complete checkout.',
        });
      }

      paymentLast4 = digitsOnlyCardNumber.slice(-4);
    }

    const populatedBooking = databaseReady
      ? await (async () => {
          const booking = await Booking.create({
            clientName: req.user.name,
            email: req.user.email,
            membershipNumber: req.user.membershipNumber,
            service: service._id,
            locationId: location.id,
            locationName: location.name,
            locationAddress: location.address,
            instructorName: service.bookingMode === 'self-led' ? '' : instructorName,
            slotTime,
            appointmentDate: appointment,
            status: 'Approved',
            attendanceStatus: 'Scheduled',
            notes,
            paymentStatus,
            paymentAmount,
            paymentCardholderName: '',
            paymentLast4,
            paidAt: new Date(),
            noShowFeeAmount: 0,
            creditEligible: false,
            creditSourceBookingId: normalizedCreditBookingId,
            creditRedeemedForBookingId: '',
            attendanceMarkedAt: null,
          });

          if (creditSourceBooking) {
            await Booking.findByIdAndUpdate(creditSourceBooking._id, {
              creditEligible: false,
              creditRedeemedForBookingId: String(booking._id),
            });
          }

          const populated = await booking.populate('service');
          return {
            ...populated.toObject(),
            service: withServiceDefaults(populated.service),
          };
        })()
      : (() => {
          const booking = {
            _id: randomUUID(),
            clientName: req.user.name,
            email: req.user.email,
            membershipNumber: req.user.membershipNumber,
            service,
            locationId: location.id,
            locationName: location.name,
            locationAddress: location.address,
            instructorName: service.bookingMode === 'self-led' ? '' : instructorName,
            slotTime,
            appointmentDate: appointment.toISOString(),
            status: 'Approved',
            attendanceStatus: 'Scheduled',
            notes,
            paymentStatus,
            paymentAmount,
            paymentCardholderName: '',
            paymentLast4,
            paidAt: new Date().toISOString(),
            noShowFeeAmount: 0,
            creditEligible: false,
            creditSourceBookingId: normalizedCreditBookingId,
            creditRedeemedForBookingId: '',
            attendanceMarkedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (creditSourceBooking) {
            creditSourceBooking.creditEligible = false;
            creditSourceBooking.creditRedeemedForBookingId = booking._id;
            creditSourceBooking.updatedAt = new Date().toISOString();
          }
          memoryBookings.push(booking);
          persistDemoState();
          return booking;
        })();

    return res.status(201).json(populatedBooking);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create booking right now.' });
  }
});

app.patch('/api/admin/requests/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['Approved', 'Rejected', 'Cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved, Rejected, or Cancelled.' });
    }

    const updatedBooking = databaseReady
      ? (() => Booking.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('service').then((booking) => (
          booking
            ? {
                ...booking.toObject(),
                service: withServiceDefaults(booking.service),
              }
            : null
        )))()
      : (() => {
          const booking = memoryBookings.find((item) => item._id === req.params.id);
          if (!booking) {
            return null;
          }
          booking.status = status;
          persistDemoState();
          return booking;
        })();

    if (!updatedBooking) {
      return res.status(404).json({ message: 'Booking request not found.' });
    }

    return res.json(updatedBooking);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update booking status right now.' });
  }
});

app.patch('/api/admin/bookings/:id/attendance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { attendanceStatus } = req.body;

    if (!['Attended', 'No-show'].includes(attendanceStatus)) {
      return res.status(400).json({ message: 'Attendance status must be Attended or No-show.' });
    }

    const booking = await findBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (booking.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cancelled bookings cannot be marked for attendance.' });
    }

    const appointmentDate = new Date(booking.appointmentDate);
    if (Number.isNaN(appointmentDate.getTime()) || isUpcomingAppointment(appointmentDate)) {
      return res.status(400).json({ message: 'Attendance can only be marked after the class start time.' });
    }

    const isOpenGym = isSelfLedService(booking.service);
    const updates = {
      attendanceStatus,
      attendanceMarkedAt: new Date(),
      noShowFeeAmount: 0,
      creditEligible: false,
    };

    if (attendanceStatus === 'No-show') {
      if (isOpenGym) {
        updates.creditEligible = true;
        updates.noShowFeeAmount = 0;
      } else {
        updates.noShowFeeAmount = roundCurrency(Number(booking.paymentAmount || booking.service?.price || 0) * 0.2);
      }
    }

    const updatedBooking = await updateBookingById(req.params.id, updates);
    return res.json(updatedBooking);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update attendance right now.' });
  }
});

app.patch('/api/bookings/:id/cancel', requireAuth, async (req, res) => {
  try {
    let booking;

    if (databaseReady) {
      const existingBooking = await Booking.findById(req.params.id).populate('service');
      if (!existingBooking) {
        return res.status(404).json({ message: 'Booking request not found.' });
      }

      if (req.user.role !== 'admin' && existingBooking.email !== req.user.email) {
        return res.status(403).json({ message: 'You can only cancel your own bookings.' });
      }

      if (req.user.role !== 'admin' && !isUpcomingAppointment(new Date(existingBooking.appointmentDate))) {
        return res.status(400).json({ message: 'This class has already started, so it can no longer be cancelled.' });
      }

      if (existingBooking.status === 'Cancelled') {
        return res.status(400).json({ message: 'This booking is already cancelled.' });
      }

      existingBooking.status = 'Cancelled';
      await existingBooking.save();
      booking = {
        ...existingBooking.toObject(),
        service: withServiceDefaults(existingBooking.service),
      };
    } else {
      booking = memoryBookings.find((item) => item._id === req.params.id);
      if (!booking) {
        return res.status(404).json({ message: 'Booking request not found.' });
      }

      if (req.user.role !== 'admin' && booking.email !== req.user.email) {
        return res.status(403).json({ message: 'You can only cancel your own bookings.' });
      }

      if (req.user.role !== 'admin' && !isUpcomingAppointment(new Date(booking.appointmentDate))) {
        return res.status(400).json({ message: 'This class has already started, so it can no longer be cancelled.' });
      }

      if (booking.status === 'Cancelled') {
        return res.status(400).json({ message: 'This booking is already cancelled.' });
      }

      booking.status = 'Cancelled';
      persistDemoState();
    }

    return res.json(booking);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to cancel this booking right now.' });
  }
});

app.post('/api/reviews', requireAuth, async (req, res) => {
  try {
    const { bookingId, rating, comment = '' } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({ message: 'Booking and rating are required.' });
    }

    const booking = await findBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (req.user.role !== 'admin' && booking.email !== req.user.email) {
      return res.status(403).json({ message: 'You can only review your own bookings.' });
    }

    const appointmentDate = new Date(booking.appointmentDate);
    if (appointmentDate > new Date()) {
      return res.status(400).json({ message: 'You can only review services after the appointment date.' });
    }

    const existingReview = await findReviewByBookingId(bookingId);
    if (existingReview) {
      return res.status(409).json({ message: 'A review already exists for this booking.' });
    }

    const review = await createReview({
      booking: databaseReady ? booking._id : booking._id,
      service: databaseReady ? booking.service._id : booking.service,
      userEmail: req.user.email,
      userName: req.user.name,
      rating: Number(rating),
      comment: String(comment).trim(),
    });

    if (databaseReady) {
      const populatedReview = await Review.findById(review._id).populate('service');
      return res.status(201).json({
        ...populatedReview.toObject(),
        service: withServiceDefaults(populatedReview.service),
      });
    }

    const service = memoryServices.find((item) => item._id === booking.service._id) || booking.service;
    return res.status(201).json({
      ...review,
      service,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save your review right now.' });
  }
});

connectDatabase()
  .then(() => {
    server.listen(PORT, HOST, () => {
      const mode = databaseReady ? 'database' : 'demo';
      console.log(`Wellness backend running at http://${HOST}:${PORT} (${mode} mode)`);
    });
  })
  .catch((error) => {
    console.error(`Unable to start the wellness backend. ${error.message}`);
    process.exit(1);
  });
