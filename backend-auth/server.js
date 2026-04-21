const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
const { randomUUID, scryptSync, timingSafeEqual, createHash } = require('crypto');
require('dotenv').config();
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const User = require('./models/User');
const Review = require('./models/Review');
const Instructor = require('./models/Instructor');
const Session = require('./models/Session');
const AuthToken = require('./models/AuthToken');
const { getAppBaseUrl, sendAppEmail } = require('./lib/mailer');
const {
  roundCurrency,
  buildAppointmentDate,
  isSelfLedService,
  isUpcomingAppointment,
  calculateNoShowOutcome,
} = require('./lib/business-rules');
const {
  isValidDateInput,
  validateRegisterPayload,
  validateLoginPayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
  validateProfilePayload,
  validateServicePayload,
  validateInstructorPayload,
  validateAdminUserPayload,
  validateOverridePayload,
  validateBookingPayload,
  validateReviewPayload,
} = require('./lib/validation');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || (IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1');
const ALLOW_DEMO_MODE = process.env.ALLOW_DEMO_MODE === 'true' || !IS_PRODUCTION;
const SEED_DEMO_USERS = process.env.SEED_DEMO_USERS === 'true' || !IS_PRODUCTION;
const SESSION_COOKIE_NAME = 'wellness_session';
const CSRF_COOKIE_NAME = 'wellness_csrf';
const SESSION_DURATION_DAYS = Math.max(1, Number(process.env.SESSION_DURATION_DAYS || 7));
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const DEMO_DATA_PATH = path.join(__dirname, 'data', 'demo-data.json');
const defaultCorsOrigins = [
  'https://www.wellnesscenterstudio.com',
  'https://wellnesscenterstudio.com',
  'https://wellness-frontend-jge3.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const corsOrigins = Array.from(
  new Set([
    ...defaultCorsOrigins,
    ...(process.env.CORS_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ])
);

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
    id: 'alpharetta',
    name: 'Alpharetta',
    address: '2200 Avalon Boulevard, Alpharetta, GA 30009',
  },
];
const validStudioLocationIds = new Set(studioLocations.map((location) => location.id));

function isLiveStudioLocationId(locationId) {
  return validStudioLocationIds.has(String(locationId || ''));
}

function slugifyInstructorName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function minutesToTimeValue(totalMinutes) {
  const safeMinutes = Math.max(0, Math.min(totalMinutes, (23 * 60) + 59));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeValueToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.NaN;
  }

  return (hours * 60) + minutes;
}

function getInstructorTitleForService(service) {
  const normalizedName = String(service?.name || '').toLowerCase();
  const normalizedCategory = String(service?.category || '').toLowerCase();

  if (normalizedName.includes('pilates')) {
    return 'Pilates Instructor';
  }

  if (normalizedCategory.includes('massage')) {
    return 'Massage Therapist';
  }

  if (normalizedCategory.includes('spa')) {
    return 'Spa Specialist';
  }

  return 'Wellness Coach';
}

function getInstructorBioForService(name, service) {
  if (String(service?.name || '').toLowerCase().includes('pilates')) {
    return `${name} leads mindful movement sessions with a focus on clean form, strength, and studio calm.`;
  }

  if (String(service?.category || '').toLowerCase().includes('massage')) {
    return `${name} creates restorative bodywork sessions centered on recovery, stress relief, and thoughtful care.`;
  }

  if (String(service?.category || '').toLowerCase().includes('spa')) {
    return `${name} guides spa guests through a warm, grounding wellness ritual with elevated service and attention to detail.`;
  }

  return `${name} supports members with a welcoming, polished studio experience and dependable class coverage.`;
}

function withInstructorDefaults(instructor) {
  if (!instructor) {
    return null;
  }

  const plainInstructor = typeof instructor.toObject === 'function' ? instructor.toObject() : { ...instructor };
  const weeklyAvailability = Array.isArray(plainInstructor.weeklyAvailability)
    ? plainInstructor.weeklyAvailability
        .map((block) => ({
          dayOfWeek: Number(block.dayOfWeek),
          locationId: String(block.locationId),
          startTime: String(block.startTime),
          endTime: String(block.endTime),
        }))
        .filter((block) => isLiveStudioLocationId(block.locationId))
    : [];
  const locationIds = Array.from(
    new Set([
      ...(Array.isArray(plainInstructor.locationIds) ? plainInstructor.locationIds.map((item) => String(item)) : []),
      ...weeklyAvailability.map((block) => String(block.locationId)),
    ].filter(isLiveStudioLocationId))
  );

  return {
    ...plainInstructor,
    email: String(plainInstructor.email || '').trim().toLowerCase(),
    active: plainInstructor.active !== false,
    serviceIds: Array.isArray(plainInstructor.serviceIds) ? plainInstructor.serviceIds.map((item) => String(item)) : [],
    locationIds,
    weeklyAvailability,
  };
}

function sanitizeInstructorForLiveLocations(instructorData) {
  const weeklyAvailability = Array.isArray(instructorData.weeklyAvailability)
    ? instructorData.weeklyAvailability.filter((block) => isLiveStudioLocationId(block.locationId))
    : [];
  const locationIds = Array.from(
    new Set([
      ...(Array.isArray(instructorData.locationIds) ? instructorData.locationIds : []),
      ...weeklyAvailability.map((block) => block.locationId),
    ].map((locationId) => String(locationId)).filter(isLiveStudioLocationId))
  );

  return {
    ...instructorData,
    locationIds,
    weeklyAvailability,
  };
}

function buildDefaultInstructorSeed(services = []) {
  const instructorMap = new Map();

  services
    .map((service) => withServiceDefaults(service))
    .filter((service) => service && !isSelfLedService(service))
    .forEach((service) => {
      service.locations.forEach((location) => {
        (location.instructors || []).forEach((name) => {
          const trimmedName = String(name || '').trim();
          if (!trimmedName) {
            return;
          }

          const slug = slugifyInstructorName(trimmedName);
          const existingInstructor = instructorMap.get(slug) || {
            name: trimmedName,
            title: getInstructorTitleForService(service),
            email: `${slug}@wellnessstudio.demo`,
            phone: `404-555-${String(instructorMap.size + 101).slice(-4)}`,
            bio: getInstructorBioForService(trimmedName, service),
            active: true,
            serviceIds: new Set(),
            locationIds: new Set(),
            weeklyAvailabilityByLocation: new Map(),
          };

          existingInstructor.serviceIds.add(String(service._id));
          existingInstructor.locationIds.add(location.id);

          const currentWindow = existingInstructor.weeklyAvailabilityByLocation.get(location.id) || {
            startMinutes: Number(service.schedule?.startHour || 6) * 60,
            endMinutes: Math.min(Number(service.schedule?.endHour || 20) * 60, (23 * 60) + 59),
          };

          currentWindow.startMinutes = Math.min(
            currentWindow.startMinutes,
            Number(service.schedule?.startHour || 6) * 60
          );
          currentWindow.endMinutes = Math.max(
            currentWindow.endMinutes,
            Math.min(Number(service.schedule?.endHour || 20) * 60, (23 * 60) + 59)
          );

          existingInstructor.weeklyAvailabilityByLocation.set(location.id, currentWindow);
          instructorMap.set(slug, existingInstructor);
        });
      });
    });

  return Array.from(instructorMap.values()).map((instructor) => ({
    name: instructor.name,
    title: instructor.title,
    email: instructor.email,
    phone: instructor.phone,
    bio: instructor.bio,
    active: instructor.active,
    serviceIds: Array.from(instructor.serviceIds),
    locationIds: Array.from(instructor.locationIds),
    weeklyAvailability: Array.from(instructor.weeklyAvailabilityByLocation.entries()).flatMap(
      ([locationId, window]) =>
        [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
          dayOfWeek,
          locationId,
          startTime: minutesToTimeValue(window.startMinutes),
          endTime: minutesToTimeValue(window.endMinutes),
        }))
    ),
  }));
}

