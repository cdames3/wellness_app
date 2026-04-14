function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function buildAppointmentDate(date, time) {
  return new Date(`${date}T${time}:00`);
}

function isSelfLedService(service) {
  return service?.bookingMode === 'self-led' || String(service?.name || '').toLowerCase().includes('open gym');
}

function isUpcomingAppointment(appointmentDate, now = new Date()) {
  const appointment = appointmentDate instanceof Date ? appointmentDate : new Date(appointmentDate);
  return !Number.isNaN(appointment.getTime()) && appointment.getTime() > now.getTime();
}

function calculateNoShowOutcome({ service, paymentAmount = 0, fallbackPrice = 0 }) {
  if (isSelfLedService(service)) {
    return {
      creditEligible: true,
      noShowFeeAmount: 0,
    };
  }

  return {
    creditEligible: false,
    noShowFeeAmount: roundCurrency(Number(paymentAmount || fallbackPrice || 0) * 0.2),
  };
}

module.exports = {
  roundCurrency,
  buildAppointmentDate,
  isSelfLedService,
  isUpcomingAppointment,
  calculateNoShowOutcome,
};
