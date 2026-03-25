const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateRegisterPayload,
  validateLoginPayload,
  validateServicePayload,
  validateBookingPayload,
  validateReviewPayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
} = require('../lib/validation');

test('register validation accepts a valid member payload', () => {
  const result = validateRegisterPayload({
    name: 'Vitoria Lima',
    email: 'vitoria@example.com',
    password: 'securepass123',
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.email, 'vitoria@example.com');
});

test('register validation rejects short passwords', () => {
  const result = validateRegisterPayload({
    name: 'Vitoria Lima',
    email: 'vitoria@example.com',
    password: 'short',
  });

  assert.ok(result.errors.includes('Your password must be between 8 and 128 characters.'));
});

test('login validation requires an identifier and password', () => {
  const result = validateLoginPayload({
    identifier: '',
    password: '',
  });

  assert.equal(result.errors.length, 2);
});

test('service validation normalizes and validates pricing inputs', () => {
  const result = validateServicePayload({
    name: ' Pilates Flow ',
    description: 'A polished low-impact pilates experience with guided instruction.',
    category: 'Class',
    durationMinutes: 60,
    capacity: 8,
    price: 32,
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.value.name, 'Pilates Flow');
  assert.equal(result.value.price, 32);
});

test('booking validation requires a valid card or credit source', () => {
  const invalid = validateBookingPayload({
    serviceId: 'abc',
    bookingDate: '2026-05-12',
    slotTime: '09:00',
    locationId: 'atlanta-buckhead',
    paymentCardholderName: 'Vitoria Lima',
    paymentCardLast4: '12',
    paymentCardDigitsCount: 12,
  });

  assert.ok(invalid.errors.includes('Please enter any 16-digit demo card number.'));

  const valid = validateBookingPayload({
    serviceId: 'abc',
    bookingDate: '2026-05-12',
    slotTime: '09:00',
    locationId: 'atlanta-buckhead',
    paymentCardholderName: 'Vitoria Lima',
    paymentCardLast4: '4242',
    paymentCardDigitsCount: 16,
  });

  assert.deepEqual(valid.errors, []);
});

test('review validation only accepts whole-number ratings from 1 to 5', () => {
  const invalid = validateReviewPayload({
    bookingId: 'booking-1',
    rating: 6,
    comment: 'Great class.',
  });

  assert.ok(invalid.errors.includes('Rating must be a whole number from 1 to 5.'));
});

test('forgot password validation requires a real email', () => {
  const result = validateForgotPasswordPayload({ email: 'not-an-email' });
  assert.ok(result.errors.includes('Please enter a valid email address.'));
});

test('reset password validation requires a token and a strong password', () => {
  const result = validateResetPasswordPayload({
    token: '',
    password: 'short',
  });

  assert.ok(result.errors.includes('A valid reset token is required.'));
  assert.ok(result.errors.includes('Your new password must be between 8 and 128 characters.'));
});
