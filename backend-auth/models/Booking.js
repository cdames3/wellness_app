const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    membershipNumber: {
      type: String,
      required: true,
      trim: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    locationId: {
      type: String,
      required: true,
      trim: true,
    },
    locationName: {
      type: String,
      required: true,
      trim: true,
    },
    locationAddress: {
      type: String,
      required: true,
      trim: true,
    },
    instructorName: {
      type: String,
      trim: true,
      default: '',
    },
    slotTime: {
      type: String,
      required: true,
      trim: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Approved',
    },
    attendanceStatus: {
      type: String,
      enum: ['Scheduled', 'Attended', 'No-show'],
      default: 'Scheduled',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Unpaid', 'Credit Applied'],
      default: 'Unpaid',
    },
    paymentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentCardholderName: {
      type: String,
      trim: true,
      default: '',
    },
    paymentLast4: {
      type: String,
      trim: true,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    noShowFeeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditEligible: {
      type: Boolean,
      default: false,
    },
    creditSourceBookingId: {
      type: String,
      trim: true,
      default: '',
    },
    creditRedeemedForBookingId: {
      type: String,
      trim: true,
      default: '',
    },
    attendanceMarkedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