function createMemoryInstructorRecord(instructorData) {
  return {
    _id: randomUUID(),
    ...instructorData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getAssignedInstructorRecords(service, locationId, instructorDirectory = []) {
  const serviceId = String(service?._id || '');
  if (!serviceId || !locationId) {
    return [];
  }

  return instructorDirectory.filter(
    (instructor) =>
      instructor.active !== false &&
      instructor.serviceIds.includes(serviceId) &&
      instructor.locationIds.includes(String(locationId))
  );
}

function isInstructorAvailableForSlot(instructor, date, locationId, time) {
  const slotDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(slotDate.getTime())) {
    return false;
  }

  const dayOfWeek = slotDate.getDay();
  const slotMinutes = timeValueToMinutes(time);

  return instructor.weeklyAvailability.some((block) => {
    if (Number(block.dayOfWeek) !== dayOfWeek || String(block.locationId) !== String(locationId)) {
      return false;
    }

    const startMinutes = timeValueToMinutes(block.startTime);
    const endMinutes = timeValueToMinutes(block.endTime);
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  });
}

function withInstructorAssignments(service, instructorDirectory = []) {
  const shapedService = withServiceDefaults(service);
  if (!shapedService) {
    return null;
  }

  return {
    ...shapedService,
    locations: shapedService.locations.map((location) => {
      const assignedInstructorNames = getAssignedInstructorRecords(
        shapedService,
        location.id,
        instructorDirectory
      )
        .map((instructor) => instructor.name)
        .sort((left, right) => left.localeCompare(right));

      return {
        ...location,
        instructors:
          assignedInstructorNames.length > 0
            ? assignedInstructorNames
            : Array.isArray(location.instructors)
              ? location.instructors
              : [],
      };
    }),
  };
}

function createLocations(locationProfiles = [], bookingMode = 'instructor-led') {
  return studioLocations.map((location, index) => {
    const profile = locationProfiles[index] || {};
    return {
      ...location,
      instructors: Array.isArray(profile.instructors) ? profile.instructors : [],
      timeSlots:
        bookingMode === 'self-led'
          ? []
          : Array.isArray(profile.timeSlots)
            ? profile.timeSlots
            : [],
    };
  });
}

function createServiceConfig({ bookingMode, startHour, endHour, intervalMinutes, locationProfiles = [] }) {
  return {
    bookingMode,
    schedule: { startHour, endHour, intervalMinutes },
    locations: createLocations(locationProfiles, bookingMode),
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
      locationProfiles: [
        { instructors: ['Ashley Monroe', 'Maria Torres'], timeSlots: ['06:30', '12:00', '18:00'] },
        { instructors: ['Ashley Monroe', 'Nina Brooks'], timeSlots: ['07:00', '12:30', '17:30'] },
        { instructors: ['Maria Torres', 'Leah Bryant'], timeSlots: ['06:00', '10:30', '18:30'] },
        { instructors: ['Leah Bryant', 'Sofia Bennett'], timeSlots: ['07:30', '13:00'] },
        { instructors: ['Nina Brooks', 'Maria Torres'], timeSlots: ['06:30', '11:30', '17:00'] },
        { instructors: ['Ashley Monroe', 'Sofia Bennett'], timeSlots: ['08:00', '12:00', '17:00'] },
        { instructors: ['Leah Bryant', 'Nina Brooks'], timeSlots: ['07:00', '16:30'] },
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
      locationProfiles: [
        { instructors: ['Jasmine Cole', 'Elena Hart'], timeSlots: ['09:00', '13:00', '17:00'] },
        { instructors: ['Jasmine Cole', 'Riley Scott'], timeSlots: ['10:00', '14:00'] },
        { instructors: ['Elena Hart', 'Ava Coleman'], timeSlots: ['09:30', '12:30', '16:30'] },
        { instructors: ['Riley Scott', 'Jasmine Cole'], timeSlots: ['11:00', '15:00'] },
        { instructors: ['Ava Coleman', 'Elena Hart'], timeSlots: ['09:00', '13:30'] },
        { instructors: ['Riley Scott', 'Ava Coleman'], timeSlots: ['10:30', '16:00'] },
        { instructors: ['Jasmine Cole', 'Elena Hart'], timeSlots: ['09:00', '12:00', '15:30'] },
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
      locationProfiles: [
        { instructors: ['Camila Reed', 'Olivia Stone'], timeSlots: ['10:00', '14:00'] },
        { instructors: ['Olivia Stone', 'Mia Larson'], timeSlots: ['11:00', '15:00'] },
        { instructors: ['Camila Reed', 'Mia Larson'], timeSlots: ['10:30', '16:00'] },
        { instructors: ['Olivia Stone', 'Zoe Harper'], timeSlots: ['12:00', '17:00'] },
        { instructors: ['Zoe Harper', 'Camila Reed'], timeSlots: ['10:00', '13:30'] },
        { instructors: ['Mia Larson', 'Olivia Stone'], timeSlots: ['11:30', '16:30'] },
        { instructors: ['Camila Reed', 'Zoe Harper'], timeSlots: ['10:30', '15:30'] },
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
      locationProfiles: [],
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
let memoryInstructors = buildDefaultInstructorSeed(memoryServices).map(createMemoryInstructorRecord);
let memoryBookings = [];
let memoryUsers = [];
let memoryReviews = [];
let memoryAuthTokens = [];

app.disable('x-powered-by');
app.set('trust proxy', IS_PRODUCTION ? 1 : 0);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Please wait a few minutes and try again.' },
});

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many booking actions right now. Please slow down and try again shortly.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many admin actions right now. Please wait and try again.' },
});

function getDefaultServiceConfig(service) {
  if (String(service?.name).toLowerCase().includes('gym')) {
    return createServiceConfig({
      bookingMode: 'self-led',
      startHour: 6,
      endHour: 24,
      intervalMinutes: 30,
      locationProfiles: [],
    });
  }

  if (String(service?.name).toLowerCase().includes('pilates')) {
    return createServiceConfig({
      bookingMode: 'instructor-led',
      startHour: 6,
      endHour: 20,
      intervalMinutes: 90,
      locationProfiles: studioLocations.map((location, index) => ({
        instructors: index % 2 === 0 ? ['Ashley Monroe', 'Maria Torres'] : ['Leah Bryant', 'Nina Brooks'],
        timeSlots: index % 3 === 0 ? ['06:30', '12:00', '18:00'] : ['07:00', '13:00'],
      })),
    });
  }

  if (String(service?.category).toLowerCase().includes('massage')) {
    return createServiceConfig({
      bookingMode: 'instructor-led',
      startHour: 9,
      endHour: 18,
      intervalMinutes: 60,
      locationProfiles: studioLocations.map((location, index) => ({
        instructors: index % 2 === 0 ? ['Jasmine Cole', 'Elena Hart'] : ['Riley Scott', 'Ava Coleman'],
        timeSlots: index % 2 === 0 ? ['09:00', '13:00', '17:00'] : ['10:00', '15:00'],
      })),
    });
  }

  return createServiceConfig({
    bookingMode: 'instructor-led',
    startHour: 10,
    endHour: 19,
    intervalMinutes: 45,
    locationProfiles: studioLocations.map((location, index) => ({
      instructors: index % 2 === 0 ? ['Camila Reed', 'Olivia Stone'] : ['Mia Larson', 'Zoe Harper'],
      timeSlots: index % 2 === 0 ? ['10:00', '14:00'] : ['11:00', '16:00'],
    })),
  });
}

function buildLocationTimeValues(service, selectedLocation) {
  if (!service || !selectedLocation) {
    return [];
  }

  const locationSpecificTimes = Array.isArray(selectedLocation.timeSlots)
    ? selectedLocation.timeSlots
        .map((value) => String(value || '').trim())
        .filter((value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value))
    : [];

  if (service.bookingMode !== 'self-led' && locationSpecificTimes.length > 0) {
    return locationSpecificTimes;
  }

  const schedule = service.schedule || {};
  const slotCount = Math.max(
    0,
    ((Number(schedule.endHour || 0) - Number(schedule.startHour || 0)) * 60) /
      Number(schedule.intervalMinutes || 60)
  );

  return Array.from({ length: slotCount }, (_, index) => {
    const totalMinutes =
      Number(schedule.startHour || 0) * 60 + index * Number(schedule.intervalMinutes || 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  });
}

function getOrderedAvailableInstructorNames(selectedLocation, assignedInstructorRecords, date, time) {
  const availableInstructorNames = assignedInstructorRecords
    .filter((instructor) => isInstructorAvailableForSlot(instructor, date, selectedLocation?.id, time))
    .map((instructor) => instructor.name);

  const locationInstructorOrder = Array.isArray(selectedLocation?.instructors)
    ? selectedLocation.instructors.map((name) => String(name))
    : [];

  const orderedByLocation = locationInstructorOrder.filter((name) => availableInstructorNames.includes(name));
  const remainingNames = availableInstructorNames.filter((name) => !orderedByLocation.includes(name));
  return [...orderedByLocation, ...remainingNames];
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
      ? (() => {
          const allowedLocationIds = new Set(studioLocations.map((location) => location.id));
          const fallbackLocationsById = new Map(
            fallback.locations.map((location) => [location.id, location])
          );
          const normalizedLocations = plainService.locations
            .filter((location) => allowedLocationIds.has(String(location.id || '')))
            .map((location) => {
              const fallbackLocation = fallbackLocationsById.get(location.id) || {};
              return {
                ...fallbackLocation,
                ...location,
                instructors:
                  Array.isArray(location.instructors) && location.instructors.length > 0
                    ? location.instructors
                    : Array.isArray(fallbackLocation.instructors)
                      ? fallbackLocation.instructors
                      : [],
                timeSlots:
                  Array.isArray(location.timeSlots) && location.timeSlots.length > 0
                    ? location.timeSlots
                    : Array.isArray(fallbackLocation.timeSlots)
                      ? fallbackLocation.timeSlots
                      : [],
              };
            });
          const normalizedLocationIds = new Set(normalizedLocations.map((location) => location.id));
          const missingFallbackLocations = fallback.locations.filter(
            (location) => !normalizedLocationIds.has(location.id)
          );
          return [...normalizedLocations, ...missingFallbackLocations];
        })()
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
    memoryInstructors = Array.isArray(data.instructors) && data.instructors.length > 0
      ? data.instructors.map(withInstructorDefaults)
      : buildDefaultInstructorSeed(memoryServices).map(createMemoryInstructorRecord);
    memoryBookings = Array.isArray(data.bookings)
      ? data.bookings.map((booking) => {
          const bookingEmail = String(booking.email || '').trim().toLowerCase();
          const matchedUser = Array.isArray(data.users)
            ? data.users.find((user) => String(user.email || '').trim().toLowerCase() === bookingEmail)
            : null;

          return {
            ...booking,
            user: booking.user || matchedUser?._id || '',
          };
        })
      : [];
    memoryUsers = Array.isArray(data.users) ? data.users : [];
    memoryReviews = Array.isArray(data.reviews) ? data.reviews : [];
    memoryAuthTokens = Array.isArray(data.authTokens) ? data.authTokens : [];
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
          instructors: memoryInstructors,
          bookings: memoryBookings,
          users: memoryUsers,
          reviews: memoryReviews,
          authTokens: memoryAuthTokens,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.warn(`Unable to persist demo data. (${error.message})`);
  }
}

function generateServiceSlots(serviceInput, date, locationId, instructorDirectory = []) {
  const service = withInstructorAssignments(serviceInput, instructorDirectory);
  const locations = service.locations || [];
  const selectedLocation = locations.find((location) => location.id === locationId) || locations[0];
  const assignedInstructorRecords = getAssignedInstructorRecords(service, selectedLocation?.id, instructorDirectory);
  const timeValues = buildLocationTimeValues(service, selectedLocation);

  return timeValues.map((time, index) => {
    const matchingOverride = service.scheduleOverrides.find(
      (override) =>
        override.date === date &&
        override.time === time &&
        override.locationId === selectedLocation?.id
    );
    const availableInstructorOptions =
      service.bookingMode === 'self-led'
        ? []
        : assignedInstructorRecords.length > 0
          ? getOrderedAvailableInstructorNames(selectedLocation, assignedInstructorRecords, date, time)
          : Array.isArray(selectedLocation?.instructors)
            ? selectedLocation.instructors
            : [];
    const defaultInstructor =
      service.bookingMode === 'self-led'
        ? ''
        : matchingOverride?.instructorName || availableInstructorOptions[index % Math.max(availableInstructorOptions.length, 1)] || '';
    const instructorOptions =
      service.bookingMode === 'self-led'
        ? []
        : defaultInstructor
          ? [defaultInstructor]
          : [];

    return {
      time,
      label: formatTimeLabel(time),
      instructorName: defaultInstructor,
      defaultInstructor,
      instructorOptions,
      availableInstructorOptions,
    };
  }).filter((slot) => {
    const appointment = buildAppointmentDate(date, slot.time);
    return (
      !Number.isNaN(appointment.getTime()) &&
      isUpcomingAppointment(appointment) &&
      (service.bookingMode === 'self-led' || slot.instructorOptions.length > 0)
    );
  });
}

async function listInstructors(includeInactive = false) {
  if (databaseReady) {
    const query = includeInactive ? {} : { active: true };
    const instructors = await Instructor.find(query).sort({ name: 1 });
    return instructors
      .map(withInstructorDefaults)
      .filter((instructor) => instructor.locationIds.length > 0);
  }

  return memoryInstructors
    .filter((instructor) => (includeInactive ? true : instructor.active !== false))
    .map(withInstructorDefaults)
    .filter((instructor) => instructor.locationIds.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function findInstructorById(id) {
  return databaseReady
    ? withInstructorDefaults(await Instructor.findById(id))
    : withInstructorDefaults(memoryInstructors.find((instructor) => instructor._id === id) || null);
}

async function findInstructorByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return databaseReady
    ? withInstructorDefaults(await Instructor.findOne({ email: normalizedEmail }))
    : withInstructorDefaults(memoryInstructors.find((instructor) => instructor.email === normalizedEmail) || null);
}

async function listServices(includeInactive = false) {
  if (databaseReady) {
    const query = includeInactive ? {} : { active: true };
    const services = await Service.find(query).sort({ createdAt: 1 });
    const instructors = await listInstructors(true);
    return services.map((service) => withInstructorAssignments(service, instructors));
  }

  return memoryServices
    .filter((service) => (includeInactive ? true : service.active))
    .map((service) => withInstructorAssignments(service, memoryInstructors));
}

async function findServiceById(id) {
  const service = databaseReady
    ? await Service.findById(id)
    : memoryServices.find((item) => item._id === id) || null;

  if (!service) {
    return null;
  }

  const instructors = await listInstructors(true);
  return withInstructorAssignments(service, instructors);
}

async function createService(serviceData) {
  return databaseReady ? withInstructorAssignments(await Service.create(serviceData), await listInstructors(true)) : (() => {
    const service = {
      _id: randomUUID(),
      ...serviceData,
      active: serviceData.active ?? true,
    };
    memoryServices.push(service);
    persistDemoState();
    return withInstructorAssignments(service, memoryInstructors);
  })();
}

async function updateServiceById(id, updates) {
  return databaseReady
    ? withInstructorAssignments(await Service.findByIdAndUpdate(id, updates, { new: true }), await listInstructors(true))
    : (() => {
        const service = memoryServices.find((item) => item._id === id);
        if (!service) {
          return null;
        }
        Object.assign(service, updates);
        persistDemoState();
        return withInstructorAssignments(service, memoryInstructors);
      })();
}

async function createInstructor(instructorData) {
  return databaseReady ? withInstructorDefaults(await Instructor.create(instructorData)) : (() => {
    const instructor = createMemoryInstructorRecord({
      ...instructorData,
      email: String(instructorData.email).trim().toLowerCase(),
    });
    memoryInstructors.push(instructor);
    persistDemoState();
    return withInstructorDefaults(instructor);
  })();
}

async function updateInstructorById(id, updates) {
  return databaseReady
    ? withInstructorDefaults(await Instructor.findByIdAndUpdate(id, updates, { new: true }))
    : (() => {
        const instructor = memoryInstructors.find((item) => item._id === id);
        if (!instructor) {
          return null;
        }
        Object.assign(instructor, updates, { updatedAt: new Date().toISOString() });
        persistDemoState();
        return withInstructorDefaults(instructor);
      })();
}

async function deleteServiceById(id) {
  if (databaseReady) {
    const deletedService = await Service.findByIdAndDelete(id);
    if (!deletedService) {
      return null;
    }
    await Instructor.updateMany({}, { $pull: { serviceIds: deletedService._id } });
    return withServiceDefaults(deletedService);
  }

  const serviceIndex = memoryServices.findIndex((service) => service._id === id);
  if (serviceIndex === -1) {
    return null;
  }

  const [deletedService] = memoryServices.splice(serviceIndex, 1);
  memoryInstructors = memoryInstructors.map((instructor) => ({
    ...instructor,
    serviceIds: Array.isArray(instructor.serviceIds)
      ? instructor.serviceIds.filter((serviceId) => String(serviceId) !== String(id))
      : [],
    updatedAt: new Date().toISOString(),
  }));
  persistDemoState();
  return withServiceDefaults(deletedService);
}

async function countBookingsForService(serviceId) {
  return databaseReady
    ? Booking.countDocuments({ service: serviceId })
    : memoryBookings.filter((booking) => String(booking.service?._id || booking.service) === String(serviceId)).length;
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

function getBookingOwnerId(booking) {
  if (!booking) {
    return '';
  }

  return String(booking.user?._id || booking.user || '');
}

function bookingBelongsToUser(booking, user) {
  if (!booking || !user) {
    return false;
  }

  const bookingOwnerId = getBookingOwnerId(booking);
  if (bookingOwnerId) {
    return bookingOwnerId === String(user._id);
  }

  return String(booking.email || '').trim().toLowerCase() === String(user.email || '').trim().toLowerCase();
}

function buildUserBookingQuery(user) {
  return {
    $or: [
      { user: user._id },
      { email: String(user.email || '').trim().toLowerCase() },
    ],
  };
}

async function syncBookingsForUser(user, previousEmail = '') {
  if (!user) {
    return;
  }

  const normalizedPreviousEmail = String(previousEmail || '').trim().toLowerCase();
  const normalizedCurrentEmail = String(user.email || '').trim().toLowerCase();
  const normalizedCurrentName = String(user.name || '').trim();

  if (databaseReady) {
    const query = normalizedPreviousEmail && normalizedPreviousEmail !== normalizedCurrentEmail
      ? {
          $or: [
            { user: user._id },
            { email: normalizedPreviousEmail },
          ],
        }
      : buildUserBookingQuery(user);

    await Booking.updateMany(
      query,
      {
        $set: {
          user: user._id,
          email: normalizedCurrentEmail,
          clientName: normalizedCurrentName,
          membershipNumber: user.membershipNumber,
        },
      }
    );
    return;
  }

  let didUpdate = false;
  memoryBookings = memoryBookings.map((booking) => {
    if (
      getBookingOwnerId(booking) === String(user._id) ||
      (normalizedPreviousEmail && String(booking.email || '').trim().toLowerCase() === normalizedPreviousEmail) ||
      String(booking.email || '').trim().toLowerCase() === normalizedCurrentEmail
    ) {
      didUpdate = true;
      return {
        ...booking,
        user: String(user._id),
        email: normalizedCurrentEmail,
        clientName: normalizedCurrentName,
        membershipNumber: user.membershipNumber,
        updatedAt: new Date().toISOString(),
      };
    }

    return booking;
  });

  if (didUpdate) {
    persistDemoState();
  }
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
    emailVerified: Boolean(user.emailVerified),
    adminTitle: String(user.adminTitle || ''),
    adminPermission: String(user.adminPermission || ''),
  };
}

function isMainAdmin(user) {
  if (!user) {
    return false;
  }

  return user.adminPermission === 'main-admin' || normalizeMembershipNumber(user.membershipNumber) === 'ADMIN-001';
}

function sanitizeManagedUser(user) {
  return {
    ...sanitizeUser(user),
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  };
}

function sortAdminUsers(left, right) {
  const leftIsAdmin = left.role === 'admin';
  const rightIsAdmin = right.role === 'admin';
  if (leftIsAdmin !== rightIsAdmin) {
    return leftIsAdmin ? -1 : 1;
  }

  const leftIsMain = isMainAdmin(left);
  const rightIsMain = isMainAdmin(right);
  if (leftIsMain !== rightIsMain) {
    return leftIsMain ? -1 : 1;
  }

  const leftName = String(left.name || left.email || '').toLowerCase();
  const rightName = String(right.name || right.email || '').toLowerCase();
  return leftName.localeCompare(rightName);
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

function setCsrfCookie(res, token) {
  res.append('Set-Cookie', serializeCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
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

function clearCsrfCookie(res) {
  res.append('Set-Cookie', serializeCookie(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? 'None' : 'Lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  }));
}

function issueCsrfToken(res) {
  const csrfToken = randomUUID();
  setCsrfCookie(res, csrfToken);
  return csrfToken;
}

function issueSessionCookies(res, sessionToken) {
  setSessionCookie(res, sessionToken);
  return issueCsrfToken(res);
}

function logRequest(req, res, startedAt) {
  const durationMs = Date.now() - startedAt;
  const logEntry = {
    level: res.statusCode >= 500 ? 'error' : 'info',
    method: req.method,
    path: req.originalUrl,
    status: res.statusCode,
    durationMs,
    ip: req.ip,
    userId: req.user?._id || null,
  };

  console.log(JSON.stringify(logEntry));
}

function logServerError(event, error, details = {}) {
  console.error(JSON.stringify({
    level: 'error',
    event,
    message: error?.message || 'Unknown server error',
    ...details,
  }));
}

function sendValidationError(res, errors) {
  return res.status(400).json({
    message: errors[0] || 'Please review the form and try again.',
    errors,
  });
}

function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const csrfCookie = cookies[CSRF_COOKIE_NAME] || '';
  const csrfHeader = String(req.headers['x-csrf-token'] || '').trim();

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ message: 'Security check failed. Please refresh the page and try again.' });
  }

  return next();
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

function getAuthActionUrl(mode, token) {
  const url = new URL(getAppBaseUrl());
  url.searchParams.set('mode', mode);
  url.searchParams.set('token', token);
  return url.toString();
}

async function deleteAuthTokensForUser(userId, type) {
  if (!userId || !type) {
    return;
  }

  if (databaseReady) {
    await AuthToken.deleteMany({ user: userId, type });
    return;
  }

  memoryAuthTokens = memoryAuthTokens.filter(
    (item) => !(item.userId === String(userId) && item.type === type)
  );
  persistDemoState();
}

async function createAuthToken(userId, type, ttlMs) {
  const token = randomUUID();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  await deleteAuthTokensForUser(userId, type);

  if (databaseReady) {
    await AuthToken.create({
      user: userId,
      type,
      tokenHash,
      expiresAt,
      usedAt: null,
    });
  } else {
    memoryAuthTokens.push({
      _id: randomUUID(),
      userId: String(userId),
      type,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    persistDemoState();
  }

  return token;
}

async function consumeAuthToken(token, type) {
  const tokenHash = hashSessionToken(token);

  if (databaseReady) {
    const record = await AuthToken.findOne({
      type,
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return null;
    }

    record.usedAt = new Date();
    await record.save();
    return record;
  }

  const record = memoryAuthTokens.find((item) => {
    const expiresAt = new Date(item.expiresAt);
    return (
      item.type === type &&
      item.tokenHash === tokenHash &&
      !item.usedAt &&
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() > Date.now()
    );
  });

  if (!record) {
    return null;
  }

  record.usedAt = new Date().toISOString();
  record.updatedAt = new Date().toISOString();
  persistDemoState();
  return record;
}

async function sendPasswordResetEmail(user) {
  const token = await createAuthToken(user._id, 'password-reset', PASSWORD_RESET_TTL_MS);
  const actionUrl = getAuthActionUrl('reset-password', token);

  return sendAppEmail({
    to: user.email,
    subject: 'Reset your Wellness Center Studio password',
    text: `Reset your password by opening this link: ${actionUrl}. This link expires in 30 minutes.`,
    html: `<p>You requested a password reset for Wellness Center Studio.</p><p><a href="${actionUrl}">Reset your password</a>. This link expires in 30 minutes.</p>`,
    actionUrl,
  });
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

function generateTemporaryPassword() {
  return `Admin${Math.floor(100000 + Math.random() * 900000)}`;
}

async function findUserById(id) {
  return databaseReady
    ? User.findById(id)
    : memoryUsers.find((user) => user._id === id) || null;
}

async function listUsersForAdmin() {
  const users = databaseReady ? await User.find().sort({ createdAt: 1 }) : [...memoryUsers];
  return users.sort(sortAdminUsers);
}

async function generateAdminMembershipNumber() {
  const existingUsers = await listUsersForAdmin();
  const largestSequence = existingUsers.reduce((largest, user) => {
    const match = normalizeMembershipNumber(user.membershipNumber).match(/^ADMIN-(\d+)$/);
    if (!match) {
      return largest;
    }

    return Math.max(largest, Number(match[1]));
  }, 2);

  return `ADMIN-${String(largestSequence + 1).padStart(3, '0')}`;
}

async function createUser(userData) {
  return databaseReady ? User.create(userData) : (() => {
    const now = new Date().toISOString();
    const user = {
      _id: randomUUID(),
      ...userData,
      email: String(userData.email).toLowerCase(),
      membershipNumber: normalizeMembershipNumber(userData.membershipNumber),
      membershipActive: userData.membershipActive ?? true,
      emailVerified: Boolean(userData.emailVerified),
      emailVerifiedAt: userData.emailVerifiedAt || null,
      adminTitle: String(userData.adminTitle || ''),
      adminPermission: String(userData.adminPermission || ''),
      createdAt: userData.createdAt || now,
      updatedAt: userData.updatedAt || now,
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
        Object.assign(user, updates, {
          updatedAt: new Date().toISOString(),
        });
        persistDemoState();
        return user;
      })();
}

function refreshDemoSessionUsers(updatedUser) {
  if (databaseReady || !updatedUser) {
    return;
  }

  Array.from(sessions.entries()).forEach(([token, sessionRecord]) => {
    if (String(sessionRecord.user?._id || '') !== String(updatedUser._id)) {
      return;
    }

    sessions.set(token, {
      ...sessionRecord,
      user: sanitizeUser(updatedUser),
    });
  });
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

async function deleteSessionsForUser(userId) {
  if (!userId) {
    return;
  }

  if (databaseReady) {
    await Session.deleteMany({ user: userId });
    return;
  }

  const userKey = String(userId);
  Array.from(sessions.entries()).forEach(([token, sessionRecord]) => {
    if (String(sessionRecord.user?._id || '') === userKey) {
      sessions.delete(token);
    }
  });
}

async function requireAuth(req, res, next) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    clearSessionCookie(res);
    clearCsrfCookie(res);
    return res.status(401).json({ message: 'Please log in first.' });
  }

  const fullUser = await findUserById(sessionUser._id);
  if (!fullUser) {
    await deleteSession(getSessionToken(req));
    clearSessionCookie(res);
    clearCsrfCookie(res);
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

function requireMainAdmin(req, res, next) {
  if (!isMainAdmin(req.user)) {
    return res.status(403).json({ message: 'Only the main admin can manage admin permissions.' });
  }

  return next();
}

app.use(helmet());
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => logRequest(req, res, startedAt));
  next();
});
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token', 'X-CSRF-Token'],
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => {
  if (
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
    [
      '/auth/register',
      '/auth/login',
      '/auth/logout',
      '/auth/csrf',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/health',
    ].includes(req.path)
  ) {
    return next();
  }

  return requireCsrf(req, res, next);
});

async function seedServices() {
  const serviceCount = await Service.countDocuments();

  if (serviceCount === 0) {
    await Service.insertMany(defaultServices);
    console.log('🌱 Seeded starter wellness services');
  }
}

async function seedInstructors() {
  const instructorCount = await Instructor.countDocuments();

  if (instructorCount > 0) {
    return;
  }

  const services = await Service.find().sort({ createdAt: 1 });
  const instructorSeed = buildDefaultInstructorSeed(services);

  if (instructorSeed.length > 0) {
    await Instructor.insertMany(instructorSeed);
    console.log('🌱 Seeded starter instructor directory');
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
      emailVerified: true,
      emailVerifiedAt: new Date(),
      adminTitle: 'Main Admin',
      adminPermission: 'main-admin',
    });
    console.log('Seeded demo admin account');
  } else if (!existingAdmin.emailVerified) {
    await updateUserById(existingAdmin._id, {
      emailVerified: true,
      emailVerifiedAt: existingAdmin.emailVerifiedAt || new Date(),
      adminTitle: 'Main Admin',
      adminPermission: 'main-admin',
    });
  } else {
    await updateUserById(existingAdmin._id, {
      adminTitle: existingAdmin.adminTitle || 'Main Admin',
      adminPermission: 'main-admin',
    });
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
      emailVerified: true,
      emailVerifiedAt: new Date(),
      adminTitle: '',
      adminPermission: '',
    });
    console.log('Seeded demo member account');
  } else if (!existingMember.emailVerified) {
    await updateUserById(existingMember._id, {
      emailVerified: true,
      emailVerifiedAt: existingMember.emailVerifiedAt || new Date(),
      adminTitle: '',
      adminPermission: '',
    });
  } else {
    await updateUserById(existingMember._id, {
      adminTitle: '',
      adminPermission: '',
    });
  }
}

async function seedBootstrapAdmin() {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  const adminMembershipNumber = normalizeMembershipNumber(process.env.ADMIN_MEMBERSHIP_NUMBER || 'ADMIN-001');
  const adminName = String(process.env.ADMIN_NAME || 'Wellness Admin').trim();

  if (!IS_PRODUCTION || !adminEmail || !adminPassword) {
    return;
  }

  const existingAdminByEmail = await findUserByEmail(adminEmail);
  const existingAdminByMembershipNumber = await findUserByMembershipNumber(adminMembershipNumber);
  const allUsers = await listUsersForAdmin();
  const existingMainAdmin = allUsers.find((user) => isMainAdmin(user));
  const targetAdmin =
    existingAdminByEmail ||
    existingAdminByMembershipNumber ||
    existingMainAdmin ||
    null;

  const adminPayload = {
    name: adminName,
    email: adminEmail,
    passwordHash: hashPassword(adminPassword),
    role: 'admin',
    membershipNumber: adminMembershipNumber,
    membershipActive: true,
    emailVerified: true,
    emailVerifiedAt: targetAdmin?.emailVerifiedAt || new Date(),
    adminTitle: 'Main Admin',
    adminPermission: 'main-admin',
  };

  if (
    existingAdminByEmail &&
    existingAdminByMembershipNumber &&
    String(existingAdminByEmail._id) !== String(existingAdminByMembershipNumber._id)
  ) {
    await updateUserById(existingAdminByMembershipNumber._id, {
      membershipNumber: await generateAdminMembershipNumber(),
      adminPermission: existingAdminByMembershipNumber.adminPermission === 'main-admin' ? 'admin' : existingAdminByMembershipNumber.adminPermission,
      adminTitle: existingAdminByMembershipNumber.adminTitle || 'Studio Admin',
    });
  }

  if (targetAdmin) {
    await updateUserById(targetAdmin._id, adminPayload);
    console.log('Updated production admin account from environment variables');
    return;
  }

  await createUser(adminPayload);
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
    await seedInstructors();
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

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { errors, value } = validateRegisterPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const { name, email, password } = value;
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const membershipNumber = await generateMembershipNumber();

    const newUser = await createUser({
      name: String(name).trim(),
      email: String(email).toLowerCase(),
      passwordHash: hashPassword(String(password).trim()),
      membershipNumber,
      membershipActive: true,
      role: 'user',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    const token = await createSession(newUser);
    const csrfToken = issueSessionCookies(res, token);
    return res.status(201).json({
      user: sanitizeUser(newUser),
      csrfToken,
      message: `Account created. Your membership number is ${membershipNumber}.`,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create your account right now.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { errors, value } = validateLoginPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const { identifier: loginIdentifier, password } = value;
    const user = await findUserByIdentifier(loginIdentifier);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Incorrect email, membership number, or password.' });
    }

    const token = await createSession(user);
    const csrfToken = issueSessionCookies(res, token);
    return res.json({
      user: sanitizeUser(user),
      csrfToken,
      message: '',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to log in right now.' });
  }
});

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { errors, value } = validateForgotPasswordPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const user = await findUserByEmail(value.email);
    if (user) {
      try {
        await sendPasswordResetEmail(user);
      } catch (emailError) {
        logServerError('password-reset-email-send-failed', emailError, { userId: String(user._id) });
      }
    }

    return res.json({
      message: 'If that email exists in our system, a password reset link has been sent.',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to start the password reset right now.' });
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { errors, value } = validateResetPasswordPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const tokenRecord = await consumeAuthToken(value.token, 'password-reset');
    if (!tokenRecord) {
      return res.status(400).json({ message: 'That password reset link is invalid or has expired.' });
    }

    const userId = databaseReady ? tokenRecord.user : tokenRecord.userId;
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Account not found for that reset link.' });
    }

    await updateUserById(user._id, {
      passwordHash: hashPassword(value.password),
    });
    await deleteSessionsForUser(user._id);
    await deleteAuthTokensForUser(user._id, 'password-reset');

    return res.json({ message: 'Your password has been reset. You can sign in now.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to reset your password right now.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const csrfToken = issueCsrfToken(res);
  res.json({ user: req.user, csrfToken });
});

app.get('/api/auth/csrf', requireAuth, async (req, res) => {
  const csrfToken = issueCsrfToken(res);
  res.json({ csrfToken });
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await deleteSession(getSessionToken(req));
    clearSessionCookie(res);
    clearCsrfCookie(res);
    return res.json({ ok: true });
  } catch (error) {
    clearSessionCookie(res);
    clearCsrfCookie(res);
    return res.status(500).json({ message: 'Unable to log out right now.' });
  }
});

app.patch('/api/auth/me', authLimiter, requireAuth, async (req, res) => {
  try {
    const { errors, value } = validateProfilePayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const { name, membershipActive, email, currentPassword, newPassword } = value;
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

    const previousEmail = req.user.email;
    const updatedUser = await updateUserById(req.user._id, updates);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    if (updates.email || updates.name) {
      await syncBookingsForUser(updatedUser, previousEmail);
    }

    if (updates.passwordHash) {
      await deleteSessionsForUser(req.user._id);
      const nextSessionToken = await createSession(updatedUser);
      issueSessionCookies(res, nextSessionToken);
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
    if (!date || !isValidDateInput(date)) {
      return res.status(400).json({ message: 'Please choose a valid date first.' });
    }

    const service = await findServiceById(req.params.id);
    if (!service || !service.active) {
      return res.status(404).json({ message: 'Selected service was not found.' });
    }

    const instructorDirectory = await listInstructors(false);
    const slots = generateServiceSlots(service, String(date), String(locationId || ''), instructorDirectory);
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

app.get('/api/instructors', async (req, res) => {
  try {
    const instructors = await listInstructors(false);
    res.json(instructors);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load instructors right now.' });
  }
});

app.get('/api/admin/instructors', requireAuth, requireAdmin, async (req, res) => {
  try {
    const instructors = await listInstructors(true);
    res.json(instructors);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load instructors right now.' });
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await listUsersForAdmin();
    res.json(users.map(sanitizeManagedUser));
  } catch (error) {
    res.status(500).json({ message: 'Unable to load users right now.' });
  }
});

app.post('/api/admin/users/admins', adminLimiter, requireAuth, requireAdmin, requireMainAdmin, async (req, res) => {
  try {
    const { errors, value } = validateAdminUserPayload({
      ...req.body,
      action: 'create',
    });
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const existingUser = await findUserByEmail(value.email);
    if (existingUser) {
      return res.status(409).json({ message: 'That email already has an account. Use a different email for the new admin.' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const adminUser = await createUser({
      name: value.name,
      email: value.email,
      passwordHash: hashPassword(temporaryPassword),
      role: 'admin',
      membershipNumber: await generateAdminMembershipNumber(),
      membershipActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      adminTitle: value.adminTitle,
      adminPermission: 'admin',
    });
    const users = await listUsersForAdmin();

    return res.status(201).json({
      user: sanitizeManagedUser(adminUser),
      users: users.map(sanitizeManagedUser),
      temporaryPassword,
      message: `${adminUser.name} was added as an admin. Temporary password: ${temporaryPassword}`,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create that admin right now.' });
  }
});

app.post('/api/admin/services', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { errors, value } = validateServicePayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const { name, description, durationMinutes, category, capacity, price } = value;
    const defaults = getDefaultServiceConfig({ name, category });
    const service = await createService({
      name,
      description,
      durationMinutes,
      category,
      capacity,
      price,
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

app.patch('/api/admin/services/:id', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { errors, value } = validateServicePayload({
      ...req.body,
      active: req.body.active,
    });
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const { name, description, durationMinutes, category, capacity, price, active } = value;
    const { bookingMode, schedule, locations } = req.body;
    const updates = {};

    updates.name = name;
    updates.description = description;
    updates.category = category;
    updates.durationMinutes = durationMinutes;
    updates.capacity = capacity;
    updates.price = price;
    updates.active = active;

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
      const validLocationIds = new Set(studioLocations.map((location) => location.id));
      updates.locations = locations
        .filter((location) => validLocationIds.has(String(location.id)))
        .map((location) => ({
          id: String(location.id),
          name: String(location.name),
          address: String(location.address),
          instructors: Array.isArray(location.instructors) ? location.instructors.map((item) => String(item).trim()).filter(Boolean) : [],
          timeSlots: Array.isArray(location.timeSlots)
            ? location.timeSlots.map((item) => String(item).trim()).filter((item) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(item))
            : [],
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

app.post('/api/admin/instructors', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { errors, value } = validateInstructorPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }
    const sanitizedValue = sanitizeInstructorForLiveLocations(value);
    if (sanitizedValue.locationIds.length === 0 || sanitizedValue.weeklyAvailability.length === 0) {
      return res.status(400).json({ message: 'Assign the instructor to at least one live studio location.' });
    }

    const services = await listServices(true);
    const validServiceIds = new Set(services.map((service) => String(service._id)));

    if (sanitizedValue.serviceIds.some((serviceId) => !validServiceIds.has(String(serviceId)))) {
      return res.status(400).json({ message: 'One or more selected services are invalid.' });
    }

    const existingInstructor = await findInstructorByEmail(sanitizedValue.email);
    if (existingInstructor) {
      return res.status(409).json({ message: 'An instructor with that email already exists.' });
    }

    const instructor = await createInstructor(sanitizedValue);
    return res.status(201).json(instructor);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create the instructor right now.' });
  }
});

app.patch('/api/admin/instructors/:id', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { errors, value } = validateInstructorPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const instructor = await findInstructorById(req.params.id);
    if (!instructor) {
      return res.status(404).json({ message: 'Instructor not found.' });
    }
    const sanitizedValue = sanitizeInstructorForLiveLocations(value);
    if (sanitizedValue.locationIds.length === 0 || sanitizedValue.weeklyAvailability.length === 0) {
      return res.status(400).json({ message: 'Assign the instructor to at least one live studio location.' });
    }

    const services = await listServices(true);
    const validServiceIds = new Set(services.map((service) => String(service._id)));

    if (sanitizedValue.serviceIds.some((serviceId) => !validServiceIds.has(String(serviceId)))) {
      return res.status(400).json({ message: 'One or more selected services are invalid.' });
    }

    const existingInstructor = await findInstructorByEmail(sanitizedValue.email);
    if (existingInstructor && String(existingInstructor._id) !== String(req.params.id)) {
      return res.status(409).json({ message: 'Another instructor already uses that email.' });
    }

    const updatedInstructor = await updateInstructorById(req.params.id, sanitizedValue);
    return res.json(updatedInstructor);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update the instructor right now.' });
  }
});

app.patch('/api/admin/users/:id', adminLimiter, requireAuth, requireAdmin, requireMainAdmin, async (req, res) => {
  try {
    const { errors, value } = validateAdminUserPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const targetUser = await findUserById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const previousEmail = targetUser.email;
    const action = value.action;
    const updates = {};

    if (action === 'update') {
      if (targetUser.role !== 'admin') {
        return res.status(400).json({ message: 'Only admins can receive an admin title update.' });
      }

      if (value.name) {
        updates.name = value.name;
      }

      if (value.email && value.email !== String(targetUser.email || '').toLowerCase()) {
        const existingUser = await findUserByEmail(value.email);
        if (existingUser && String(existingUser._id) !== String(targetUser._id)) {
          return res.status(409).json({ message: 'That email is already being used by another account.' });
        }
        updates.email = value.email;
      }

      updates.adminTitle = value.adminTitle;
      updates.adminPermission = isMainAdmin(targetUser) ? 'main-admin' : 'admin';
    }

    if (action === 'demote') {
      if (isMainAdmin(targetUser)) {
        return res.status(400).json({ message: 'The main admin cannot be demoted from this workspace.' });
      }

      if (String(targetUser._id) === String(req.user._id)) {
        return res.status(400).json({ message: 'Use another admin account if you need to demote this profile.' });
      }

      updates.role = 'user';
      updates.membershipNumber = await generateMembershipNumber();
      updates.membershipActive = true;
      updates.adminTitle = '';
      updates.adminPermission = '';
    }

    const updatedUser = await updateUserById(req.params.id, updates);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await syncBookingsForUser(updatedUser, previousEmail);
    refreshDemoSessionUsers(updatedUser);

    const users = await listUsersForAdmin();
    return res.json({
      user: sanitizeManagedUser(updatedUser),
      users: users.map(sanitizeManagedUser),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update that user right now.' });
  }
});

app.post('/api/admin/services/:id/overrides', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const { errors, value } = validateOverridePayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const { date, time, locationId, instructorName } = value;

    const service = databaseReady ? await Service.findById(req.params.id) : memoryServices.find((item) => item._id === req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const shapedService = withServiceDefaults(service);
    const location = shapedService.locations.find((item) => item.id === locationId);
    if (!location) {
      return res.status(404).json({ message: 'Location not found for this service.' });
    }

    const instructorDirectory = await listInstructors(true);
    const assignedInstructorNames = getAssignedInstructorRecords(
      shapedService,
      locationId,
      instructorDirectory
    ).map((instructor) => instructor.name);

    if (!assignedInstructorNames.includes(instructorName)) {
      return res.status(400).json({ message: 'That instructor is not assigned to the selected location.' });
    }

    const allowedTimes = generateServiceSlots(shapedService, String(date), locationId, instructorDirectory).map((slot) => slot.time);
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

app.delete('/api/admin/services/:id/overrides/:overrideId', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
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

app.patch('/api/admin/services/:id/deactivate', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
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

app.delete('/api/admin/services/:id', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
  try {
    const service = await findServiceById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const bookingCount = await countBookingsForService(req.params.id);
    if (bookingCount > 0) {
      return res.status(409).json({
        message: 'This service already has booking history. Deactivate it instead of deleting it.',
      });
    }

    await deleteServiceById(req.params.id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete the service right now.' });
  }
});

app.get('/api/bookings', requireAuth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : buildUserBookingQuery(req.user);
    const bookings = databaseReady
      ? (await Booking.find(query).populate('service').sort({ appointmentDate: 1, createdAt: -1 })).map((booking) => ({
          ...booking.toObject(),
          service: withServiceDefaults(booking.service),
        }))
      : memoryBookings
          .filter((booking) => (req.user.role === 'admin' ? true : bookingBelongsToUser(booking, req.user)))
          .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load bookings right now.' });
  }
});

app.post('/api/bookings', bookingLimiter, requireAuth, async (req, res) => {
  try {
    const { errors, value } = validateBookingPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const {
      serviceId,
      bookingDate,
      slotTime,
      locationId,
      instructorName = '',
      notes = '',
      paymentCardholderName = '',
      paymentCardLast4 = '',
      paymentCardDigitsCount = 0,
      creditBookingId = '',
    } = value;

    if (!req.user.membershipActive) {
      return res.status(403).json({ message: 'Your membership is inactive. Please contact the wellness center.' });
    }

    const service = await findServiceById(serviceId);
    if (!service || !service.active) {
      return res.status(404).json({ message: 'Selected service was not found.' });
    }

    const location = service.locations.find((item) => item.id === locationId);
    if (!location) {
      return res.status(404).json({ message: 'Selected location was not found for this service.' });
    }

    const instructorDirectory = await listInstructors(false);
    const validSlots = generateServiceSlots(service, String(bookingDate), locationId, instructorDirectory);
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
    let paymentStatus = 'Paid';
    let paymentAmount = Number(service.price || 0);
    let paymentLast4 = '';
    let creditSourceBooking = null;

    if (normalizedCreditBookingId) {
      creditSourceBooking = await findBookingById(normalizedCreditBookingId);

      if (!creditSourceBooking) {
        return res.status(404).json({ message: 'The open gym credit could not be found.' });
      }

      if (req.user.role !== 'admin' && !bookingBelongsToUser(creditSourceBooking, req.user)) {
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
      if (!normalizedCardholder || paymentCardLast4.length !== 4 || Number(paymentCardDigitsCount) !== 16) {
        return res.status(400).json({
          message: 'Please enter a cardholder name and any 16-digit demo card number to complete checkout.',
        });
      }

      paymentLast4 = paymentCardLast4;
    }

    const populatedBooking = databaseReady
      ? await (async () => {
          const booking = await Booking.create({
            user: req.user._id,
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
            user: String(req.user._id),
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

app.patch('/api/admin/requests/:id', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
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

app.patch('/api/admin/bookings/:id/attendance', adminLimiter, requireAuth, requireAdmin, async (req, res) => {
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

    const updates = {
      attendanceStatus,
      attendanceMarkedAt: new Date(),
      noShowFeeAmount: 0,
      creditEligible: false,
    };

    if (attendanceStatus === 'No-show') {
      const outcome = calculateNoShowOutcome({
        service: booking.service,
        paymentAmount: booking.paymentAmount,
        fallbackPrice: booking.service?.price,
      });
      updates.creditEligible = outcome.creditEligible;
      updates.noShowFeeAmount = outcome.noShowFeeAmount;
    }

    const updatedBooking = await updateBookingById(req.params.id, updates);
    return res.json(updatedBooking);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update attendance right now.' });
  }
});

app.patch('/api/bookings/:id/cancel', bookingLimiter, requireAuth, async (req, res) => {
  try {
    let booking;

    if (databaseReady) {
      const existingBooking = await Booking.findById(req.params.id).populate('service');
      if (!existingBooking) {
        return res.status(404).json({ message: 'Booking request not found.' });
      }

      if (req.user.role !== 'admin' && !bookingBelongsToUser(existingBooking, req.user)) {
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

      if (req.user.role !== 'admin' && !bookingBelongsToUser(booking, req.user)) {
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

app.post('/api/reviews', bookingLimiter, requireAuth, async (req, res) => {
  try {
    const { errors, value } = validateReviewPayload(req.body);
    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const { bookingId, rating, comment = '' } = value;
    const booking = await findBookingById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    if (req.user.role !== 'admin' && !bookingBelongsToUser(booking, req.user)) {
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
