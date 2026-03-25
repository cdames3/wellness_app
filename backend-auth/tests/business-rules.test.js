const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAppointmentDate,
  isUpcomingAppointment,
  isSelfLedService,
  calculateNoShowOutcome,
  roundCurrency,
} = require('../lib/business-rules');

test('buildAppointmentDate creates a valid local appointment date', () => {
  const appointment = buildAppointmentDate('2026-04-18', '09:30');
  assert.equal(Number.isNaN(appointment.getTime()), false);
  assert.equal(appointment.getHours(), 9);
  assert.equal(appointment.getMinutes(), 30);
});

test('isUpcomingAppointment distinguishes future and past classes', () => {
  const now = new Date('2026-04-18T10:00:00');

  assert.equal(isUpcomingAppointment('2026-04-18T11:00:00', now), true);
  assert.equal(isUpcomingAppointment('2026-04-18T09:59:00', now), false);
});

test('isSelfLedService recognizes open gym sessions', () => {
  assert.equal(isSelfLedService({ name: 'Open Gym Session', bookingMode: 'self-led' }), true);
  assert.equal(isSelfLedService({ name: 'Pilates Flow', bookingMode: 'instructor-led' }), false);
});

test('calculateNoShowOutcome gives open gym a credit without a fee', () => {
  const outcome = calculateNoShowOutcome({
    service: { name: 'Open Gym Session', bookingMode: 'self-led' },
    paymentAmount: 22,
  });

  assert.deepEqual(outcome, {
    creditEligible: true,
    noShowFeeAmount: 0,
  });
});

test('calculateNoShowOutcome charges 20 percent for guided services', () => {
  const outcome = calculateNoShowOutcome({
    service: { name: 'Pilates Flow', bookingMode: 'instructor-led' },
    paymentAmount: 32,
  });

  assert.deepEqual(outcome, {
    creditEligible: false,
    noShowFeeAmount: 6.4,
  });
});

test('roundCurrency rounds to the nearest cent', () => {
  assert.equal(roundCurrency(6.405), 6.41);
});
