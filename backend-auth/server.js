const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { randomUUID, scryptSync, timingSafeEqual } = require('crypto');
require('dotenv').config();
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const User = require('./models/User');
const Review = require('./models/Review');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultServices = [
  {
    name: 'Pilates Flow',
    description: 'A guided pilates class focused on flexibility and core strength.',
    durationMinutes: 60,
    category: 'Class',
    capacity: 8,
  },
  {
    name: 'Deep Tissue Massage',
    description: 'A restorative massage session for stress relief and muscle recovery.',
    durationMinutes: 60,
    category: 'Massage',
    capacity: 3,
  },
  {
    name: 'Spa Reset',
    description: 'A calming spa treatment with aromatherapy and relaxation time.',
    durationMinutes: 45,
    category: 'Spa',
    capacity: 4,
  },
  {
    name: 'Open Gym Session',
    description: 'Independent gym time for members who want a flexible workout window.',
    durationMinutes: 90,
    category: 'Fitness',
    capacity: 12,
  },
];

const demoAdmin = {
  name: 'Wellness Admin',
  email: 'admin@wellness.local',
  password: 'admin123',
  membershipNumber: 'ADMIN-001',
  role: 'admin',
};

let databaseReady = false;
const sessions = new Map();
const memoryServices = defaultServices.map((service) => ({
  ...service,
  _id: randomUUID(),
  active: true,
}));
const memoryBookings = [];
const memoryUsers = [];
const memoryReviews = [];

async function listServices(includeInactive = false) {
  if (databaseReady) {
    const query = includeInactive ? {} : { active: true };
    return Service.find(query).sort({ createdAt: 1 });
  }

  return memoryServices.filter((service) => (includeInactive ? true : service.active));
}

async function findServiceById(id) {
  return databaseReady
    ? Service.findById(id)
    : memoryServices.find((service) => service._id === id) || null;
}

async function createService(serviceData) {
  return databaseReady ? Service.create(serviceData) : (() => {
    const service = {
      _id: randomUUID(),
      ...serviceData,
      active: serviceData.active ?? true,
    };
    memoryServices.push(service);
    return service;
  })();
}

async function updateServiceById(id, updates) {
  return databaseReady
    ? Service.findByIdAndUpdate(id, updates, { new: true })
    : (() => {
        const service = memoryServices.find((item) => item._id === id);
        if (!service) {
          return null;
        }
        Object.assign(service, updates);
        return service;
      })();
}

async function listReviews() {
  return databaseReady
    ? Review.find().populate('service').sort({ createdAt: -1 })
    : [...memoryReviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function findBookingById(id) {
  return databaseReady
    ? Booking.findById(id).populate('service')
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
    return review;
  })();
}

async function findReviewByBookingId(bookingId) {
  return databaseReady
    ? Review.findOne({ booking: bookingId }).populate('service')
    : memoryReviews.find((review) => review.booking === bookingId) || null;
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

function createSession(user) {
  const token = randomUUID();
  sessions.set(token, sanitizeUser(user));
  return token;
}

async function findUserByEmail(email) {
  const normalizedEmail = String(email).toLowerCase();
  return databaseReady
    ? User.findOne({ email: normalizedEmail })
    : memoryUsers.find((user) => user.email === normalizedEmail) || null;
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
      membershipActive: userData.membershipActive ?? true,
    };
    memoryUsers.push(user);
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
        return user;
      })();
}

function getSessionUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'];
  if (!token) {
    return null;
  }
  return sessions.get(token) || null;
}

