const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeText(value, maxLength = 500) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(value) {
  return EMAIL_REGEX.test(String(value || '').trim().toLowerCase());
}

function isValidDateInput(value) {
  const normalized = String(value || '').trim();
  if (!DATE_REGEX.test(normalized)) {
    return false;
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function isValidTimeInput(value) {
  return TIME_REGEX.test(String(value || '').trim());
}

function parsePositiveInteger(value, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function parsePrice(value, { min = 0, max = 10000 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function normalizeCardLast4(value) {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  return digitsOnly.length === 4 ? digitsOnly : '';
}

function validateRegisterPayload(payload = {}) {
  const name = normalizeText(payload.name, 80);
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '').trim();
  const errors = [];

  if (name.length < 2) {
    errors.push('Please enter your full name.');
  }

  if (!isValidEmail(email)) {
    errors.push('Please enter a valid email address.');
  }

  if (password.length < 8 || password.length > 128) {
    errors.push('Your password must be between 8 and 128 characters.');
  }

  return {
    errors,
    value: { name, email, password },
  };
}

function validateLoginPayload(payload = {}) {
  const identifier = normalizeText(payload.identifier || payload.email, 120);
  const password = String(payload.password || '').trim();
  const errors = [];

  if (!identifier) {
    errors.push('Email or membership number is required.');
  }

  if (!password) {
    errors.push('Password is required.');
  }

  return {
    errors,
    value: { identifier, password },
  };
}

function validateTokenPayload(payload = {}, tokenLabel = 'token') {
  const token = normalizeText(payload.token, 200);
  const errors = [];

  if (!token) {
    errors.push(`A valid ${tokenLabel} is required.`);
  }

  return {
    errors,
    value: { token },
  };
}

function validateForgotPasswordPayload(payload = {}) {
  const email = String(payload.email || '').trim().toLowerCase();
  const errors = [];

  if (!isValidEmail(email)) {
    errors.push('Please enter a valid email address.');
  }

  return {
    errors,
    value: { email },
  };
}

function validateResetPasswordPayload(payload = {}) {
  const tokenResult = validateTokenPayload(payload, 'reset token');
  const password = String(payload.password || '').trim();
  const errors = [...tokenResult.errors];

  if (password.length < 8 || password.length > 128) {
    errors.push('Your new password must be between 8 and 128 characters.');
  }

  return {
    errors,
    value: {
      token: tokenResult.value.token,
      password,
    },
  };
}

function validateProfilePayload(payload = {}) {
  const value = {};
  const errors = [];

  if (payload.name !== undefined) {
    const name = normalizeText(payload.name, 80);
    if (name.length < 2) {
      errors.push('Name must be at least 2 characters.');
    } else {
      value.name = name;
    }
  }

  if (payload.email !== undefined) {
    const email = String(payload.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      errors.push('Please enter a valid email address.');
    } else {
      value.email = email;
    }
  }

  if (payload.currentPassword !== undefined) {
    value.currentPassword = String(payload.currentPassword || '').trim();
  }

  if (payload.newPassword !== undefined) {
    const newPassword = String(payload.newPassword || '').trim();
    if (newPassword && (newPassword.length < 8 || newPassword.length > 128)) {
      errors.push('Your new password must be between 8 and 128 characters.');
    } else {
      value.newPassword = newPassword;
    }
  }

  if (payload.membershipActive !== undefined) {
    value.membershipActive = Boolean(payload.membershipActive);
  }

  return { errors, value };
}

function validateServicePayload(payload = {}) {
  const name = normalizeText(payload.name, 80);
  const description = normalizeText(payload.description, 600);
  const category = normalizeText(payload.category, 40);
  const durationMinutes = parsePositiveInteger(payload.durationMinutes, { min: 15, max: 240 });
  const capacity = parsePositiveInteger(payload.capacity, { min: 1, max: 200 });
  const price = parsePrice(payload.price, { min: 0, max: 10000 });
  const active = payload.active === undefined ? true : Boolean(payload.active);
  const errors = [];

  if (name.length < 2) {
    errors.push('Service name must be at least 2 characters.');
  }

  if (description.length < 12) {
    errors.push('Service description must be at least 12 characters.');
  }

  if (!category) {
    errors.push('Service category is required.');
  }

  if (durationMinutes === null) {
    errors.push('Duration must be between 15 and 240 minutes.');
  }

  if (capacity === null) {
    errors.push('Capacity must be between 1 and 200.');
  }

  if (price === null) {
    errors.push('Price must be a valid dollar amount.');
  }

  return {
    errors,
    value: {
      name,
      description,
      category,
      durationMinutes,
      capacity,
      price,
      active,
    },
  };
}

function validateInstructorPayload(payload = {}) {
  const name = normalizeText(payload.name, 80);
  const title = normalizeText(payload.title, 80);
  const email = String(payload.email || '').trim().toLowerCase();
  const phone = normalizeText(payload.phone, 40);
  const bio = normalizeText(payload.bio, 800);
  const active = payload.active === undefined ? true : Boolean(payload.active);
  const serviceIds = Array.isArray(payload.serviceIds)
    ? payload.serviceIds.map((item) => normalizeText(item, 120)).filter(Boolean)
    : [];
  const locationIds = Array.isArray(payload.locationIds)
    ? payload.locationIds.map((item) => normalizeText(item, 80)).filter(Boolean)
    : [];
  const weeklyAvailability = Array.isArray(payload.weeklyAvailability)
    ? payload.weeklyAvailability
        .map((block) => ({
          dayOfWeek: Number(block?.dayOfWeek),
          locationId: normalizeText(block?.locationId, 80),
          startTime: String(block?.startTime || '').trim(),
          endTime: String(block?.endTime || '').trim(),
        }))
        .filter((block) => block.locationId || block.startTime || block.endTime)
    : [];
  const errors = [];

  if (name.length < 2) {
    errors.push('Instructor name must be at least 2 characters.');
  }

  if (title.length < 2) {
    errors.push('Instructor title is required.');
  }

  if (!isValidEmail(email)) {
    errors.push('Please enter a valid instructor email address.');
  }

  if (phone.length < 7) {
    errors.push('Please enter a phone number for the instructor.');
  }

  if (bio.length < 12) {
    errors.push('Please add a short instructor bio.');
  }

  if (serviceIds.length === 0) {
    errors.push('Assign the instructor to at least one service.');
  }

  if (locationIds.length === 0) {
    errors.push('Assign the instructor to at least one location.');
  }

  if (weeklyAvailability.length === 0) {
    errors.push('Add at least one weekly availability window.');
  }

  weeklyAvailability.forEach((block, index) => {
    if (!Number.isInteger(block.dayOfWeek) || block.dayOfWeek < 0 || block.dayOfWeek > 6) {
      errors.push(`Availability row ${index + 1} must have a valid day of week.`);
    }

    if (!block.locationId) {
      errors.push(`Availability row ${index + 1} must include a location.`);
    }

    if (!isValidTimeInput(block.startTime) || !isValidTimeInput(block.endTime)) {
      errors.push(`Availability row ${index + 1} must use HH:MM time values.`);
      return;
    }

    const [startHour, startMinute] = block.startTime.split(':').map(Number);
    const [endHour, endMinute] = block.endTime.split(':').map(Number);
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    if (endTotal <= startTotal) {
      errors.push(`Availability row ${index + 1} must end after it starts.`);
    }
  });

  return {
    errors,
    value: {
      name,
      title,
      email,
      phone,
      bio,
      active,
      serviceIds: Array.from(new Set(serviceIds)),
      locationIds: Array.from(new Set(locationIds)),
      weeklyAvailability,
    },
  };
}

function validateOverridePayload(payload = {}) {
  const date = String(payload.date || '').trim();
  const time = String(payload.time || '').trim();
  const locationId = normalizeText(payload.locationId, 80);
  const instructorName = normalizeText(payload.instructorName, 80);
  const errors = [];

  if (!isValidDateInput(date)) {
    errors.push('Override date must use YYYY-MM-DD format.');
  }

  if (!isValidTimeInput(time)) {
    errors.push('Override time must use HH:MM format.');
  }

  if (!locationId) {
    errors.push('Location is required for an override.');
  }

  if (instructorName.length < 2) {
    errors.push('Instructor name is required.');
  }

  return {
    errors,
    value: { date, time, locationId, instructorName },
  };
}

function validateBookingPayload(payload = {}) {
  const serviceId = normalizeText(payload.serviceId, 120);
  const bookingDate = String(payload.bookingDate || '').trim();
  const slotTime = String(payload.slotTime || '').trim();
  const locationId = normalizeText(payload.locationId, 80);
  const instructorName = normalizeText(payload.instructorName, 80);
  const notes = normalizeText(payload.notes, 500);
  const paymentCardholderName = normalizeText(payload.paymentCardholderName, 80);
  const paymentCardLast4 = normalizeCardLast4(payload.paymentCardLast4);
  const paymentCardDigitsCount = parsePositiveInteger(payload.paymentCardDigitsCount, { min: 0, max: 32 }) ?? 0;
  const creditBookingId = normalizeText(payload.creditBookingId, 120);
  const errors = [];

  if (!serviceId) {
    errors.push('Service is required.');
  }

  if (!isValidDateInput(bookingDate)) {
    errors.push('Booking date must use YYYY-MM-DD format.');
  }

  if (!isValidTimeInput(slotTime)) {
    errors.push('Class time must use HH:MM format.');
  }

  if (!locationId) {
    errors.push('Location is required.');
  }

  if (!creditBookingId && paymentCardDigitsCount !== 16) {
    errors.push('Please enter any 16-digit demo card number.');
  }

  return {
    errors,
    value: {
      serviceId,
      bookingDate,
      slotTime,
      locationId,
      instructorName,
      notes,
      paymentCardholderName,
      paymentCardLast4,
      paymentCardDigitsCount,
      creditBookingId,
    },
  };
}

function validateReviewPayload(payload = {}) {
  const bookingId = normalizeText(payload.bookingId, 120);
  const rating = parsePositiveInteger(payload.rating, { min: 1, max: 5 });
  const comment = normalizeText(payload.comment, 1000);
  const errors = [];

  if (!bookingId) {
    errors.push('Booking is required.');
  }

  if (rating === null) {
    errors.push('Rating must be a whole number from 1 to 5.');
  }

  return {
    errors,
    value: { bookingId, rating, comment },
  };
}

function validateAdminUserPayload(payload = {}) {
  const action = normalizeText(payload.action, 20).toLowerCase();
  const adminTitle = normalizeText(payload.adminTitle, 80);
  const errors = [];

  if (!['promote', 'update', 'demote'].includes(action)) {
    errors.push('A valid admin user action is required.');
  }

  if (['promote', 'update'].includes(action) && adminTitle.length < 3) {
    errors.push('Please provide a role title for this admin.');
  }

  return {
    errors,
    value: {
      action,
      adminTitle,
    },
  };
}

module.exports = {
  normalizeText,
  isValidEmail,
  isValidDateInput,
  isValidTimeInput,
  parsePositiveInteger,
  parsePrice,
  normalizeCardLast4,
  validateRegisterPayload,
  validateLoginPayload,
  validateTokenPayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
  validateProfilePayload,
  validateServicePayload,
  validateInstructorPayload,
  validateOverridePayload,
  validateBookingPayload,
  validateReviewPayload,
  validateAdminUserPayload,
};
