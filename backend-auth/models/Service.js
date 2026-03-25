const mongoose = require('mongoose');

const serviceLocationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    instructors: {
      type: [String],
      default: [],
    },
    timeSlots: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const serviceScheduleSchema = new mongoose.Schema(
  {
    startHour: {
      type: Number,
      required: true,
      default: 6,
    },
    endHour: {
      type: Number,
      required: true,
      default: 20,
    },
    intervalMinutes: {
      type: Number,
      required: true,
      default: 60,
    },
  },
  { _id: false }
);

const scheduleOverrideSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    locationId: {
      type: String,
      required: true,
      trim: true,
    },
    instructorName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 15,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    bookingMode: {
      type: String,
      enum: ['self-led', 'instructor-led'],
      default: 'instructor-led',
    },
    schedule: {
      type: serviceScheduleSchema,
      default: () => ({
        startHour: 6,
        endHour: 20,
        intervalMinutes: 60,
      }),
    },
    locations: {
      type: [serviceLocationSchema],
      default: [],
    },
    scheduleOverrides: {
      type: [scheduleOverrideSchema],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Service', serviceSchema);