async function requireAuth(req, res, next) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.status(401).json({ message: 'Please log in first.' });
  }

  const fullUser = await findUserById(sessionUser._id);
  if (!fullUser) {
    sessions.delete(req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token']);
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

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());

async function seedServices() {
  const serviceCount = await Service.countDocuments();

  if (serviceCount === 0) {
    await Service.insertMany(defaultServices);
    console.log('🌱 Seeded starter wellness services');
  }
}

async function seedAdminUser() {
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
}

async function connectDatabase() {
  if (!MONGO_URI) {
    console.warn('MONGO_URI is missing. Starting in demo mode with in-memory data.');
    await seedAdminUser();
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    databaseReady = true;
    console.log('Connected to Wellness database');
    await seedServices();
    await seedAdminUser();
  } catch (error) {
    console.warn(`Database connection failed. Starting in demo mode instead. (${error.message})`);
    await seedAdminUser();
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Wellness backend is running' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, membershipNumber } = req.body;

    if (!name || !email || !password || !membershipNumber) {
      return res.status(400).json({ message: 'Name, email, password, and membership number are required.' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const newUser = await createUser({
      name,
      email: String(email).toLowerCase(),
      passwordHash: hashPassword(password),
      membershipNumber,
      membershipActive: true,
      role: 'user',
    });

    const token = createSession(newUser);
    return res.status(201).json({
      token,
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create your account right now.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const token = createSession(user);
    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to log in right now.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { name, membershipNumber, membershipActive } = req.body;
    const updates = {};

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof membershipNumber === 'string' && membershipNumber.trim()) {
      updates.membershipNumber = membershipNumber.trim();
    }

    if (req.user.role === 'admin' && typeof membershipActive === 'boolean') {
      updates.membershipActive = membershipActive;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Please provide at least one profile change.' });
    }

    const updatedUser = await updateUserById(req.user._id, updates);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User profile not found.' });
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
    const { name, description, durationMinutes, category, capacity } = req.body;

    if (!name || !description || !durationMinutes || !category || !capacity) {
      return res.status(400).json({ message: 'All service fields are required.' });
    }

    const service = await createService({
      name: String(name).trim(),
      description: String(description).trim(),
      durationMinutes: Number(durationMinutes),
      category: String(category).trim(),
      capacity: Number(capacity),
      active: true,
    });

    return res.status(201).json(service);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create the service right now.' });
  }
});

app.patch('/api/admin/services/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description, durationMinutes, category, capacity, active } = req.body;
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
      updates.durationMinutes = Number(durationMinutes);
    }

    if (capacity !== undefined) {
      updates.capacity = Number(capacity);
    }

    if (typeof active === 'boolean') {
      updates.active = active;
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
      ? await Booking.find(query).populate('service').sort({ appointmentDate: 1, createdAt: -1 })
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
    const { serviceId, appointmentDate, notes = '' } = req.body;

    if (!req.user.membershipActive) {
      return res.status(403).json({ message: 'Your membership is inactive. Please contact the wellness center.' });
    }

    if (!serviceId || !appointmentDate) {
      return res.status(400).json({ message: 'Please choose a service and appointment time.' });
    }

    const service = databaseReady
      ? await Service.findById(serviceId)
      : memoryServices.find((item) => item._id === serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Selected service was not found.' });
    }

    const appointment = new Date(appointmentDate);
    if (Number.isNaN(appointment.getTime())) {
      return res.status(400).json({ message: 'Appointment date is invalid.' });
    }

    const startWindow = new Date(appointment);
    const endWindow = new Date(appointment.getTime() + service.durationMinutes * 60000);

    const overlappingApprovedOrPending = databaseReady
      ? await Booking.countDocuments({
          service: service._id,
          status: { $in: ['Pending', 'Approved'] },
          appointmentDate: {
            $gte: startWindow,
            $lt: endWindow,
          },
        })
      : memoryBookings.filter((booking) => {
          const bookingDate = new Date(booking.appointmentDate);
          return (
            booking.service._id === service._id &&
            ['Pending', 'Approved'].includes(booking.status) &&
            bookingDate >= startWindow &&
            bookingDate < endWindow
          );
        }).length;

    if (overlappingApprovedOrPending >= service.capacity) {
      return res.status(409).json({
        message: 'That time slot is currently full. Please choose another time.',
      });
    }

    const populatedBooking = databaseReady
      ? await (async () => {
          const booking = await Booking.create({
            clientName: req.user.name,
            email: req.user.email,
            membershipNumber: req.user.membershipNumber,
            service: service._id,
            appointmentDate: appointment,
            notes,
          });

          return booking.populate('service');
        })()
      : (() => {
          const booking = {
            _id: randomUUID(),
            clientName: req.user.name,
            email: req.user.email,
            membershipNumber: req.user.membershipNumber,
            service,
            appointmentDate: appointment.toISOString(),
            status: 'Pending',
            notes,
            createdAt: new Date().toISOString(),
          };
          memoryBookings.push(booking);
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
      ? await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('service')
      : (() => {
          const booking = memoryBookings.find((item) => item._id === req.params.id);
          if (!booking) {
            return null;
          }
          booking.status = status;
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

      if (existingBooking.status === 'Cancelled') {
        return res.status(400).json({ message: 'This booking is already cancelled.' });
      }

      existingBooking.status = 'Cancelled';
      await existingBooking.save();
      booking = existingBooking;
    } else {
      booking = memoryBookings.find((item) => item._id === req.params.id);
      if (!booking) {
        return res.status(404).json({ message: 'Booking request not found.' });
      }

      if (req.user.role !== 'admin' && booking.email !== req.user.email) {
        return res.status(403).json({ message: 'You can only cancel your own bookings.' });
      }

      if (booking.status === 'Cancelled') {
        return res.status(400).json({ message: 'This booking is already cancelled.' });
      }

      booking.status = 'Cancelled';
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
      return res.status(201).json(populatedReview);
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
  .finally(() => {
    app.listen(PORT, () => {
      const mode = databaseReady ? 'database' : 'demo';
      console.log(`Wellness backend running at http://localhost:${PORT} (${mode} mode)`);
    });
  });
