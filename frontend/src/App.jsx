import { useEffect, useState } from 'react';
import coverPicture from './assets/cover-picture.jpg';
import gymImage from './assets/gym.jpg';
import massageImage from './assets/massage.jpg';
import pilatesImage from './assets/pilates.jpg';
import spaImage from './assets/sauna-spa.jpg';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
let csrfTokenCache = '';

const emptyRegisterForm = {
  name: '',
  email: '',
  password: '',
};

const emptyLoginForm = {
  identifier: '',
  password: '',
};

const emptyForgotPasswordForm = {
  email: '',
};

const emptyResetPasswordForm = {
  token: '',
  password: '',
  confirmPassword: '',
};

const emptyBookingForm = {
  serviceId: '',
  bookingDate: '',
  slotTime: '',
  locationId: '',
  preferredInstructorId: '',
  instructorName: '',
  notes: '',
  paymentCardholderName: '',
  paymentCardNumber: '',
};

const emptyProfileForm = {
  name: '',
  email: '',
  membershipNumber: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const emptyServiceForm = {
  id: '',
  name: '',
  description: '',
  durationMinutes: 60,
  category: '',
  capacity: 1,
  price: 0,
  active: true,
};

const emptyReviewForm = {
  bookingId: '',
  rating: 5,
  comment: '',
};

const emptyAdminUserForm = {
  adminTitle: '',
};

const emptyOverrideForm = {
  serviceId: '',
  date: '',
  locationId: '',
  time: '',
  instructorName: '',
};

function createEmptyInstructorForm(defaultLocationId = '') {
  return {
    id: '',
    name: '',
    title: '',
    email: '',
    phone: '',
    bio: '',
    active: true,
    serviceIds: [],
    locationIds: defaultLocationId ? [defaultLocationId] : [],
    weeklyAvailability: [
      {
        dayOfWeek: 1,
        locationId: defaultLocationId,
        startTime: '06:00',
        endTime: '14:00',
      },
    ],
  };
}

const emptyInstructorAvailabilityExplorer = {
  instructorId: '',
  serviceId: '',
  locationId: '',
  date: '',
};

const servicePresentation = {
  'Pilates Flow': {
    eyebrow: 'Strength & Flow',
    blurb: 'Low-impact movement with studio calm and clean form-focused instruction.',
    image: pilatesImage,
  },
  'Deep Tissue Massage': {
    eyebrow: 'Body Recovery',
    blurb: 'Restorative hands-on treatment with warm lighting and spa-level comfort.',
    image: massageImage,
  },
  'Spa Reset': {
    eyebrow: 'Heat & Restore',
    blurb: 'An enveloping reset with warm wood, steam tones, and quiet recovery energy.',
    image: spaImage,
  },
  'Open Gym Session': {
    eyebrow: 'Conditioning',
    blurb: 'Independent training in a modern gym setting with room to focus and move.',
    image: gymImage,
  },
};

const weekdayOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function formatBookingDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatPrice(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatBookingStatusLabel(status) {
  if (status === 'Approved') {
    return 'Booked';
  }

  return status;
}

function formatAttendanceStatusLabel(status) {
  if (status === 'No-show') {
    return 'No-show';
  }

  if (status === 'Attended') {
    return 'Attended';
  }

  return 'Scheduled';
}

function formatPaymentStatusLabel(status) {
  if (status === 'Credit Applied') {
    return 'Credit applied';
  }

  return status || 'Paid';
}

function createSessionKey(booking) {
  const serviceId = booking.service?._id || booking.service;
  return [
    serviceId,
    booking.locationId,
    new Date(booking.appointmentDate).toISOString(),
  ].join('::');
}

function buildAppointmentDate(date, time) {
  return new Date(`${date}T${time}:00`);
}

function isUpcomingAppointment(value) {
  const appointment = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(appointment.getTime()) && appointment.getTime() > Date.now();
}

function isSelfLedService(service) {
  return service?.bookingMode === 'self-led' || String(service?.name || '').toLowerCase().includes('open gym');
}

function getServicePresentation(service) {
  return (
    servicePresentation[service.name] || {
      eyebrow: service.category,
      blurb: service.description,
      visualClass: 'visual-default',
    }
  );
}

function getServiceKey(value) {
  return String(value?._id || value || '');
}

function buildServiceRatingMap(reviewList) {
  return reviewList.reduce((ratingsMap, review) => {
    const serviceKey = getServiceKey(review.service?._id || review.service);
    if (!serviceKey) {
      return ratingsMap;
    }

    if (!ratingsMap[serviceKey]) {
      ratingsMap[serviceKey] = [];
    }

    ratingsMap[serviceKey].push(Number(review.rating || 0));
    return ratingsMap;
  }, {});
}

function getMedianRatingSummary(ratings) {
  if (!ratings || ratings.length === 0) {
    return {
      count: 0,
      roundedMedian: 0,
      stars: '☆☆☆☆☆',
      label: 'No ratings yet',
    };
  }

  const sortedRatings = ratings.slice().sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedRatings.length / 2);
  const rawMedian =
    sortedRatings.length % 2 === 0
      ? (sortedRatings[middleIndex - 1] + sortedRatings[middleIndex]) / 2
      : sortedRatings[middleIndex];
  const roundedMedian = Math.min(5, Math.max(1, Math.ceil(rawMedian)));

  return {
    count: ratings.length,
    roundedMedian,
    stars: `${'★'.repeat(roundedMedian)}${'☆'.repeat(5 - roundedMedian)}`,
    label: `${roundedMedian}/5 median from ${ratings.length} review${ratings.length === 1 ? '' : 's'}`,
  };
}

function formatMonthLabel(date) {
  return date.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function createCalendarCells(monthDate, sessions) {
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const gridStart = new Date(startOfMonth);
  gridStart.setDate(startOfMonth.getDate() - startOfMonth.getDay());
  const gridEnd = new Date(endOfMonth);
  gridEnd.setDate(endOfMonth.getDate() + (6 - endOfMonth.getDay()));
  const todayKey = new Date().toDateString();

  const cells = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    const cellDate = new Date(cursor);
    const sessionsForDay = sessions.filter((session) => {
      const sessionDate = new Date(session.appointmentDate);
      return sessionDate.toDateString() === cellDate.toDateString();
    });

    cells.push({
      key: cellDate.toISOString(),
      label: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === monthDate.getMonth(),
      isToday: cellDate.toDateString() === todayKey,
      sessions: sessionsForDay,
    });
  }

  return cells;
}

function addDays(baseDate, amount) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function padTime(value) {
  return String(value).padStart(2, '0');
}

function getCookieValue(name) {
  const cookieMatch = document.cookie
    .split(';')
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(`${name}=`));

  if (!cookieMatch) {
    return '';
  }

  return decodeURIComponent(cookieMatch.slice(name.length + 1));
}

function setCsrfToken(token) {
  csrfTokenCache = String(token || '').trim();
}

function clearCsrfToken() {
  csrfTokenCache = '';
}

function formatTimeLabel(timeValue) {
  const [hourValue, minuteValue] = String(timeValue).split(':').map(Number);
  const period = hourValue >= 12 ? 'PM' : 'AM';
  const normalizedHour = hourValue % 12 === 0 ? 12 : hourValue % 12;
  return `${normalizedHour}:${padTime(minuteValue)} ${period}`;
}

function timeValueToMinutes(value) {
  const [hourValue, minuteValue] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
    return Number.NaN;
  }

  return (hourValue * 60) + minuteValue;
}

function formatHourLabel(hourValue) {
  if (Number(hourValue) === 24) {
    return '12:00 AM';
  }

  return formatTimeLabel(`${padTime(Number(hourValue) % 24)}:00`);
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

  const slotCount = Math.max(
    0,
    ((Number(service.schedule.endHour) - Number(service.schedule.startHour)) * 60) /
      Number(service.schedule.intervalMinutes || 60)
  );

  return Array.from({ length: slotCount }, (_, index) => {
    const totalMinutes = Number(service.schedule.startHour) * 60 + index * Number(service.schedule.intervalMinutes || 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${padTime(hours)}:${padTime(minutes)}`;
  });
}

function getOrderedAvailableInstructorNames(selectedLocation, assignedInstructorRecords, bookingDate, time) {
  const availableInstructorNames = assignedInstructorRecords
    .filter((instructor) => isInstructorAvailableForSlot(instructor, bookingDate, selectedLocation?.id, time))
    .map((instructor) => instructor.name);

  const locationInstructorOrder = Array.isArray(selectedLocation?.instructors)
    ? selectedLocation.instructors.map((name) => String(name))
    : [];

  const orderedByLocation = locationInstructorOrder.filter((name) => availableInstructorNames.includes(name));
  const remainingNames = availableInstructorNames.filter((name) => !orderedByLocation.includes(name));
  return [...orderedByLocation, ...remainingNames];
}

function isInstructorAvailableForSlot(instructor, bookingDate, locationId, time) {
  const slotDate = new Date(`${bookingDate}T00:00:00`);
  if (Number.isNaN(slotDate.getTime())) {
    return false;
  }

  const dayOfWeek = slotDate.getDay();
  const slotMinutes = timeValueToMinutes(time);

  return (instructor.weeklyAvailability || []).some((block) => {
    if (Number(block.dayOfWeek) !== dayOfWeek || String(block.locationId) !== String(locationId)) {
      return false;
    }

    const startMinutes = timeValueToMinutes(block.startTime);
    const endMinutes = timeValueToMinutes(block.endTime);
    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
  });
}

function getAssignedInstructorsForServiceLocation(service, locationId, instructorDirectory = []) {
  const serviceId = String(service?._id || '');
  if (!serviceId || !locationId) {
    return [];
  }

  return instructorDirectory.filter(
    (instructor) =>
      instructor.active !== false &&
      (instructor.serviceIds || []).map(String).includes(serviceId) &&
      (instructor.locationIds || []).map(String).includes(String(locationId))
  );
}

function generateServiceSlots(service, bookingDate, locationId, instructorDirectory = []) {
  if (!service?.schedule || !bookingDate) {
    return [];
  }

  const locations = Array.isArray(service.locations) ? service.locations : [];
  const selectedLocation = locations.find((location) => location.id === locationId) || locations[0];
  const assignedInstructorRecords = getAssignedInstructorsForServiceLocation(
    service,
    selectedLocation?.id,
    instructorDirectory
  );
  const timeValues = buildLocationTimeValues(service, selectedLocation);

  return timeValues.map((time, index) => {
    const matchingOverride = (service.scheduleOverrides || []).find(
      (override) =>
        override.date === bookingDate &&
        override.time === time &&
        override.locationId === selectedLocation?.id
    );
    const availableInstructorOptions =
      service.bookingMode === 'self-led'
        ? []
        : assignedInstructorRecords.length > 0
          ? getOrderedAvailableInstructorNames(selectedLocation, assignedInstructorRecords, bookingDate, time)
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
      defaultInstructor,
      instructorName: defaultInstructor,
      instructorOptions,
      availableInstructorOptions,
    };
  }).filter(
    (slot) =>
      isUpcomingAppointment(buildAppointmentDate(bookingDate, slot.time)) &&
      (service.bookingMode === 'self-led' || slot.instructorOptions.length > 0)
  );
}

async function apiRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const csrfToken = ['GET', 'HEAD', 'OPTIONS'].includes(method)
    ? ''
    : csrfTokenCache || getCookieValue('wellness_csrf');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (data?.csrfToken) {
    setCsrfToken(data.csrfToken);
  }

  if (!response.ok) {
    const requestError = new Error(data.message || 'Something went wrong.');
    requestError.status = response.status;
    throw requestError;
  }

  return data;
}

export default function App() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [memberPage, setMemberPage] = useState('book');
  const [adminPage, setAdminPage] = useState('services');
  const [adminServicesView, setAdminServicesView] = useState('overview');
  const [adminLocationsView, setAdminLocationsView] = useState('directory');
  const [adminInstructorsView, setAdminInstructorsView] = useState('overview');
  const [adminUsersView, setAdminUsersView] = useState('overview');
  const [adminScheduleView, setAdminScheduleView] = useState('overview');
  const [services, setServices] = useState([]);
  const [adminServices, setAdminServices] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [adminInstructors, setAdminInstructors] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [forgotPasswordForm, setForgotPasswordForm] = useState(emptyForgotPasswordForm);
  const [resetPasswordForm, setResetPasswordForm] = useState(emptyResetPasswordForm);
  const [bookingForm, setBookingForm] = useState(emptyBookingForm);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [instructorForm, setInstructorForm] = useState(() => createEmptyInstructorForm());
  const [reviewForm, setReviewForm] = useState(emptyReviewForm);
  const [adminUserForm, setAdminUserForm] = useState(emptyAdminUserForm);
  const [overrideForm, setOverrideForm] = useState(emptyOverrideForm);
  const [availabilityExplorer, setAvailabilityExplorer] = useState(emptyInstructorAvailabilityExplorer);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [instructorLoading, setInstructorLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [adminUserLoading, setAdminUserLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [authTransition, setAuthTransition] = useState(null);
  const [recentBooking, setRecentBooking] = useState(null);
  const [creditBookingId, setCreditBookingId] = useState('');
  const [editingServiceId, setEditingServiceId] = useState('');
  const [editingServiceForm, setEditingServiceForm] = useState(emptyServiceForm);
  const [editingInstructorId, setEditingInstructorId] = useState('');
  const [editingAdminUserId, setEditingAdminUserId] = useState('');
  const [editingAdminUserMode, setEditingAdminUserMode] = useState('');
  const [selectedAdminLocationId, setSelectedAdminLocationId] = useState('');
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    async function loadPublicData() {
      try {
        const [serviceData, reviewData, instructorData] = await Promise.all([
          apiRequest('/services'),
          apiRequest('/reviews'),
          apiRequest('/instructors'),
        ]);
        setServices(serviceData);
        setReviews(reviewData);
        setInstructors(instructorData);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingServices(false);
      }
    }

    loadPublicData();
  }, []);

  useEffect(() => {
    let ignore = false;

    async function restoreSession() {
      try {
        const data = await apiRequest('/auth/me');
        if (ignore) {
          return;
        }
        setUser(data.user);
        setView('app');
      } catch {
        if (!ignore) {
          clearSessionState();
        }
      } finally {
        if (!ignore) {
          setAuthChecking(false);
        }
      }
    }

    restoreSession();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (authChecking) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const token = params.get('token') || '';

    if (mode === 'reset-password' && token) {
      setResetPasswordForm((current) => ({
        ...current,
        token,
      }));
      setView('reset-password');
      return;
    }

    if (mode === 'verify-email' && token) {
      setVerificationToken(token);
      setView('verify-email');
    }
  }, [authChecking]);

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user?._id]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminServices();
      loadAdminInstructors();
      loadAdminUsers();
    }
  }, [user?._id, user?.role]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        membershipNumber: user.membershipNumber || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (services.length > 0) {
      setBookingForm((current) => {
        const selectedService = services.find((service) => service._id === current.serviceId) || services[0];
        const firstLocation = selectedService?.locations?.[0];
        return {
          ...current,
          serviceId: selectedService?._id || '',
          locationId: current.locationId || firstLocation?.id || '',
        };
      });
    }
  }, [services]);

  useEffect(() => {
    if (adminServices.length > 0) {
      setOverrideForm((current) => {
        const selectedService = adminServices.find((service) => service._id === current.serviceId) || adminServices[0];
        const firstLocation = selectedService?.locations?.[0];
        return {
          ...current,
          serviceId: selectedService?._id || '',
          locationId: current.locationId || firstLocation?.id || '',
        };
      });
    }
  }, [adminServices]);

  useEffect(() => {
    if (adminServices.length === 0) {
      return;
    }

    const defaultLocationId =
      adminServices.flatMap((service) => service.locations || []).find(Boolean)?.id || '';

    setInstructorForm((current) => {
      const hasRealLocation = current.locationIds.length > 0 || current.weeklyAvailability.some((block) => block.locationId);
      if (hasRealLocation) {
        return current;
      }

      return createEmptyInstructorForm(defaultLocationId);
    });
  }, [adminServices]);

  useEffect(() => {
    if (adminInstructors.length === 0 || adminServices.length === 0) {
      return;
    }

    setAvailabilityExplorer((current) => {
      const nextInstructor = adminInstructors.find((instructor) => instructor._id === current.instructorId) || adminInstructors[0];
      const nextService =
        adminServices.find((service) =>
          (nextInstructor.serviceIds || []).map(String).includes(String(service._id))
        ) || adminServices[0];
      const nextLocation =
        (nextService?.locations || []).find((location) => (nextInstructor.locationIds || []).includes(location.id)) ||
        nextService?.locations?.[0];

      return {
        instructorId: nextInstructor?._id || '',
        serviceId: current.serviceId || nextService?._id || '',
        locationId: current.locationId || nextLocation?.id || '',
        date: current.date,
      };
    });
  }, [adminInstructors, adminServices]);

  useEffect(() => {
    if (user?.role === 'user') {
      setMemberPage('book');
    }
  }, [user?._id, user?.role]);

  useEffect(() => {
    if (user?.role === 'admin') {
      setAdminPage('services');
      setAdminServicesView('overview');
      setAdminLocationsView('directory');
      setAdminInstructorsView('overview');
      setAdminUsersView('overview');
      setAdminScheduleView('overview');
    }
  }, [user?._id, user?.role]);

  useEffect(() => {
    if (adminInstructorsView !== 'editor' || !editingInstructorId) {
      return;
    }

    const fallbackLocationId =
      adminServices.flatMap((service) => service.locations || []).find(Boolean)?.id || '';

    setEditingInstructorId('');
    setInstructorForm(createEmptyInstructorForm(fallbackLocationId));
  }, [adminInstructorsView, editingInstructorId, adminServices]);

  useEffect(() => {
    const nextShowAuth = !user || view !== 'app';
    if (nextShowAuth) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [user, view, memberPage, adminPage, adminServicesView, adminLocationsView, adminInstructorsView, adminUsersView, adminScheduleView]);

  useEffect(() => {
    if (!message && !error) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage('');
      setError('');
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [message, error]);

  useEffect(() => {
    if (!authTransition) {
      return undefined;
    }

    const fadeTimeoutId = window.setTimeout(() => {
      setAuthTransition((current) => (current ? { ...current, phase: 'fade' } : null));
    }, 1700);

    const clearTimeoutId = window.setTimeout(() => {
      setAuthTransition(null);
    }, 2450);

    return () => {
      window.clearTimeout(fadeTimeoutId);
      window.clearTimeout(clearTimeoutId);
    };
  }, [authTransition?.title, authTransition?.text]);

  async function refreshPublicData() {
    const [serviceData, reviewData, instructorData] = await Promise.all([
      apiRequest('/services'),
      apiRequest('/reviews'),
      apiRequest('/instructors'),
    ]);
    setServices(serviceData);
    setReviews(reviewData);
    setInstructors(instructorData);
  }

  async function loadBookings() {
    if (!user) {
      return;
    }

    setLoadingBookings(true);
    try {
      const data = await apiRequest('/bookings');
      setBookings(data);
    } catch (loadError) {
      if (!handleSessionError(loadError)) {
        setError(loadError.message);
      }
    } finally {
      setLoadingBookings(false);
    }
  }

  async function loadAdminServices() {
    if (user?.role !== 'admin') {
      return;
    }

    try {
      const data = await apiRequest('/admin/services');
      setAdminServices(data);
    } catch (loadError) {
      if (!handleSessionError(loadError)) {
        setError(loadError.message);
      }
    }
  }

  async function loadAdminInstructors() {
    if (user?.role !== 'admin') {
      return;
    }

    try {
      const data = await apiRequest('/admin/instructors');
      setAdminInstructors(data);
    } catch (loadError) {
      if (!handleSessionError(loadError)) {
        setError(loadError.message);
      }
    }
  }

  async function loadAdminUsers() {
    if (user?.role !== 'admin') {
      return;
    }

    try {
      const data = await apiRequest('/admin/users');
      setAdminUsers(data);
    } catch (loadError) {
      if (!handleSessionError(loadError)) {
        setError(loadError.message);
      }
    }
  }

  function clearSessionState() {
    clearCsrfToken();
    setUser(null);
    setAuthChecking(false);
    setView('login');
    setMemberPage('book');
    setAdminPage('services');
    setAdminUsersView('overview');
    setBookings([]);
    setRecentBooking(null);
    setCreditBookingId('');
    setEditingServiceId('');
    setEditingServiceForm(emptyServiceForm);
    setForgotPasswordForm(emptyForgotPasswordForm);
    setResetPasswordForm(emptyResetPasswordForm);
    setVerificationToken('');
    setAuthTransition(null);
    setAdminInstructors([]);
    setAdminUsers([]);
    setEditingInstructorId('');
    setEditingAdminUserId('');
    setEditingAdminUserMode('');
    setInstructorForm(createEmptyInstructorForm());
    setAdminUserForm(emptyAdminUserForm);
    setAvailabilityExplorer(emptyInstructorAvailabilityExplorer);
  }

  function clearAuthQueryParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    url.searchParams.delete('token');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }

  function startAuthTransition(config) {
    setAuthTransition({
      ...config,
      phase: 'active',
    });
  }

  function handleSessionError(requestError) {
    if (requestError?.status !== 401) {
      return false;
    }

    clearSessionState();
    setError('Your session expired. Please log in again.');
    return true;
  }

  async function handleLogout() {
    setMessage('');
    setError('');

    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      clearSessionState();
      clearAuthQueryParams();
      window.location.replace(window.location.pathname || '/');
    } catch (logoutError) {
      if (!handleSessionError(logoutError)) {
        setError('We could not fully sign you out. Please try again.');
      }
    }
  }

  function updateForm(setter) {
    return (event) => {
      const { name, value } = event.target;
      let nextValue = value;

      if (name === 'email') {
        nextValue = String(value || '').toLowerCase();
      }

      if (name === 'identifier' && String(value || '').includes('@')) {
        nextValue = String(value || '').toLowerCase();
      }

      setter((current) => ({ ...current, [name]: nextValue }));
    };
  }

  async function handleRegister(event) {
    event.preventDefault();
    setAuthLoading(true);
    setMessage('');
    setError('');

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm),
      });

      if (data?.csrfToken) {
        setCsrfToken(data.csrfToken);
      }
      setUser(data.user);
      setRegisterForm(emptyRegisterForm);
      setView('app');
      startAuthTransition({
        title: 'Account created',
        text: data.message || `Your membership number is ${data.user.membershipNumber}.`,
      });
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthLoading(true);
    setMessage('');
    setError('');

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      });

      if (data?.csrfToken) {
        setCsrfToken(data.csrfToken);
      }
      setUser(data.user);
      setLoginForm(emptyLoginForm);
      setView('app');
      startAuthTransition({
        title: data.user.role === 'admin' ? 'Admin signed in' : 'Welcome back',
        text:
          data.message ||
          (data.user.role === 'admin'
            ? 'Studio operations are ready.'
            : 'Your booking dashboard is ready.'),
      });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setAuthLoading(true);
    setMessage('');
    setError('');

    try {
      const data = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(forgotPasswordForm),
      });

      setForgotPasswordForm(emptyForgotPasswordForm);
      setView('login');
      setMessage(data.message || 'Password reset instructions have been sent if the account exists.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setAuthLoading(true);
    setMessage('');
    setError('');

    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setAuthLoading(false);
      setError('Your new password and confirmation password do not match.');
      return;
    }

    try {
      const data = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: resetPasswordForm.token,
          password: resetPasswordForm.password,
        }),
      });

      clearAuthQueryParams();
      setResetPasswordForm(emptyResetPasswordForm);
      setView('login');
      setMessage(data.message || 'Your password has been reset.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyEmail() {
    if (!verificationToken) {
      setError('That verification link is missing a token.');
      return;
    }

    setAuthLoading(true);
    setMessage('');
    setError('');

    try {
      const data = await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verificationToken }),
      });

      clearAuthQueryParams();
      setVerificationToken('');
      if (data.user && user && data.user._id === user._id) {
        setUser(data.user);
        setView('app');
      } else {
        setView(user ? 'app' : 'login');
      }
      setMessage(data.message || 'Your email has been verified.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRequestVerification() {
    setProfileLoading(true);
    setMessage('');
    setError('');

    try {
      const data = await apiRequest('/auth/request-verification', {
        method: 'POST',
      });
      setMessage(data.message || 'Verification email sent.');
    } catch (requestError) {
      if (!handleSessionError(requestError)) {
        setError(requestError.message);
      }
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();
    setBookingLoading(true);
    setMessage('');
    setError('');

    try {
      const paymentCardDigits = bookingForm.paymentCardNumber.replace(/\D/g, '');
      const paymentCardLast4 = paymentCardDigits.slice(-4);

      if (!isUsingCreditForBooking && paymentCardDigits.length !== 16) {
        throw new Error('Please enter any 16-digit demo card number.');
      }

      const createdBooking = await apiRequest(
        '/bookings',
        {
          method: 'POST',
          body: JSON.stringify({
            serviceId: bookingForm.serviceId,
            bookingDate: bookingForm.bookingDate,
            slotTime: bookingForm.slotTime,
            locationId: bookingForm.locationId,
            instructorName: bookingForm.instructorName,
            notes: bookingForm.notes,
            paymentCardholderName: bookingForm.paymentCardholderName,
            paymentCardLast4,
            paymentCardDigitsCount: paymentCardDigits.length,
            creditBookingId,
          }),
        }
      );

      setBookingForm((current) => {
        const selectedService = services.find((service) => service._id === current.serviceId);
        return {
          ...emptyBookingForm,
          serviceId: current.serviceId,
          locationId: selectedService?.locations?.[0]?.id || current.locationId,
        };
      });
      setRecentBooking(createdBooking);
      setCreditBookingId('');
      await loadBookings();
      setMessage(
        createdBooking.paymentStatus === 'Credit Applied'
          ? 'Your class is booked and your Open Gym credit was applied.'
          : 'Your class is booked and your payment was received.'
      );
    } catch (bookingError) {
      if (!handleSessionError(bookingError)) {
        setError(bookingError.message);
      }
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileLoading(true);
    setMessage('');
    setError('');

    try {
      if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
        throw new Error('Your new password and confirmation password do not match.');
      }

      const data = await apiRequest(
        '/auth/me',
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: profileForm.name,
            email: profileForm.email,
            currentPassword: profileForm.currentPassword,
            newPassword: profileForm.newPassword,
          }),
        }
      );

      setUser(data.user);
      setProfileForm((current) => ({
        ...current,
        name: data.user.name,
        email: data.user.email,
        membershipNumber: data.user.membershipNumber,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setMessage(
        data.user.emailVerified
          ? 'Profile updated successfully.'
          : 'Profile updated. Please verify your email address.'
      );
    } catch (profileError) {
      if (!handleSessionError(profileError)) {
        setError(profileError.message);
      }
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleCancelBooking(bookingId) {
    setMessage('');
    setError('');

    try {
      await apiRequest(
        `/bookings/${bookingId}/cancel`,
        {
          method: 'PATCH',
        }
      );

      await loadBookings();
      setMessage('Booking cancelled.');
    } catch (cancelError) {
      if (!handleSessionError(cancelError)) {
        setError(cancelError.message);
      }
    }
  }

  async function handleServiceSubmit(event) {
    event.preventDefault();
    setServiceLoading(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        name: serviceForm.name,
        description: serviceForm.description,
        durationMinutes: Number(serviceForm.durationMinutes),
        category: serviceForm.category,
        capacity: Number(serviceForm.capacity),
        price: Number(serviceForm.price),
        active: serviceForm.active,
      };

      await apiRequest(
        '/admin/services',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setMessage('Service created.');

      setServiceForm(emptyServiceForm);
      await loadAdminServices();
      await loadAdminInstructors();
      await refreshPublicData();
    } catch (serviceError) {
      if (!handleSessionError(serviceError)) {
        setError(serviceError.message);
      }
    } finally {
      setServiceLoading(false);
    }
  }

  function toggleInstructorArrayField(fieldName, value) {
    setInstructorForm((current) => {
      const currentValues = Array.isArray(current[fieldName]) ? current[fieldName] : [];
      const exists = currentValues.includes(value);
      const nextValues = exists
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [fieldName]: nextValues,
        weeklyAvailability:
          fieldName === 'locationIds'
            ? current.weeklyAvailability.map((block) => ({
                ...block,
                locationId: nextValues.includes(block.locationId)
                  ? block.locationId
                  : nextValues[0] || '',
              }))
            : current.weeklyAvailability,
      };
    });
  }

  function updateInstructorAvailabilityRow(index, field, value) {
    setInstructorForm((current) => ({
      ...current,
      weeklyAvailability: current.weeklyAvailability.map((block, blockIndex) =>
        blockIndex === index ? { ...block, [field]: value } : block
      ),
    }));
  }

  function addInstructorAvailabilityRow() {
    setInstructorForm((current) => ({
      ...current,
      weeklyAvailability: [
        ...current.weeklyAvailability,
        {
          dayOfWeek: 1,
          locationId: current.locationIds[0] || '',
          startTime: '06:00',
          endTime: '14:00',
        },
      ],
    }));
  }

  function removeInstructorAvailabilityRow(index) {
    setInstructorForm((current) => ({
      ...current,
      weeklyAvailability:
        current.weeklyAvailability.length === 1
          ? current.weeklyAvailability
          : current.weeklyAvailability.filter((_, blockIndex) => blockIndex !== index),
    }));
  }

  function startEditingInstructor(instructor) {
    if (editingInstructorId === instructor._id) {
      resetInstructorEditor();
      return;
    }

    setEditingInstructorId(instructor._id);
    setInstructorForm({
      id: instructor._id,
      name: instructor.name || '',
      title: instructor.title || '',
      email: instructor.email || '',
      phone: instructor.phone || '',
      bio: instructor.bio || '',
      active: instructor.active !== false,
      serviceIds: (instructor.serviceIds || []).map(String),
      locationIds: (instructor.locationIds || []).map(String),
      weeklyAvailability:
        (instructor.weeklyAvailability || []).length > 0
          ? (instructor.weeklyAvailability || []).map((block) => ({
              dayOfWeek: Number(block.dayOfWeek),
              locationId: block.locationId || '',
              startTime: block.startTime || '06:00',
              endTime: block.endTime || '14:00',
            }))
          : [
              {
                dayOfWeek: 1,
                locationId: (instructor.locationIds || [])[0] || '',
                startTime: '06:00',
                endTime: '14:00',
              },
            ],
    });
  }

  async function handleInstructorSubmit(event) {
    event.preventDefault();
    setInstructorLoading(true);
    setMessage('');
    setError('');

    try {
      const payload = {
        name: instructorForm.name,
        title: instructorForm.title,
        email: instructorForm.email,
        phone: instructorForm.phone,
        bio: instructorForm.bio,
        active: instructorForm.active,
        serviceIds: instructorForm.serviceIds,
        locationIds: instructorForm.locationIds,
        weeklyAvailability: instructorForm.weeklyAvailability,
      };

      await apiRequest(
        editingInstructorId ? `/admin/instructors/${editingInstructorId}` : '/admin/instructors',
        {
          method: editingInstructorId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      resetInstructorEditor();
      await loadAdminInstructors();
      await loadAdminServices();
      await refreshPublicData();
      setMessage(editingInstructorId ? 'Instructor updated.' : 'Instructor added to the team.');
    } catch (instructorError) {
      if (!handleSessionError(instructorError)) {
        setError(instructorError.message);
      }
    } finally {
      setInstructorLoading(false);
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault();
    setReviewLoading(true);
    setMessage('');
    setError('');

    try {
      await apiRequest(
        '/reviews',
        {
          method: 'POST',
          body: JSON.stringify({
            bookingId: reviewForm.bookingId,
            rating: Number(reviewForm.rating),
            comment: reviewForm.comment,
          }),
        }
      );

      setReviewForm(emptyReviewForm);
      await refreshPublicData();
      setMessage('Review submitted. Thank you for the feedback.');
    } catch (reviewError) {
      if (!handleSessionError(reviewError)) {
        setError(reviewError.message);
      }
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleOverrideSubmit(event) {
    event.preventDefault();
    setOverrideLoading(true);
    setMessage('');
    setError('');

    try {
      await apiRequest(
        `/admin/services/${overrideForm.serviceId}/overrides`,
        {
          method: 'POST',
          body: JSON.stringify({
            date: overrideForm.date,
            time: overrideForm.time,
            locationId: overrideForm.locationId,
            instructorName: overrideForm.instructorName,
          }),
        }
      );

      setOverrideForm((current) => ({
        ...emptyOverrideForm,
        serviceId: current.serviceId,
        locationId: current.locationId,
      }));
      await loadAdminServices();
      await refreshPublicData();
      setMessage('Instructor schedule updated.');
    } catch (overrideError) {
      if (!handleSessionError(overrideError)) {
        setError(overrideError.message);
      }
    } finally {
      setOverrideLoading(false);
    }
  }

  async function handleRemoveOverride(serviceId, overrideId) {
    setMessage('');
    setError('');

    try {
      await apiRequest(
        `/admin/services/${serviceId}/overrides/${overrideId}`,
        {
          method: 'DELETE',
        }
      );

      await loadAdminServices();
      await refreshPublicData();
      setMessage('Instructor override removed.');
    } catch (removeError) {
      if (!handleSessionError(removeError)) {
        setError(removeError.message);
      }
    }
  }

  function startEditingService(service) {
    if (editingServiceId === service._id) {
      setEditingServiceId('');
      setEditingServiceForm(emptyServiceForm);
      return;
    }

    setEditingServiceId(service._id);
    setEditingServiceForm({
      id: service._id,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      category: service.category,
      capacity: service.capacity,
      price: service.price ?? 0,
      active: Boolean(service.active),
    });
  }

  async function handleDeleteService(serviceId) {
    setMessage('');
    setError('');

    if (!window.confirm('Delete this service permanently? If it has booking history, the app will block deletion and ask you to deactivate it instead.')) {
      return;
    }

    try {
      await apiRequest(
        `/admin/services/${serviceId}`,
        {
          method: 'DELETE',
        }
      );

      if (editingServiceId === serviceId) {
        setEditingServiceId('');
        setEditingServiceForm(emptyServiceForm);
      }

      setMessage('Service deleted.');
      await loadAdminServices();
      await loadAdminInstructors();
      await refreshPublicData();
    } catch (deleteError) {
      if (!handleSessionError(deleteError)) {
        setError(deleteError.message);
      }
    }
  }

  async function handleEditingServiceSubmit(event, serviceId) {
    event.preventDefault();
    setServiceLoading(true);
    setMessage('');
    setError('');

    try {
      await apiRequest(
        `/admin/services/${serviceId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: editingServiceForm.name,
            description: editingServiceForm.description,
            durationMinutes: Number(editingServiceForm.durationMinutes),
            category: editingServiceForm.category,
            capacity: Number(editingServiceForm.capacity),
            price: Number(editingServiceForm.price),
            active: editingServiceForm.active,
          }),
        }
      );

      setEditingServiceId('');
      setEditingServiceForm(emptyServiceForm);
      setMessage('Service updated.');
      await loadAdminServices();
      await refreshPublicData();
    } catch (serviceError) {
      if (!handleSessionError(serviceError)) {
        setError(serviceError.message);
      }
    } finally {
      setServiceLoading(false);
    }
  }

  async function handleAttendanceUpdate(bookingId, attendanceStatus) {
    setMessage('');
    setError('');

    try {
      await apiRequest(
        `/admin/bookings/${bookingId}/attendance`,
        {
          method: 'PATCH',
          body: JSON.stringify({ attendanceStatus }),
        }
      );

      await loadBookings();
      setMessage(attendanceStatus === 'Attended' ? 'Attendance confirmed.' : 'No-show recorded.');
    } catch (attendanceError) {
      if (!handleSessionError(attendanceError)) {
        setError(attendanceError.message);
      }
    }
  }

  function startCreditReschedule(booking) {
    const serviceId = String(booking.service?._id || booking.service || '');

    setCreditBookingId(booking._id);
    setRecentBooking(null);
    setBookingForm({
      ...emptyBookingForm,
      serviceId,
      locationId: booking.locationId || '',
    });
    setMemberPage('book');
    setMessage(`Credit ready for ${booking.service?.name || 'Open Gym Session'}. Choose a new time to reschedule.`);
    setError('');
  }

  async function handleDeactivateService(serviceId) {
    setMessage('');
    setError('');

    try {
      await apiRequest(
        `/admin/services/${serviceId}/deactivate`,
        {
          method: 'PATCH',
        }
      );
      setMessage('Service deactivated.');
      await loadAdminServices();
      await refreshPublicData();
    } catch (deactivateError) {
      if (!handleSessionError(deactivateError)) {
        setError(deactivateError.message);
      }
    }
  }

  const showAuth = !user || view !== 'app';
  const now = new Date();
  const upcomingBookings = bookings.filter((booking) => new Date(booking.appointmentDate) >= now);
  const pastBookings = bookings.filter((booking) => new Date(booking.appointmentDate) < now);
  const noShowBookings = bookings.filter((booking) => booking.attendanceStatus === 'No-show');
  const openGymCreditBookings = noShowBookings.filter(
    (booking) => isSelfLedService(booking.service) && booking.creditEligible && !booking.creditRedeemedForBookingId
  );
  const activeCreditBooking =
    openGymCreditBookings.find((booking) => booking._id === creditBookingId) || null;
  const reviewLookup = new Set(reviews.map((review) => String(review.booking?._id || review.booking)));
  const reviewableBookings = pastBookings.filter((booking) => !reviewLookup.has(String(booking._id)));
  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'user';
  const allAdminLocations = Array.from(
    new Map(
      adminServices
        .flatMap((service) => service.locations || [])
        .map((location) => [location.id, location])
    ).values()
  );
  const selectedAdminLocation =
    allAdminLocations.find((location) => location.id === selectedAdminLocationId) ||
    allAdminLocations[0] ||
    null;
  const selectedBookingService = services.find((service) => service._id === bookingForm.serviceId) || services[0] || null;
  const selectedBookingLocation =
    selectedBookingService?.locations?.find((location) => location.id === bookingForm.locationId) ||
    selectedBookingService?.locations?.[0] ||
    null;
  const bookingInstructorPool =
    selectedBookingService?.bookingMode === 'self-led'
      ? []
      : getAssignedInstructorsForServiceLocation(selectedBookingService, selectedBookingLocation?.id, instructors);
  const preferredBookingInstructor =
    bookingInstructorPool.find((instructor) => instructor._id === bookingForm.preferredInstructorId) || null;
  const availableBookingSlots = selectedBookingService
    ? generateServiceSlots(selectedBookingService, bookingForm.bookingDate, selectedBookingLocation?.id, instructors)
    : [];
  const visibleBookingSlots = preferredBookingInstructor
    ? availableBookingSlots.filter((slot) => slot.instructorOptions.includes(preferredBookingInstructor.name))
    : availableBookingSlots;
  const selectedBookingSlot = visibleBookingSlots.find((slot) => slot.time === bookingForm.slotTime) || null;
  const bookingInstructorOptions =
    selectedBookingService?.bookingMode === 'self-led'
      ? []
      : preferredBookingInstructor
        ? [preferredBookingInstructor.name]
        : selectedBookingSlot?.instructorOptions || bookingInstructorPool.map((instructor) => instructor.name);
  const isUsingCreditForBooking =
    Boolean(activeCreditBooking) &&
    Boolean(selectedBookingService) &&
    isSelfLedService(selectedBookingService) &&
    String(activeCreditBooking.service?._id || activeCreditBooking.service) === String(selectedBookingService._id);
  const selectedOverrideService = adminServices.find((service) => service._id === overrideForm.serviceId) || adminServices[0] || null;
  const selectedOverrideLocation =
    selectedOverrideService?.locations?.find((location) => location.id === overrideForm.locationId) ||
    selectedOverrideService?.locations?.[0] ||
    null;
  const overrideInstructorPool = getAssignedInstructorsForServiceLocation(
    selectedOverrideService,
    selectedOverrideLocation?.id,
    adminInstructors.filter((instructor) => instructor.active !== false)
  );
  const overrideSlots = selectedOverrideService
    ? generateServiceSlots(
        selectedOverrideService,
        overrideForm.date,
        selectedOverrideLocation?.id,
        adminInstructors.filter((instructor) => instructor.active !== false)
      )
    : [];
  const selectedOverrideSlot = overrideSlots.find((slot) => slot.time === overrideForm.time) || null;
  const overrideInstructorOptions =
    selectedOverrideSlot?.availableInstructorOptions || overrideInstructorPool.map((instructor) => instructor.name);
  const selectedAvailabilityInstructor =
    adminInstructors.find((instructor) => instructor._id === availabilityExplorer.instructorId) || null;
  const availabilityServiceOptions = selectedAvailabilityInstructor
    ? adminServices.filter((service) =>
        (selectedAvailabilityInstructor.serviceIds || []).map(String).includes(String(service._id))
      )
    : adminServices;
  const selectedAvailabilityService =
    availabilityServiceOptions.find((service) => service._id === availabilityExplorer.serviceId) ||
    availabilityServiceOptions[0] ||
    null;
  const availabilityLocationOptions = selectedAvailabilityService
    ? (selectedAvailabilityService.locations || []).filter((location) =>
        !selectedAvailabilityInstructor ||
        (selectedAvailabilityInstructor.locationIds || []).includes(location.id)
      )
    : [];
  const selectedAvailabilityLocation =
    availabilityLocationOptions.find((location) => location.id === availabilityExplorer.locationId) ||
    availabilityLocationOptions[0] ||
    null;
  const instructorAvailabilitySlots =
    selectedAvailabilityInstructor && selectedAvailabilityService && availabilityExplorer.date
      ? generateServiceSlots(
          selectedAvailabilityService,
          availabilityExplorer.date,
          selectedAvailabilityLocation?.id,
          adminInstructors.filter((instructor) => instructor.active !== false)
        ).filter((slot) => slot.instructorOptions.includes(selectedAvailabilityInstructor.name))
      : [];
  const activeAdminBookings = bookings.filter((booking) => !['Cancelled', 'Rejected'].includes(booking.status));
  const cancelledAdminBookings = bookings.filter((booking) => booking.status === 'Cancelled');
  const attendedAdminBookings = activeAdminBookings.filter((booking) => booking.attendanceStatus === 'Attended');
  const noShowAdminBookings = bookings.filter((booking) => booking.attendanceStatus === 'No-show');
  const todayIsoDate = new Date().toISOString().slice(0, 10);
  const todayAdminBookings = activeAdminBookings.filter(
    (booking) => new Date(booking.appointmentDate).toISOString().slice(0, 10) === todayIsoDate
  );
  function buildAdminSessions(sourceBookings) {
    return sourceBookings
      .slice()
      .sort((left, right) => new Date(left.appointmentDate) - new Date(right.appointmentDate))
      .reduce((sessions, booking) => {
        const sessionKey = createSessionKey(booking);
        const existingSession = sessions.find((session) => session.key === sessionKey);

        if (existingSession) {
          existingSession.bookings.push(booking);
          existingSession.spotsLeft = Math.max(0, existingSession.capacity - existingSession.bookings.length);
          return sessions;
        }

        const capacity = Number(booking.service?.capacity || 0);
        sessions.push({
          key: sessionKey,
          serviceName: booking.service?.name || 'Service',
          category: booking.service?.category || '',
          appointmentDate: booking.appointmentDate,
          locationName: booking.locationName,
          locationAddress: booking.locationAddress,
          instructorName: booking.instructorName,
          capacity,
          price: booking.paymentAmount || booking.service?.price || 0,
          bookings: [booking],
          spotsLeft: Math.max(0, capacity - 1),
        });
        return sessions;
      }, [])
      .map((session) => ({
        ...session,
        bookings: session.bookings
          .slice()
          .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0)),
      }));
  }

  const adminUpcomingSessions = buildAdminSessions(
    activeAdminBookings.filter((booking) => isUpcomingAppointment(booking.appointmentDate))
  );
  const adminCompletedSessions = buildAdminSessions(
    activeAdminBookings.filter((booking) => !isUpcomingAppointment(booking.appointmentDate))
  )
    .slice()
    .sort((left, right) => new Date(right.appointmentDate) - new Date(left.appointmentDate));
  const pendingAttendanceCount = adminCompletedSessions.reduce(
    (total, session) =>
      total + session.bookings.filter((booking) => booking.attendanceStatus === 'Scheduled').length,
    0
  );
  const nextUpcomingAdminSession = adminUpcomingSessions[0] || null;
  const latestCompletedAdminSession = adminCompletedSessions[0] || null;
  const serviceRatingsById = buildServiceRatingMap(reviews);
  const locationCount = new Set(
    services.flatMap((service) => (service.locations || []).map((location) => location.id || location.name))
  ).size;
  const locationScheduleDays = selectedAdminLocation
    ? Array.from({ length: 7 }, (_, offset) => {
        const dayDate = addDays(new Date(), offset);
        dayDate.setHours(0, 0, 0, 0);
        const isoDate = dayDate.toISOString().slice(0, 10);
        const entries = adminServices
          .filter(
            (service) =>
              service.active !== false &&
              (service.locations || []).some((location) => location.id === selectedAdminLocation.id)
          )
          .flatMap((service) => {
            const locationConfig =
              (service.locations || []).find((location) => location.id === selectedAdminLocation.id) || null;
            if (service.bookingMode === 'self-led') {
              return [{
                key: `${isoDate}-${service._id}-open-gym`,
                serviceName: service.name,
                category: service.category,
                time: `${padTime(Number(service.schedule.startHour || 6))}:00`,
                timeLabel: `Open ${formatHourLabel(service.schedule.startHour || 6)} - ${formatHourLabel(service.schedule.endHour || 24)}`,
                bookingMode: service.bookingMode,
                instructorNames: [],
                detailLabel: `${service.schedule.intervalMinutes || 30}-minute increments`,
              }];
            }

            return generateServiceSlots(
              service,
              isoDate,
              selectedAdminLocation.id,
              adminInstructors.filter((instructor) => instructor.active !== false)
            ).map((slot) => ({
              key: `${isoDate}-${service._id}-${slot.time}`,
              serviceName: service.name,
              category: service.category,
              time: slot.time,
              timeLabel: slot.label,
              bookingMode: service.bookingMode,
              instructorNames: slot.instructorName ? [slot.instructorName] : locationConfig?.instructors || [],
              detailLabel: '',
            }));
          })
          .sort((left, right) => left.time.localeCompare(right.time) || left.serviceName.localeCompare(right.serviceName));

        return {
          key: isoDate,
          weekday: dayDate.toLocaleDateString('en-US', { weekday: 'long' }),
          dateLabel: dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          entries,
        };
      })
    : [];
  const calendarWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentMonthSessions = adminUpcomingSessions.filter((session) => {
    const sessionDate = new Date(session.appointmentDate);
    return (
      sessionDate.getFullYear() === calendarMonthDate.getFullYear() &&
      sessionDate.getMonth() === calendarMonthDate.getMonth()
    );
  });
  const calendarCells = createCalendarCells(calendarMonthDate, currentMonthSessions);
  const heroStats = [
    { label: 'Services', value: services.length || '04' },
    { label: 'Reviews', value: reviews.length || '00' },
    { label: 'Locations', value: locationCount || '07' },
  ];
  const adminTeam = adminUsers.filter((item) => item.role === 'admin');
  const memberUsers = adminUsers.filter((item) => item.role !== 'admin');
  const mainAdminUser =
    adminTeam.find(
      (item) => item.adminPermission === 'main-admin' || String(item.membershipNumber || '').toUpperCase() === 'ADMIN-001'
    ) || null;
  const viewerIsMainAdmin =
    user?.adminPermission === 'main-admin' || String(user?.membershipNumber || '').toUpperCase() === 'ADMIN-001';
  const memberPages = [
    { id: 'book', label: 'Book' },
    { id: 'schedule', label: 'My Schedule' },
    { id: 'profile', label: 'Profile' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'about', label: 'About Us' },
  ];
  const adminPages = [
    { id: 'services', label: 'Services' },
    { id: 'locations', label: 'Locations' },
    { id: 'instructors', label: 'Instructors' },
    { id: 'users', label: 'Users' },
    { id: 'schedule', label: 'Schedule' },
  ];
  const adminWorkspaceConfig = {
    services: {
      kicker: 'Services Workspace',
      title: 'Choose one service task at a time',
      description: 'Switch between the live lineup, new-service setup, and catalog editing without stretching the whole page.',
      value: adminServicesView,
      setValue: setAdminServicesView,
      options: [
        { id: 'overview', label: 'Live lineup' },
        { id: 'create', label: 'Create service' },
        { id: 'catalog', label: 'Service catalog' },
      ],
      stats: [
        { label: 'Booked', value: activeAdminBookings.length },
        { label: 'Today', value: todayAdminBookings.length },
        { label: 'Cancelled', value: cancelledAdminBookings.length },
      ],
    },
    locations: {
      kicker: 'Locations Workspace',
      title: 'Move between the directory and local teaching board',
      description: 'Keep the studio list compact, then jump into one selected location whenever you want its weekly teaching picture.',
      value: adminLocationsView,
      setValue: setAdminLocationsView,
      options: [
        { id: 'directory', label: 'Location directory' },
        { id: 'schedule', label: 'Location schedule' },
      ],
      stats: [
        { label: 'Studios', value: allAdminLocations.length },
        { label: 'Live services', value: adminServices.filter((service) => service.active !== false).length },
        { label: 'Active instructors', value: adminInstructors.filter((instructor) => instructor.active !== false).length },
      ],
    },
    instructors: {
      kicker: 'Instructor Workspace',
      title: 'Keep the team tools focused',
      description: 'Use one selector to move between the roster, employee editor, availability lookup, and one-time coverage changes.',
      value: adminInstructorsView,
      setValue: setAdminInstructorsView,
      options: [
        { id: 'overview', label: 'Team overview' },
        { id: 'editor', label: 'Employee editor' },
        { id: 'availability', label: 'Availability lookup' },
        { id: 'coverage', label: 'Coverage changes' },
      ],
      stats: [
        { label: 'Team members', value: adminInstructors.length },
        { label: 'Bookable', value: adminInstructors.filter((instructor) => instructor.active !== false).length },
        { label: 'Locations covered', value: new Set(adminInstructors.flatMap((instructor) => instructor.locationIds || [])).size },
      ],
    },
    users: {
      kicker: 'Users Workspace',
      title: 'Keep admin permissions and members in one place',
      description: 'Review the main admin, promote members into the admin team, and update titles without stretching the page.',
      value: adminUsersView,
      setValue: setAdminUsersView,
      options: [
        { id: 'overview', label: 'Overview' },
        { id: 'admins', label: 'Admins' },
        { id: 'members', label: 'Members' },
      ],
      stats: [
        { label: 'Users', value: adminUsers.length },
        { label: 'Admins', value: adminTeam.length },
        { label: 'Members', value: memberUsers.length },
      ],
    },
    schedule: {
      kicker: 'Schedule Workspace',
      title: 'Switch between overview, calendar, and attendance views',
      description: 'Keep the monthly view, upcoming classes, and completed attendance review in one page without stacking everything at once.',
      value: adminScheduleView,
      setValue: setAdminScheduleView,
      options: [
        { id: 'overview', label: 'Overview' },
        { id: 'calendar', label: 'Monthly calendar' },
        { id: 'upcoming', label: 'Future classes' },
        { id: 'completed', label: 'Past classes' },
      ],
      stats: [
        { label: 'Today', value: todayAdminBookings.length },
        { label: 'Attended', value: attendedAdminBookings.length },
        { label: 'Needs review', value: pendingAttendanceCount },
      ],
    },
  };
  const activeAdminWorkspace = adminWorkspaceConfig[adminPage];
  const activeNotice = error
    ? { type: 'error', title: 'Something went wrong', text: error }
    : message
      ? { type: 'success', title: 'Done', text: message }
      : null;
  const defaultInstructorLocationId =
    adminServices.flatMap((service) => service.locations || []).find(Boolean)?.id ||
    allAdminLocations[0]?.id ||
    '';

  function resetInstructorEditor() {
    setEditingInstructorId('');
    setInstructorForm(createEmptyInstructorForm(defaultInstructorLocationId));
  }

  function resetAdminUserEditor() {
    setEditingAdminUserId('');
    setEditingAdminUserMode('');
    setAdminUserForm(emptyAdminUserForm);
  }

  function startEditingAdminUser(targetUser, mode) {
    if (editingAdminUserId === targetUser._id && editingAdminUserMode === mode) {
      resetAdminUserEditor();
      return;
    }

    setEditingAdminUserId(targetUser._id);
    setEditingAdminUserMode(mode);
    setAdminUserForm({
      adminTitle: targetUser.adminTitle || '',
    });
  }

  async function handleAdminUserSubmit(event, targetUser) {
    event.preventDefault();
    setAdminUserLoading(true);
    setMessage('');
    setError('');

    const action = editingAdminUserMode === 'promote' ? 'promote' : 'update';

    try {
      const data = await apiRequest(`/admin/users/${targetUser._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          adminTitle: adminUserForm.adminTitle,
        }),
      });

      setAdminUsers(data.users || []);
      if (data.user && user?._id === data.user._id) {
        setUser(data.user);
      }
      resetAdminUserEditor();
      setMessage(
        action === 'promote'
          ? `${targetUser.name} is now part of the admin team.`
          : `${targetUser.name}'s admin role was updated.`
      );
    } catch (requestError) {
      if (!handleSessionError(requestError)) {
        setError(requestError.message);
      }
    } finally {
      setAdminUserLoading(false);
    }
  }

  async function handleAdminUserDemote(targetUser) {
    const confirmed = window.confirm(`Move ${targetUser.name} back to the member list?`);
    if (!confirmed) {
      return;
    }

    setAdminUserLoading(true);
    setMessage('');
    setError('');

    try {
      const data = await apiRequest(`/admin/users/${targetUser._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'demote' }),
      });

      setAdminUsers(data.users || []);
      if (data.user && user?._id === data.user._id) {
        setUser(data.user);
      }
      resetAdminUserEditor();
      setMessage(`${targetUser.name} has been moved back to the member list.`);
    } catch (requestError) {
      if (!handleSessionError(requestError)) {
        setError(requestError.message);
      }
    } finally {
      setAdminUserLoading(false);
    }
  }

  function renderAdminUserEditor(targetUser) {
    return (
      <form className="booking-form inline-service-editor inline-admin-user-editor" onSubmit={(event) => handleAdminUserSubmit(event, targetUser)}>
        <p className="form-note">
          {editingAdminUserMode === 'promote'
            ? 'Choose the admin title you want this team member to hold before they are promoted.'
            : 'Update how this admin role should appear across the workspace.'}
        </p>
        <label>
          Admin title
          <input
            name="adminTitle"
            value={adminUserForm.adminTitle}
            onChange={updateForm(setAdminUserForm)}
            placeholder="Atlanta Manager"
            required
          />
        </label>
        <div className="admin-actions">
          <button type="submit" disabled={adminUserLoading}>
            {adminUserLoading
              ? 'Saving...'
              : editingAdminUserMode === 'promote'
                ? 'Promote to admin'
                : 'Save admin changes'}
          </button>
          <button type="button" className="secondary-button" onClick={resetAdminUserEditor}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  function renderInstructorEditor({ inline = false } = {}) {
    return (
      <form
        className={`booking-form${inline ? ' inline-service-editor inline-instructor-editor' : ''}`}
        onSubmit={handleInstructorSubmit}
      >
        {inline ? (
          <p className="form-note">
            Update this employee without leaving the directory. Save when everything looks right.
          </p>
        ) : null}

        <div className="form-grid-two">
          <label>
            Full name
            <input name="name" value={instructorForm.name} onChange={updateForm(setInstructorForm)} required />
          </label>
          <label>
            Title
            <input name="title" value={instructorForm.title} onChange={updateForm(setInstructorForm)} required />
          </label>
          <label>
            Email
            <input name="email" type="email" value={instructorForm.email} onChange={updateForm(setInstructorForm)} required />
          </label>
          <label>
            Phone
            <input name="phone" value={instructorForm.phone} onChange={updateForm(setInstructorForm)} required />
          </label>
        </div>

        <label>
          Bio
          <textarea name="bio" value={instructorForm.bio} onChange={updateForm(setInstructorForm)} rows="4" required />
        </label>

        <div className="form-split-section">
          <div>
            <strong className="section-subtitle">Services they can teach</strong>
            <div className="checkbox-pill-grid">
              {adminServices.map((service) => (
                <label key={service._id} className="checkbox-pill">
                  <input
                    type="checkbox"
                    checked={instructorForm.serviceIds.includes(service._id)}
                    onChange={() => toggleInstructorArrayField('serviceIds', service._id)}
                  />
                  <span>{service.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <strong className="section-subtitle">Studio locations</strong>
            <div className="checkbox-pill-grid">
              {allAdminLocations.map((location) => (
                <label key={location.id} className="checkbox-pill">
                  <input
                    type="checkbox"
                    checked={instructorForm.locationIds.includes(location.id)}
                    onChange={() => toggleInstructorArrayField('locationIds', location.id)}
                  />
                  <span>{location.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="availability-editor">
          <div className="section-heading-inline">
            <strong className="section-subtitle">Weekly availability</strong>
            <button type="button" className="secondary-button" onClick={addInstructorAvailabilityRow}>
              Add work window
            </button>
          </div>
          {instructorForm.weeklyAvailability.map((block, index) => (
            <div key={`${block.locationId}-${block.dayOfWeek}-${index}`} className="availability-row">
              <label>
                Day
                <select
                  value={block.dayOfWeek}
                  onChange={(event) => updateInstructorAvailabilityRow(index, 'dayOfWeek', Number(event.target.value))}
                >
                  {weekdayOptions.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <select
                  value={block.locationId}
                  onChange={(event) => updateInstructorAvailabilityRow(index, 'locationId', event.target.value)}
                >
                  {(instructorForm.locationIds.length > 0
                    ? allAdminLocations.filter((location) => instructorForm.locationIds.includes(location.id))
                    : allAdminLocations
                  ).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start
                <input
                  type="time"
                  value={block.startTime}
                  onChange={(event) => updateInstructorAvailabilityRow(index, 'startTime', event.target.value)}
                />
              </label>
              <label>
                End
                <input
                  type="time"
                  value={block.endTime}
                  onChange={(event) => updateInstructorAvailabilityRow(index, 'endTime', event.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={() => removeInstructorAvailabilityRow(index)}
                disabled={instructorForm.weeklyAvailability.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <label className="checkbox-row">
          <input
            name="active"
            type="checkbox"
            checked={instructorForm.active}
            onChange={(event) =>
              setInstructorForm((current) => ({ ...current, active: event.target.checked }))
            }
          />
          Instructor is active for booking
        </label>

        <div className="admin-actions">
          <button type="submit" disabled={instructorLoading}>
            {instructorLoading ? 'Saving...' : editingInstructorId ? 'Save employee' : 'Add instructor'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={resetInstructorEditor}
          >
            {inline ? 'Cancel' : 'Reset form'}
          </button>
        </div>
      </form>
    );
  }

  useEffect(() => {
    if (allAdminLocations.length === 0) {
      return;
    }

    if (!allAdminLocations.some((location) => location.id === selectedAdminLocationId)) {
      setSelectedAdminLocationId(allAdminLocations[0].id);
    }
  }, [allAdminLocations, selectedAdminLocationId]);

  if (authChecking) {
    return (
      <div className="app-shell">
        <header className="hero">
          <div className="hero-topline">
            <p className="eyebrow">Wellness Center Studio</p>
          </div>
          <div className="hero-layout editorial-hero">
            <div className="hero-copy-block editorial-copy-block">
              <h1>Loading your secure session.</h1>
              <p className="hero-copy">
                Please wait a moment while we restore your dashboard.
              </p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div
      className={`app-shell${!showAuth && isAdmin ? ' admin-shell' : ''}${
        !showAuth && isAdmin ? ' admin-expanded-shell' : ''
      }`}
    >
      {showAuth ? (
        <header className="hero">
          <div className="hero-topline">
            <p className="eyebrow">Wellness Center Studio</p>
          </div>
          <div className="hero-layout editorial-hero">
            <div className="hero-copy-block editorial-copy-block">
              <h1>Clean scheduling for a calm, elevated wellness experience.</h1>
              <p className="hero-lead">
                A modern wellness booking app for members and staff.
              </p>
              <p className="hero-copy">
                Book pilates, massage, spa, and gym sessions in one refined space for members,
                staff, schedules, payments, and reviews.
              </p>
              <div className="hero-tags">
                <span>Massage</span>
                <span>Pilates</span>
                <span>Spa</span>
                <span>Gym</span>
              </div>
            </div>

            <aside className="hero-aside editorial-mosaic">
              <div className="mosaic-large">
                <img src={coverPicture} alt="Wellness hero" />
              </div>
              <div className="mosaic-insight">
                <p className="hero-aside-label">How It Works</p>
                <div className="hero-stat-grid">
                  {heroStats.map((stat) => (
                    <div key={stat.label} className="hero-stat-card">
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
                <p className="hero-aside-note">
                  Join with your email, pick a location and a real class time, then manage bookings, credits, and reviews from one calmer dashboard.
                </p>
              </div>
            </aside>
          </div>
        </header>
      ) : (
        <>
          <header className="dashboard-topbar">
            <div>
              <p className="eyebrow">Wellness Center Studio</p>
              <h1>{isAdmin ? 'Studio Operations' : 'Member Dashboard'}</h1>
              <p className="dashboard-note">
                Signed in as <strong>{user.name}</strong> ({user.role}) with membership{' '}
                <strong>{user.membershipNumber}</strong>.
              </p>
            </div>
            <button type="button" className="secondary-button" onClick={handleLogout}>
              Log out
            </button>
          </header>

          {isMember ? (
            <nav className="member-nav" aria-label="Member navigation">
              {memberPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={memberPage === page.id ? 'member-nav-button active' : 'member-nav-button'}
                  onClick={() => setMemberPage(page.id)}
                >
                  {page.label}
                </button>
              ))}
            </nav>
          ) : null}

          {isAdmin ? (
            <nav className="member-nav" aria-label="Admin navigation">
              {adminPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={adminPage === page.id ? 'member-nav-button active' : 'member-nav-button'}
                  onClick={() => setAdminPage(page.id)}
                >
                  {page.label}
                </button>
              ))}
            </nav>
          ) : null}

          {user && !user.emailVerified ? (
            <section className="panel verification-banner">
              <div>
                <p className="panel-kicker">Email Verification</p>
                <h2>Verify your email to protect your account.</h2>
                <p className="section-copy">
                  We’ve added secure account verification and password recovery. Send yourself a fresh verification link any time.
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={handleRequestVerification} disabled={profileLoading}>
                {profileLoading ? 'Sending...' : 'Send verification email'}
              </button>
            </section>
          ) : null}

          {isAdmin && activeAdminWorkspace ? (
            <section className="panel panel-emphasis bookings-panel admin-workspace-toolbar">
              <div className="admin-workspace-topline">
                <div>
                  <p className="panel-kicker">{activeAdminWorkspace.kicker}</p>
                  <h2>{activeAdminWorkspace.title}</h2>
                  <p className="section-copy">{activeAdminWorkspace.description}</p>
                </div>
                <div className="admin-workspace-controls">
                  <label className="admin-workspace-field">
                    <span>Workspace section</span>
                    <select
                      value={activeAdminWorkspace.value}
                      onChange={(event) => activeAdminWorkspace.setValue(event.target.value)}
                    >
                      {activeAdminWorkspace.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {adminPage === 'locations' && adminLocationsView === 'schedule' ? (
                    <label className="admin-workspace-field">
                      <span>Selected location</span>
                      <select
                        value={selectedAdminLocationId}
                        onChange={(event) => setSelectedAdminLocationId(event.target.value)}
                      >
                        {allAdminLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {adminPage === 'schedule' ? (
                    <button type="button" className="secondary-button" onClick={loadBookings}>
                      Refresh schedule
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="admin-workspace-stats">
                {activeAdminWorkspace.stats.map((stat) => (
                  <article key={stat.label} className="summary-card admin-workspace-stat-card">
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {authTransition ? (
        <div className={`auth-transition-screen ${authTransition.phase === 'fade' ? 'fade-out' : ''}`} role="status" aria-live="polite">
          <div className="auth-transition-card">
            <p className="notice-kicker">{authTransition.title}</p>
            <h2>{authTransition.text}</h2>
            <div className="auth-transition-loader" aria-hidden="true">
              <span />
            </div>
          </div>
        </div>
      ) : null}

      {activeNotice && !authTransition ? (
        <div className="notice-overlay" role="status" aria-live="polite">
          <div className={`notice-modal ${activeNotice.type === 'error' ? 'error' : 'success'}`}>
            <p className="notice-kicker">{activeNotice.title}</p>
            <h2>{activeNotice.text}</h2>
          </div>
        </div>
      ) : null}

      {showAuth ? (
        <main className="grid auth-grid">
          <section className="panel panel-emphasis">
            <div className="auth-switcher">
              <button
                type="button"
                className={view === 'login' || view === 'forgot-password' || view === 'reset-password' || view === 'verify-email' ? 'tab-button active' : 'tab-button'}
                onClick={() => {
                  clearAuthQueryParams();
                  setVerificationToken('');
                  setResetPasswordForm(emptyResetPasswordForm);
                  setView('login');
                }}
              >
                Log In
              </button>
              <button
                type="button"
                className={view === 'register' ? 'tab-button active' : 'tab-button'}
                onClick={() => {
                  clearAuthQueryParams();
                  setVerificationToken('');
                  setResetPasswordForm(emptyResetPasswordForm);
                  setView('register');
                }}
              >
                Register
              </button>
            </div>

            {view === 'register' ? (
              <form className="booking-form" onSubmit={handleRegister}>
                <h2>Create Member Account</h2>
                <label>
                  Full name
                  <input name="name" value={registerForm.name} onChange={updateForm(setRegisterForm)} required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" value={registerForm.email} onChange={updateForm(setRegisterForm)} required />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    value={registerForm.password}
                    onChange={updateForm(setRegisterForm)}
                    required
                  />
                </label>
                <p className="form-note">We’ll assign your membership number automatically after you register.</p>
                <button type="submit" disabled={authLoading}>
                  {authLoading ? 'Creating account...' : 'Create account'}
                </button>
                <button type="button" className="text-button" onClick={() => setView('login')}>
                  Already have an account? Sign in
                </button>
              </form>
            ) : view === 'forgot-password' ? (
              <form className="booking-form" onSubmit={handleForgotPassword}>
                <h2>Reset Password</h2>
                <p className="form-note">Enter your account email and we’ll send a reset link.</p>
                <label>
                  Account email
                  <input
                    name="email"
                    type="email"
                    value={forgotPasswordForm.email}
                    onChange={updateForm(setForgotPasswordForm)}
                    required
                  />
                </label>
                <button type="submit" disabled={authLoading}>
                  {authLoading ? 'Sending link...' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    clearAuthQueryParams();
                    setView('login');
                  }}
                >
                  Back to sign in
                </button>
              </form>
            ) : view === 'reset-password' ? (
              <form className="booking-form" onSubmit={handleResetPassword}>
                <h2>Choose a New Password</h2>
                <p className="form-note">This secure reset link lets you choose a fresh password for your account.</p>
                <label>
                  New password
                  <input
                    name="password"
                    type="password"
                    value={resetPasswordForm.password}
                    onChange={updateForm(setResetPasswordForm)}
                    required
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    name="confirmPassword"
                    type="password"
                    value={resetPasswordForm.confirmPassword}
                    onChange={updateForm(setResetPasswordForm)}
                    required
                  />
                </label>
                <button type="submit" disabled={authLoading}>
                  {authLoading ? 'Saving password...' : 'Reset password'}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    clearAuthQueryParams();
                    setResetPasswordForm(emptyResetPasswordForm);
                    setView('login');
                  }}
                >
                  Back to sign in
                </button>
              </form>
            ) : view === 'verify-email' ? (
              <div className="booking-form auth-info-card">
                <h2>Verify Your Email</h2>
                <p className="form-note">
                  Finish setting up your account by confirming your email address from the secure link we sent you.
                </p>
                <button type="button" onClick={handleVerifyEmail} disabled={authLoading}>
                  {authLoading ? 'Verifying...' : 'Verify email'}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    clearAuthQueryParams();
                    setVerificationToken('');
                    setView(user ? 'app' : 'login');
                  }}
                >
                  Back
                </button>
              </div>
            ) : (
              <form className="booking-form" onSubmit={handleLogin}>
                <h2>Sign In</h2>
                <label>
                  Email or membership number
                  <input
                    name="identifier"
                    type="text"
                    value={loginForm.identifier}
                    onChange={updateForm(setLoginForm)}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={updateForm(setLoginForm)}
                    required
                  />
                </label>
                <button type="submit" disabled={authLoading}>
                  {authLoading ? 'Signing in...' : 'Sign in'}
                </button>
                <button type="button" className="text-button" onClick={() => setView('forgot-password')}>
                  Forgot your password?
                </button>
              </form>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <p className="panel-kicker">What You Can Do</p>
              <h2>One polished system for members, staff, and service feedback.</h2>
            </div>
            <div className="feature-stack">
              <article className="feature-card">
                <h3>Members</h3>
                <p>Create an account, browse services, book live class times, track your schedule, and leave reviews after completed visits.</p>
              </article>
              <article className="feature-card">
                <h3>Admins</h3>
                <p>Manage service pricing, instructors, attendance, and the live schedule from one calmer dashboard.</p>
              </article>
              <article className="feature-card">
                <h3>Reviews</h3>
                <p>Members can share completed-service feedback, and the public experience stays grounded in recent studio reviews.</p>
              </article>
            </div>
            <div className="editorial-strip">
              {services.slice(0, 3).map((service) => {
                const presentation = getServicePresentation(service);
                const ratingSummary = getMedianRatingSummary(serviceRatingsById[String(service._id)]);
                return (
                  <article key={service._id} className="editorial-card">
                    <div className="editorial-visual">
                      <img src={presentation.image || coverPicture} alt={service.name} />
                    </div>
                    <div className="editorial-copy">
                      <p>{presentation.eyebrow}</p>
                      <h3>{service.name}</h3>
                      <div className="service-rating service-rating-compact">
                        <strong>{ratingSummary.stars}</strong>
                        <span>{ratingSummary.label}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      ) : (
        <main className="grid">
          {isAdmin ? (
            <>
              {adminPage === 'services' ? (
                <>
                  {adminServicesView === 'overview' ? (
                    <section className="panel bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Service Menu</p>
                        <h2>Available Services</h2>
                      </div>
                      <p className="section-copy">Review the live service lineup, pricing, and studio categories at a glance.</p>

                      {loadingServices ? (
                        <p>Loading services...</p>
                      ) : (
                        <div className="service-gallery admin-service-gallery">
                          {services.map((service) => {
                            const presentation = getServicePresentation(service);
                            const ratingSummary = getMedianRatingSummary(serviceRatingsById[String(service._id)]);
                            return (
                              <article key={service._id} className="service-showcase-card admin-service-showcase-card">
                                <div className="service-showcase-visual admin-service-showcase-visual">
                                  <img src={presentation.image || coverPicture} alt={service.name} />
                                </div>
                                <div className="service-showcase-copy">
                                  <p className="service-showcase-kicker">{presentation.eyebrow}</p>
                                  <h3 className="admin-service-title">{service.name}</h3>
                                  <div className="service-showcase-meta">
                                    <span>{service.category}</span>
                                    <strong>{formatPrice(service.price)}</strong>
                                  </div>
                                  <div className="service-rating">
                                    <strong>{ratingSummary.stars}</strong>
                                    <span>{ratingSummary.label}</span>
                                  </div>
                                  <p>{presentation.blurb}</p>
                                  <div className="service-meta">
                                    <span>{service.durationMinutes} min</span>
                                    <span>{service.capacity} spots per slot</span>
                                    <span>{isSelfLedService(service) ? 'Self-led session' : 'Instructor-led class'}</span>
                                  </div>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {adminServicesView === 'create' ? (
                    <section className="panel panel-emphasis bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Operations</p>
                        <h2>Create a New Service</h2>
                      </div>
                      <p className="section-copy">Add a fresh service to the booking menu with its duration, price, capacity, and active status.</p>
                      <form className="booking-form" onSubmit={handleServiceSubmit}>
                        <label>
                          Service name
                          <input name="name" value={serviceForm.name} onChange={updateForm(setServiceForm)} required />
                        </label>
                        <label>
                          Description
                          <textarea
                            name="description"
                            value={serviceForm.description}
                            onChange={updateForm(setServiceForm)}
                            rows="4"
                            required
                          />
                        </label>
                        <div className="form-grid-two">
                          <label>
                            Category
                            <input name="category" value={serviceForm.category} onChange={updateForm(setServiceForm)} required />
                          </label>
                          <label>
                            Duration (minutes)
                            <input
                              name="durationMinutes"
                              type="number"
                              min="15"
                              value={serviceForm.durationMinutes}
                              onChange={updateForm(setServiceForm)}
                              required
                            />
                          </label>
                          <label>
                            Capacity
                            <input
                              name="capacity"
                              type="number"
                              min="1"
                              value={serviceForm.capacity}
                              onChange={updateForm(setServiceForm)}
                              required
                            />
                          </label>
                          <label>
                            Price
                            <input
                              name="price"
                              type="number"
                              min="0"
                              step="0.01"
                              value={serviceForm.price}
                              onChange={updateForm(setServiceForm)}
                              required
                            />
                          </label>
                        </div>
                        <label className="checkbox-row">
                          <input
                            name="active"
                            type="checkbox"
                            checked={serviceForm.active}
                            onChange={(event) =>
                              setServiceForm((current) => ({ ...current, active: event.target.checked }))
                            }
                          />
                          Service is active
                        </label>
                        <div className="admin-actions">
                          <button type="submit" disabled={serviceLoading}>
                            {serviceLoading ? 'Saving...' : 'Create service'}
                          </button>
                        </div>
                      </form>
                    </section>
                  ) : null}

                  {adminServicesView === 'catalog' ? (
                    <section className="panel panel-emphasis bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Catalog</p>
                        <h2>Service Catalog</h2>
                      </div>
                      <p className="section-copy">Edit pricing, capacity, descriptions, or active status without leaving the list.</p>
                      <div className="service-list">
                        {adminServices.map((service) => {
                          const ratingSummary = getMedianRatingSummary(serviceRatingsById[String(service._id)]);
                          return (
                            <article key={service._id} className="service-card">
                              <div className="service-card-header">
                                <h3>{service.name}</h3>
                                <span>{service.active ? 'Active' : 'Inactive'}</span>
                              </div>
                              <p>{service.description}</p>
                              <div className="service-rating">
                                <strong>{ratingSummary.stars}</strong>
                                <span>{ratingSummary.label}</span>
                              </div>
                              <div className="service-meta">
                                <strong>{formatPrice(service.price)}</strong>
                                <span>{service.durationMinutes} minutes</span>
                                <span>{service.capacity} spots</span>
                                <span>{service.category}</span>
                              </div>

                              {editingServiceId === service._id ? (
                                <form className="booking-form inline-service-editor" onSubmit={(event) => handleEditingServiceSubmit(event, service._id)}>
                                  <div className="form-grid-two">
                                    <label>
                                      Service name
                                      <input
                                        name="name"
                                        value={editingServiceForm.name}
                                        onChange={updateForm(setEditingServiceForm)}
                                        required
                                      />
                                    </label>
                                    <label>
                                      Category
                                      <input
                                        name="category"
                                        value={editingServiceForm.category}
                                        onChange={updateForm(setEditingServiceForm)}
                                        required
                                      />
                                    </label>
                                    <label>
                                      Duration (minutes)
                                      <input
                                        name="durationMinutes"
                                        type="number"
                                        min="15"
                                        value={editingServiceForm.durationMinutes}
                                        onChange={updateForm(setEditingServiceForm)}
                                        required
                                      />
                                    </label>
                                    <label>
                                      Capacity
                                      <input
                                        name="capacity"
                                        type="number"
                                        min="1"
                                        value={editingServiceForm.capacity}
                                        onChange={updateForm(setEditingServiceForm)}
                                        required
                                      />
                                    </label>
                                    <label>
                                      Price
                                      <input
                                        name="price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editingServiceForm.price}
                                        onChange={updateForm(setEditingServiceForm)}
                                        required
                                      />
                                    </label>
                                    <label className="checkbox-row">
                                      <input
                                        name="active"
                                        type="checkbox"
                                        checked={editingServiceForm.active}
                                        onChange={(event) =>
                                          setEditingServiceForm((current) => ({
                                            ...current,
                                            active: event.target.checked,
                                          }))
                                        }
                                      />
                                      Service is active
                                    </label>
                                  </div>
                                  <label>
                                    Description
                                    <textarea
                                      name="description"
                                      value={editingServiceForm.description}
                                      onChange={updateForm(setEditingServiceForm)}
                                      rows="4"
                                      required
                                    />
                                  </label>
                                  <div className="admin-actions">
                                    <button type="submit" disabled={serviceLoading}>
                                      {serviceLoading ? 'Saving...' : 'Save changes'}
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() => {
                                        setEditingServiceId('');
                                        setEditingServiceForm(emptyServiceForm);
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : null}

                              <div className="admin-actions">
                                <button type="button" onClick={() => startEditingService(service)}>
                                  {editingServiceId === service._id ? 'Close editor' : 'Edit'}
                                </button>
                                {service.active ? (
                                  <button type="button" className="danger-button" onClick={() => handleDeactivateService(service._id)}>
                                    Deactivate
                                  </button>
                                ) : null}
                                <button type="button" className="secondary-button" onClick={() => handleDeleteService(service._id)}>
                                  Delete
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}

              {adminPage === 'locations' ? (
                <>
                  {adminLocationsView === 'directory' ? (
                    <section className="panel panel-emphasis bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Studio Map</p>
                        <h2>Locations</h2>
                      </div>
                      <p className="section-copy">Keep every studio address, local service mix, and teaching footprint in one place before you review the live schedule.</p>
                      <div className="location-selector-grid">
                        {allAdminLocations.map((location) => {
                          const servicesAtLocation = adminServices.filter((service) =>
                            (service.locations || []).some((serviceLocation) => serviceLocation.id === location.id)
                          );
                          const instructorsAtLocation = adminInstructors.filter(
                            (instructor) =>
                              instructor.active !== false &&
                              (instructor.locationIds || []).map(String).includes(String(location.id))
                          );

                          return (
                            <button
                              key={location.id}
                              type="button"
                              className={`location-selector-card${selectedAdminLocation?.id === location.id ? ' active' : ''}`}
                              onClick={() => setSelectedAdminLocationId(location.id)}
                            >
                              <div className="location-selector-topline">
                                <h3>{location.name}</h3>
                                <span>{selectedAdminLocation?.id === location.id ? 'Viewing' : 'Select'}</span>
                              </div>
                              <p className="location-selector-address">{location.address}</p>
                              <div className="location-selector-stats">
                                <span>{servicesAtLocation.length} services</span>
                                <span>{instructorsAtLocation.length} instructors</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {adminLocationsView === 'schedule' ? (
                    <section className="panel bookings-panel">
                      <div className="location-schedule-header">
                        <div>
                          <p className="panel-kicker">Location Schedule</p>
                          <h2>{selectedAdminLocation ? `${selectedAdminLocation.name} Weekly Teaching Board` : 'Select a location'}</h2>
                          <p className="section-copy">
                            {selectedAdminLocation
                              ? `${selectedAdminLocation.address}. Review the next seven days of classes, instructors, and session times in one clean schedule view.`
                              : 'Choose a location above to review its upcoming weekly schedule.'}
                          </p>
                        </div>
                      </div>

                      {selectedAdminLocation ? (
                        <>
                          <div className="booking-insight-row">
                            <article className="booking-helper-card booking-helper-card-compact">
                              <strong>Address</strong>
                              <span>{selectedAdminLocation.address}</span>
                            </article>
                            <article className="booking-helper-card booking-helper-card-compact">
                              <strong>Services here</strong>
                              <span>
                                {adminServices.filter((service) =>
                                  (service.locations || []).some((location) => location.id === selectedAdminLocation.id)
                                ).length} live services
                              </span>
                            </article>
                            <article className="booking-helper-card booking-helper-card-compact">
                              <strong>Instructors here</strong>
                              <span>
                                {adminInstructors.filter(
                                  (instructor) =>
                                    instructor.active !== false &&
                                    (instructor.locationIds || []).map(String).includes(String(selectedAdminLocation.id))
                                ).length} active instructors
                              </span>
                            </article>
                          </div>
                          <div className="location-schedule-grid">
                            {locationScheduleDays.map((day) => (
                              <article key={day.key} className="location-day-card">
                                <div className="location-day-header">
                                  <div>
                                    <h3>{day.weekday}</h3>
                                    <span>{day.dateLabel}</span>
                                  </div>
                                  <strong>{day.entries.length} session{day.entries.length === 1 ? '' : 's'}</strong>
                                </div>
                                {day.entries.length > 0 ? (
                                  <div className="location-session-list">
                                    {day.entries.map((entry) => (
                                      <article key={entry.key} className="location-session-row">
                                        <div className="location-session-meta">
                                          <span>{entry.timeLabel}</span>
                                          <span>{entry.category}</span>
                                        </div>
                                        <strong>{entry.serviceName}</strong>
                                        <p className="location-session-instructor">
                                          {entry.bookingMode === 'self-led'
                                            ? entry.detailLabel
                                            : `Teaching: ${entry.instructorNames.join(', ')}`}
                                        </p>
                                      </article>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="section-copy">No classes scheduled for this location on that day.</p>
                                )}
                              </article>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="section-copy">No studio locations are available yet.</p>
                      )}
                    </section>
                  ) : null}
                </>
              ) : null}

              {adminPage === 'instructors' ? (
                <>
                  {adminInstructorsView === 'overview' ? (
                    <section className="panel panel-emphasis bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Instructor Team</p>
                        <h2>Employee Overview & Availability</h2>
                      </div>
                      <p className="section-copy">Keep the team snapshot and employee directory in one calm view before you make staffing changes.</p>
                      <div className="instructor-page-columns">
                        <div className="panel inset-panel instructor-summary-panel">
                          <div className="panel-heading compact-heading">
                            <p className="panel-kicker">Team Snapshot</p>
                            <h2>Instructor Team</h2>
                          </div>
                          <p className="section-copy">Keep the roster, active coverage, and multi-location staffing in view before you make schedule changes.</p>
                          <div className="booking-insight-row">
                            <article className="booking-helper-card booking-helper-card-compact">
                              <strong>Team members</strong>
                              <span>{adminInstructors.length} instructors in the directory</span>
                            </article>
                            <article className="booking-helper-card booking-helper-card-compact">
                              <strong>Active coverage</strong>
                              <span>
                                {adminInstructors.filter((instructor) => instructor.active !== false).length} currently bookable instructors
                              </span>
                            </article>
                            <article className="booking-helper-card booking-helper-card-compact">
                              <strong>Locations covered</strong>
                              <span>
                                {new Set(adminInstructors.flatMap((instructor) => instructor.locationIds || [])).size} studio locations
                              </span>
                            </article>
                          </div>
                        </div>

                        <div className="panel inset-panel instructor-directory-panel">
                          <div className="panel-heading compact-heading">
                            <p className="panel-kicker">Directory</p>
                            <h2>Employee Overview</h2>
                          </div>
                          <p className="section-copy">Review the whole employee roster, current assignments, and weekly work windows without leaving the instructor workspace.</p>
                          <div className="employee-overview-grid compact-employee-grid">
                            {adminInstructors.map((instructor) => {
                              const instructorServices = adminServices.filter((service) =>
                                (instructor.serviceIds || []).map(String).includes(String(service._id))
                              );
                              const instructorLocations = allAdminLocations.filter((location) =>
                                (instructor.locationIds || []).includes(location.id)
                              );

                              return (
                                <article key={instructor._id} className="service-card employee-card">
                                  <div className="service-card-header">
                                    <h3>{instructor.name}</h3>
                                    <span>{instructor.active !== false ? 'Active' : 'Inactive'}</span>
                                  </div>
                                  <p className="employee-title">{instructor.title}</p>
                                  <p>{instructor.bio}</p>
                                  <div className="employee-meta">
                                    <span>{instructor.email}</span>
                                    <span>{instructor.phone}</span>
                                  </div>
                                  <div className="tag-list">
                                    {instructorServices.map((service) => (
                                      <span key={service._id} className="tag-chip">
                                        {service.name}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="tag-list">
                                    {instructorLocations.map((location) => (
                                      <span key={location.id} className="tag-chip tag-chip-muted">
                                        {location.name}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="employee-availability-list">
                                    {(instructor.weeklyAvailability || []).slice(0, 4).map((block, index) => {
                                      const locationName =
                                        allAdminLocations.find((location) => location.id === block.locationId)?.name || block.locationId;
                                      const dayLabel =
                                        weekdayOptions.find((day) => day.value === Number(block.dayOfWeek))?.label || 'Day';
                                      return (
                                        <span key={`${block.locationId}-${block.dayOfWeek}-${index}`}>
                                          {dayLabel} · {locationName} · {formatTimeLabel(block.startTime)} - {formatTimeLabel(block.endTime)}
                                        </span>
                                      );
                                    })}
                                    {(instructor.weeklyAvailability || []).length > 4 ? (
                                      <span>+{instructor.weeklyAvailability.length - 4} more availability windows</span>
                                    ) : null}
                                  </div>
                                  <div className="admin-actions">
                                    <button
                                      type="button"
                                      onClick={() => startEditingInstructor(instructor)}
                                    >
                                      {editingInstructorId === instructor._id ? 'Close editor' : 'Edit employee'}
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() => {
                                        const firstService = adminServices.find((service) =>
                                          (instructor.serviceIds || []).map(String).includes(String(service._id))
                                        );
                                        const firstLocation =
                                          (firstService?.locations || []).find((location) =>
                                            (instructor.locationIds || []).includes(location.id)
                                          ) || firstService?.locations?.[0];
                                        setAdminInstructorsView('coverage');
                                        setOverrideForm({
                                          serviceId: firstService?._id || '',
                                          date: '',
                                          locationId: firstLocation?.id || '',
                                          time: '',
                                          instructorName: instructor.name,
                                        });
                                      }}
                                    >
                                      Use in override
                                    </button>
                                  </div>
                                  {editingInstructorId === instructor._id ? renderInstructorEditor({ inline: true }) : null}
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {adminInstructorsView === 'editor' ? (
                    <section className="panel panel-emphasis bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">New Employee</p>
                        <h2>Add a New Instructor</h2>
                      </div>
                      <p className="section-copy">Create a new team member, decide what they teach, where they work, and add their weekly teaching windows.</p>
                      {renderInstructorEditor()}
                    </section>
                  ) : null}

                  {adminInstructorsView === 'availability' ? (
                    <section className="panel bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Availability</p>
                        <h2>Book By Instructor</h2>
                      </div>
                      <p className="section-copy">See exactly when a team member is available to teach at a chosen location before you answer member questions or set an override.</p>
                      <div className="booking-form">
                        <div className="form-grid-two">
                          <label>
                            Instructor
                            <select
                              value={availabilityExplorer.instructorId}
                              onChange={(event) => {
                                const nextInstructor = adminInstructors.find((instructor) => instructor._id === event.target.value);
                                const nextService = adminServices.find((service) =>
                                  (nextInstructor?.serviceIds || []).map(String).includes(String(service._id))
                                );
                                const nextLocation = (nextService?.locations || []).find((location) =>
                                  (nextInstructor?.locationIds || []).includes(location.id)
                                );
                                setAvailabilityExplorer((current) => ({
                                  ...current,
                                  instructorId: event.target.value,
                                  serviceId: nextService?._id || '',
                                  locationId: nextLocation?.id || '',
                                }));
                              }}
                            >
                              {adminInstructors.map((instructor) => (
                                <option key={instructor._id} value={instructor._id}>
                                  {instructor.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Service
                            <select
                              value={selectedAvailabilityService?._id || ''}
                              onChange={(event) => {
                                const nextService = adminServices.find((service) => service._id === event.target.value);
                                setAvailabilityExplorer((current) => ({
                                  ...current,
                                  serviceId: event.target.value,
                                  locationId: nextService?.locations?.[0]?.id || '',
                                }));
                              }}
                            >
                              {availabilityServiceOptions.map((service) => (
                                <option key={service._id} value={service._id}>
                                  {service.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Location
                            <select
                              value={selectedAvailabilityLocation?.id || ''}
                              onChange={(event) =>
                                setAvailabilityExplorer((current) => ({ ...current, locationId: event.target.value }))
                              }
                            >
                              {availabilityLocationOptions.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Date
                            <input
                              type="date"
                              value={availabilityExplorer.date}
                              min={new Date().toISOString().slice(0, 10)}
                              onChange={(event) =>
                                setAvailabilityExplorer((current) => ({ ...current, date: event.target.value }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                      <div className="availability-chip-grid">
                        {availabilityExplorer.date ? (
                          instructorAvailabilitySlots.length > 0 ? (
                            instructorAvailabilitySlots.map((slot) => (
                              <span key={slot.time} className="availability-chip">
                                {slot.label}
                              </span>
                            ))
                          ) : (
                            <p className="section-copy">No available class times for that instructor on the selected date.</p>
                          )
                        ) : (
                          <p className="section-copy">Pick a date to see that instructor’s teaching windows.</p>
                        )}
                      </div>
                    </section>
                  ) : null}

                  {adminInstructorsView === 'coverage' ? (
                    <section className="panel bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Coverage</p>
                        <h2>One-Time Instructor Coverage</h2>
                      </div>
                      <p className="section-copy">Use this workspace when a specific class needs a new instructor without changing the standard weekly schedule.</p>
                      <div className="admin-workspace-columns">
                        <div className="panel inset-panel">
                          <div className="panel-heading compact-heading">
                            <p className="panel-kicker">Override</p>
                            <h2>One-Time Coverage Change</h2>
                          </div>
                          <p className="section-copy">Pick the service, date, class time, and the instructor who should cover that slot.</p>
                          <form className="booking-form" onSubmit={handleOverrideSubmit}>
                            <div className="form-grid-two">
                              <label>
                                Service
                                <select
                                  name="serviceId"
                                  value={overrideForm.serviceId}
                                  onChange={(event) => {
                                    const nextService = adminServices.find((service) => service._id === event.target.value);
                                    setOverrideForm((current) => ({
                                      ...current,
                                      serviceId: event.target.value,
                                      locationId: nextService?.locations?.[0]?.id || '',
                                      date: '',
                                      time: '',
                                      instructorName: '',
                                    }));
                                  }}
                                  required
                                >
                                  {adminServices.map((service) => (
                                    <option key={service._id} value={service._id}>
                                      {service.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Location
                                <select
                                  name="locationId"
                                  value={overrideForm.locationId}
                                  onChange={(event) =>
                                    setOverrideForm((current) => ({
                                      ...current,
                                      locationId: event.target.value,
                                      time: '',
                                      instructorName: '',
                                    }))
                                  }
                                  required
                                >
                                  {(selectedOverrideService?.locations || []).map((location) => (
                                    <option key={location.id} value={location.id}>
                                      {location.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Date
                                <input
                                  name="date"
                                  type="date"
                                  value={overrideForm.date}
                                  min={new Date().toISOString().slice(0, 10)}
                                  onChange={(event) =>
                                    setOverrideForm((current) => ({
                                      ...current,
                                      date: event.target.value,
                                      time: '',
                                      instructorName: '',
                                    }))
                                  }
                                  required
                                />
                              </label>
                              <label>
                                Class time
                                <select
                                  name="time"
                                  value={overrideForm.time}
                                  onChange={(event) =>
                                    setOverrideForm((current) => ({
                                      ...current,
                                      time: event.target.value,
                                      instructorName:
                                        overrideSlots.find((slot) => slot.time === event.target.value)?.defaultInstructor || '',
                                    }))
                                  }
                                  disabled={!overrideForm.date}
                                  required
                                >
                                  <option value="">{overrideForm.date ? 'Select a class time' : 'Choose a date first'}</option>
                                  {overrideSlots.map((slot) => (
                                    <option key={slot.time} value={slot.time}>
                                      {slot.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Instructor
                                <select
                                  name="instructorName"
                                  value={overrideForm.instructorName}
                                  onChange={updateForm(setOverrideForm)}
                                  disabled={!overrideForm.time}
                                  required
                                >
                                  <option value="">{overrideForm.time ? 'Select instructor' : 'Choose a time first'}</option>
                                  {overrideInstructorOptions.map((instructor) => (
                                    <option key={instructor} value={instructor}>
                                      {instructor}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="booking-helper-card booking-helper-card-compact">
                                <strong>Override preview</strong>
                                <span>
                                  {overrideForm.date && overrideForm.time
                                    ? `${overrideForm.date} at ${formatTimeLabel(overrideForm.time)}`
                                    : 'Pick a date and time to preview the override.'}
                                </span>
                              </div>
                            </div>
                            <button type="submit" disabled={overrideLoading}>
                              {overrideLoading ? 'Saving...' : 'Save instructor change'}
                            </button>
                          </form>
                        </div>

                        <div className="panel inset-panel">
                          <div className="panel-heading compact-heading">
                            <p className="panel-kicker">Saved Changes</p>
                            <h2>Scheduled Coverage Changes</h2>
                          </div>
                          <p className="section-copy">Review every one-time instructor swap tied to the currently selected service.</p>
                          <div className="service-list admin-override-list">
                            {(selectedOverrideService?.scheduleOverrides || []).length === 0 ? (
                              <p>No instructor changes have been scheduled yet.</p>
                            ) : (
                              selectedOverrideService.scheduleOverrides
                                .slice()
                                .sort((left, right) =>
                                  `${left.date}-${left.time}`.localeCompare(`${right.date}-${right.time}`)
                                )
                                .map((override) => {
                                  const overrideLocation = selectedOverrideService.locations.find((location) => location.id === override.locationId);
                                  return (
                                    <article key={override.id} className="service-card">
                                      <div className="service-card-header">
                                        <h3>{override.instructorName}</h3>
                                        <span>{formatTimeLabel(override.time)}</span>
                                      </div>
                                      <p>
                                        {override.date} at {overrideLocation?.name || 'Selected location'}
                                      </p>
                                      <p>{overrideLocation?.address}</p>
                                      <div className="admin-actions">
                                        <button
                                          type="button"
                                          className="danger-button"
                                          onClick={() => handleRemoveOverride(selectedOverrideService._id, override.id)}
                                        >
                                          Remove override
                                        </button>
                                      </div>
                                    </article>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}

              {adminPage === 'users' ? (
                <>
                  {adminUsersView === 'overview' ? (
                    <section className="panel panel-emphasis bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Users</p>
                        <h2>Admin Team & Member Directory</h2>
                      </div>
                      <p className="section-copy">Keep your main admin, admin team, and member roster in one clean workspace before you change permissions.</p>
                      <div className="users-page-columns">
                        <div className="users-page-column">
                          {mainAdminUser ? (
                            <section className="panel inset-panel main-admin-spotlight">
                              <div className="panel-heading compact-heading">
                                <p className="panel-kicker">Main Admin</p>
                                <h2>{mainAdminUser.name}</h2>
                              </div>
                              <p className="section-copy">
                                This role controls promotions, demotions, and admin titles across the live studio workspace.
                              </p>
                              <div className="user-role-row user-role-row-padded">
                                <span className="permission-chip permission-chip-main">Main admin</span>
                                <span className="tag-chip tag-chip-muted">{mainAdminUser.membershipNumber}</span>
                              </div>
                              <div className="employee-meta">
                                <span>{mainAdminUser.email}</span>
                                <span>{mainAdminUser.adminTitle || 'Main Admin'}</span>
                              </div>
                              {viewerIsMainAdmin ? (
                                <div className="admin-actions">
                                  <button type="button" onClick={() => startEditingAdminUser(mainAdminUser, 'update')}>
                                    {editingAdminUserId === mainAdminUser._id ? 'Close editor' : 'Edit role'}
                                  </button>
                                </div>
                              ) : null}
                              {editingAdminUserId === mainAdminUser._id ? renderAdminUserEditor(mainAdminUser) : null}
                            </section>
                          ) : null}

                          <section className="panel inset-panel">
                            <div className="panel-heading compact-heading">
                              <p className="panel-kicker">Admin Team</p>
                              <h2>Current Admins</h2>
                            </div>
                            <p className="section-copy">See every admin account, their title, and the role label members will recognize.</p>
                            {adminTeam.length > 0 ? (
                              <div className="user-directory-grid">
                                {adminTeam.map((managedUser) => (
                                  <article key={managedUser._id} className="service-card employee-card user-card">
                                    <div className="service-card-header">
                                      <h3>{managedUser.name}</h3>
                                      <span>{managedUser.membershipNumber}</span>
                                    </div>
                                    <div className="user-role-row">
                                      <span
                                        className={`permission-chip${
                                          managedUser.adminPermission === 'main-admin' ? ' permission-chip-main' : ''
                                        }`}
                                      >
                                        {managedUser.adminPermission === 'main-admin' ? 'Main admin' : 'Admin'}
                                      </span>
                                      <span className="tag-chip tag-chip-muted">{managedUser.adminTitle || 'Admin'}</span>
                                    </div>
                                    <div className="employee-meta">
                                      <span>{managedUser.email}</span>
                                      <span>{managedUser.role === 'admin' ? 'Studio administrator' : 'Member'}</span>
                                    </div>
                                    {viewerIsMainAdmin ? (
                                      <div className="admin-actions">
                                        <button type="button" onClick={() => startEditingAdminUser(managedUser, 'update')}>
                                          {editingAdminUserId === managedUser._id ? 'Close editor' : 'Edit role'}
                                        </button>
                                        {managedUser.adminPermission !== 'main-admin' ? (
                                          <button
                                            type="button"
                                            className="secondary-button"
                                            onClick={() => handleAdminUserDemote(managedUser)}
                                          >
                                            Demote
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {editingAdminUserId === managedUser._id ? renderAdminUserEditor(managedUser) : null}
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p className="users-empty-state">No admin users are listed yet.</p>
                            )}
                          </section>
                        </div>

                        <div className="users-page-column">
                          <section className="panel inset-panel">
                            <div className="panel-heading compact-heading">
                              <p className="panel-kicker">Members</p>
                              <h2>Member Directory</h2>
                            </div>
                            <p className="section-copy">Promote any client account into the admin team, or quickly review the current member roster.</p>
                            {memberUsers.length > 0 ? (
                              <div className="user-directory-grid">
                                {memberUsers.map((managedUser) => (
                                  <article key={managedUser._id} className="service-card employee-card user-card">
                                    <div className="service-card-header">
                                      <h3>{managedUser.name}</h3>
                                      <span>{managedUser.membershipNumber}</span>
                                    </div>
                                    <div className="user-role-row">
                                      <span className="permission-chip">Member</span>
                                    </div>
                                    <div className="employee-meta">
                                      <span>{managedUser.email}</span>
                                      <span>Client account</span>
                                    </div>
                                    {viewerIsMainAdmin ? (
                                      <div className="admin-actions">
                                        <button type="button" onClick={() => startEditingAdminUser(managedUser, 'promote')}>
                                          {editingAdminUserId === managedUser._id ? 'Close editor' : 'Promote'}
                                        </button>
                                      </div>
                                    ) : null}
                                    {editingAdminUserId === managedUser._id ? renderAdminUserEditor(managedUser) : null}
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p className="users-empty-state">No member accounts have been created yet.</p>
                            )}
                          </section>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {adminUsersView === 'admins' ? (
                    <section className="panel panel-emphasis bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Admins</p>
                        <h2>Admin Team Directory</h2>
                      </div>
                      <p className="section-copy">Review all admin accounts, their titles, and adjust permissions without leaving the list.</p>
                      <div className="user-directory-grid">
                        {adminTeam.map((managedUser) => (
                          <article key={managedUser._id} className="service-card employee-card user-card">
                            <div className="service-card-header">
                              <h3>{managedUser.name}</h3>
                              <span>{managedUser.membershipNumber}</span>
                            </div>
                            <div className="user-role-row">
                              <span
                                className={`permission-chip${
                                  managedUser.adminPermission === 'main-admin' ? ' permission-chip-main' : ''
                                }`}
                              >
                                {managedUser.adminPermission === 'main-admin' ? 'Main admin' : 'Admin'}
                              </span>
                              <span className="tag-chip tag-chip-muted">{managedUser.adminTitle || 'Admin'}</span>
                            </div>
                            <div className="employee-meta">
                              <span>{managedUser.email}</span>
                              <span>{managedUser.role === 'admin' ? 'Studio administrator' : 'Member'}</span>
                            </div>
                            {viewerIsMainAdmin ? (
                              <div className="admin-actions">
                                <button type="button" onClick={() => startEditingAdminUser(managedUser, 'update')}>
                                  {editingAdminUserId === managedUser._id ? 'Close editor' : 'Edit role'}
                                </button>
                                {managedUser.adminPermission !== 'main-admin' ? (
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => handleAdminUserDemote(managedUser)}
                                  >
                                    Demote
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            {editingAdminUserId === managedUser._id ? renderAdminUserEditor(managedUser) : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {adminUsersView === 'members' ? (
                    <section className="panel panel-emphasis bookings-panel">
                      <div className="panel-heading">
                        <p className="panel-kicker">Members</p>
                        <h2>Client Accounts</h2>
                      </div>
                      <p className="section-copy">Promote a client into the admin team whenever you need a studio manager or location lead.</p>
                      <div className="user-directory-grid">
                        {memberUsers.map((managedUser) => (
                          <article key={managedUser._id} className="service-card employee-card user-card">
                            <div className="service-card-header">
                              <h3>{managedUser.name}</h3>
                              <span>{managedUser.membershipNumber}</span>
                            </div>
                            <div className="user-role-row">
                              <span className="permission-chip">Member</span>
                            </div>
                            <div className="employee-meta">
                              <span>{managedUser.email}</span>
                              <span>Client account</span>
                            </div>
                            {viewerIsMainAdmin ? (
                              <div className="admin-actions">
                                <button type="button" onClick={() => startEditingAdminUser(managedUser, 'promote')}>
                                  {editingAdminUserId === managedUser._id ? 'Close editor' : 'Promote'}
                                </button>
                              </div>
                            ) : null}
                            {editingAdminUserId === managedUser._id ? renderAdminUserEditor(managedUser) : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}

              {adminPage === 'schedule' ? (
                adminScheduleView === 'overview' ? (
                  <section className="panel panel-emphasis bookings-panel">
                    <div className="panel-heading">
                      <p className="panel-kicker">Schedule</p>
                      <h2>Attendance & Session Overview</h2>
                    </div>
                    <p className="section-copy">Use this snapshot to see what is coming up next, what still needs attendance review, and where the last completed class landed.</p>
                    <div className="member-summary-grid">
                      <article className="feature-card">
                        <h3>Next upcoming class</h3>
                        <p>
                          {nextUpcomingAdminSession
                            ? `${nextUpcomingAdminSession.serviceName} at ${nextUpcomingAdminSession.locationName} on ${formatBookingDate(nextUpcomingAdminSession.appointmentDate)}.`
                            : 'No upcoming classes are booked yet.'}
                        </p>
                      </article>
                      <article className="feature-card">
                        <h3>Attendance waiting</h3>
                        <p>
                          {pendingAttendanceCount > 0
                            ? `${pendingAttendanceCount} booking${pendingAttendanceCount === 1 ? '' : 's'} still need an attended or no-show decision.`
                            : 'All finished classes have already been reviewed.'}
                        </p>
                      </article>
                      <article className="feature-card">
                        <h3>Latest completed class</h3>
                        <p>
                          {latestCompletedAdminSession
                            ? `${latestCompletedAdminSession.serviceName} had ${latestCompletedAdminSession.bookings.length} booking${latestCompletedAdminSession.bookings.length === 1 ? '' : 's'} and is ready for follow-up.`
                            : 'Completed classes will appear here once the schedule starts moving.'}
                        </p>
                      </article>
                    </div>
                  </section>
                ) : null
              ) : null}
            </>
          ) : (
            <>
              {memberPage === 'book' ? (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <p className="panel-kicker">Service Menu</p>
                      <h2>Book a Class or Service</h2>
                    </div>
                    <p className="section-copy">Choose the experience that fits your week, see the live price, and book with checkout in one step.</p>

                    {loadingServices ? (
                      <p>Loading services...</p>
                    ) : (
                      <div className="service-gallery">
                        {services.map((service) => (
                          (() => {
                            const presentation = getServicePresentation(service);
                            const ratingSummary = getMedianRatingSummary(serviceRatingsById[String(service._id)]);
                            return (
                              <article key={service._id} className="service-showcase-card">
                                <div className="service-showcase-visual">
                                  <img src={presentation.image || coverPicture} alt={service.name} />
                                  <div className="service-showcase-overlay">
                                    <p>{presentation.eyebrow}</p>
                                    <h3>{service.name}</h3>
                                  </div>
                                </div>
                                <div className="service-showcase-copy">
                                <div className="service-showcase-meta">
                                  <span>{service.category}</span>
                                  <strong>{formatPrice(service.price)}</strong>
                                </div>
                                <div className="service-rating">
                                  <strong>{ratingSummary.stars}</strong>
                                  <span>{ratingSummary.label}</span>
                                </div>
                                <p>{presentation.blurb}</p>
                                <div className="service-meta">
                                  <span>{service.durationMinutes} min</span>
                                  <span>{isSelfLedService(service) ? 'Flexible entry window' : `${service.capacity} spots per slot`}</span>
                                  <span>Instant booking included</span>
                                </div>
                              </div>
                            </article>
                            );
                          })()
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="panel panel-emphasis">
                    {recentBooking ? (
                      <div className="booking-confirmation">
                        <div className="panel-heading compact-heading">
                          <p className="panel-kicker">Class Booked</p>
                          <h2>You’re confirmed.</h2>
                        </div>
                        <p className="section-copy">
                          Your spot has been reserved and payment has already been processed.
                        </p>
                        <div className="booking-insight-row">
                          <article className="booking-helper-card booking-helper-card-compact">
                            <strong>Service</strong>
                            <span>{recentBooking.service?.name || 'Booked service'}</span>
                          </article>
                          <article className="booking-helper-card booking-helper-card-compact">
                            <strong>When</strong>
                            <span>{formatBookingDate(recentBooking.appointmentDate)}</span>
                          </article>
                          <article className="booking-helper-card booking-helper-card-compact">
                            <strong>Where</strong>
                            <span>{recentBooking.locationName}</span>
                          </article>
                          <article className="booking-helper-card booking-helper-card-compact">
                            <strong>Paid</strong>
                            <span>
                              {recentBooking.paymentStatus === 'Credit Applied'
                                ? 'Credit applied'
                                : formatPrice(recentBooking.paymentAmount || recentBooking.service?.price || 0)}
                            </span>
                          </article>
                        </div>
                        {recentBooking.instructorName ? (
                          <div className="booking-helper-card">
                            <strong>Instructor</strong>
                            <span>{recentBooking.instructorName}</span>
                          </div>
                        ) : null}
                        <div className="admin-actions">
                          <button type="button" onClick={() => setRecentBooking(null)}>
                            Schedule another
                          </button>
                          <button type="button" className="secondary-button" onClick={() => setMemberPage('schedule')}>
                            View my schedule
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="panel-heading compact-heading">
                          <p className="panel-kicker">Reservation</p>
                          <h2>Reserve Your Spot</h2>
                        </div>
                        <p className="section-copy">Your member details are already connected, so all you need is the service, date, and any helpful notes.</p>
                        <div className="booking-insight-row">
                          <article className="booking-helper-card booking-helper-card-compact">
                            <strong>Location</strong>
                            <span>
                              {selectedBookingLocation
                                ? `${selectedBookingLocation.name} · ${selectedBookingLocation.address}`
                                : 'Choose a service to see available locations.'}
                            </span>
                          </article>
                          <article className="booking-helper-card booking-helper-card-compact">
                            <strong>Schedule cadence</strong>
                            <span>
                              {selectedBookingService
                                ? `${selectedBookingService.durationMinutes} minute sessions every ${selectedBookingService.schedule?.intervalMinutes || selectedBookingService.durationMinutes} minutes`
                                : 'Select a service to see timing details.'}
                            </span>
                          </article>
                          <article className="booking-helper-card booking-helper-card-compact">
                            <strong>Amount due</strong>
                            <span>
                              {isUsingCreditForBooking
                                ? 'Credit applied to this Open Gym reschedule'
                                : selectedBookingService
                                  ? `${formatPrice(selectedBookingService.price)} paid at booking`
                                  : 'Choose a service to see the class price.'}
                            </span>
                          </article>
                          {activeCreditBooking ? (
                            <article className="booking-helper-card booking-helper-card-compact">
                              <strong>Credit selected</strong>
                              <span>
                                {activeCreditBooking.locationName} · {formatBookingDate(activeCreditBooking.appointmentDate)}
                              </span>
                            </article>
                          ) : null}
                        </div>
                        <form className="booking-form" onSubmit={handleBookingSubmit}>
                          <div className="form-grid-two">
                            <label>
                              Service
                              <select
                                name="serviceId"
                                value={bookingForm.serviceId}
                                onChange={(event) => {
                                  const nextService = services.find((service) => service._id === event.target.value);
                                  setBookingForm((current) => ({
                                    ...current,
                                    serviceId: event.target.value,
                                    locationId: nextService?.locations?.[0]?.id || '',
                                    bookingDate: '',
                                    slotTime: '',
                                    preferredInstructorId: '',
                                    instructorName: '',
                                  }));
                                }}
                                required
                              >
                                {services.map((service) => (
                                  <option key={service._id} value={service._id}>
                                    {service.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label>
                              Location
                              <select
                                name="locationId"
                                value={bookingForm.locationId}
                                onChange={(event) =>
                                  setBookingForm((current) => ({
                                    ...current,
                                    locationId: event.target.value,
                                    preferredInstructorId: '',
                                    slotTime: '',
                                    instructorName: '',
                                  }))
                                }
                                required
                              >
                                {(selectedBookingService?.locations || []).map((location) => (
                                  <option key={location.id} value={location.id}>
                                    {location.name} - {location.address}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {selectedBookingService?.bookingMode === 'instructor-led' ? (
                              <label>
                                Book with instructor
                                <select
                                  name="preferredInstructorId"
                                  value={bookingForm.preferredInstructorId}
                                  onChange={(event) => {
                                    const nextInstructor =
                                      bookingInstructorPool.find((instructor) => instructor._id === event.target.value) || null;
                                    setBookingForm((current) => ({
                                      ...current,
                                      preferredInstructorId: event.target.value,
                                      slotTime: '',
                                      instructorName: nextInstructor?.name || '',
                                    }));
                                  }}
                                >
                                  <option value="">Any instructor at this location</option>
                                  {bookingInstructorPool.map((instructor) => (
                                    <option key={instructor._id} value={instructor._id}>
                                      {instructor.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : null}

                            <label>
                              Date
                              <input
                                name="bookingDate"
                                type="date"
                                value={bookingForm.bookingDate}
                                min={new Date().toISOString().slice(0, 10)}
                                onChange={(event) =>
                                  setBookingForm((current) => ({
                                    ...current,
                                    bookingDate: event.target.value,
                                    slotTime: '',
                                    instructorName: preferredBookingInstructor?.name || '',
                                  }))
                                }
                                required
                              />
                            </label>

                            <label>
                              Available class time
                              <select
                                name="slotTime"
                                value={bookingForm.slotTime}
                                onChange={(event) => {
                                  const nextSlot = visibleBookingSlots.find((slot) => slot.time === event.target.value);
                                  setBookingForm((current) => ({
                                    ...current,
                                    slotTime: event.target.value,
                                    instructorName:
                                      selectedBookingService?.bookingMode === 'self-led'
                                        ? ''
                                        : preferredBookingInstructor?.name || nextSlot?.defaultInstructor || '',
                                  }));
                                }}
                                required
                                disabled={!bookingForm.bookingDate}
                              >
                                <option value="">{bookingForm.bookingDate ? 'Select a class time' : 'Choose a date first'}</option>
                                {visibleBookingSlots.map((slot) => (
                                  <option key={slot.time} value={slot.time}>
                                    {slot.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          {selectedBookingService?.bookingMode === 'instructor-led' ? (
                            <div className="form-grid-two">
                              {preferredBookingInstructor ? (
                                <div className="booking-helper-card booking-helper-card-compact">
                                  <strong>Chosen instructor</strong>
                                  <span>{preferredBookingInstructor.name}</span>
                                </div>
                              ) : (
                                <label>
                                  Instructor
                                  <select
                                    name="instructorName"
                                    value={bookingForm.instructorName}
                                    onChange={updateForm(setBookingForm)}
                                    required
                                    disabled={!bookingForm.slotTime}
                                  >
                                    <option value="">{bookingForm.slotTime ? 'Select an instructor' : 'Choose a time first'}</option>
                                    {bookingInstructorOptions.map((instructor) => (
                                      <option key={instructor} value={instructor}>
                                        {instructor}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <div className="booking-helper-card booking-helper-card-compact">
                                <strong>Instructor availability</strong>
                                <span>
                                  {preferredBookingInstructor && bookingForm.bookingDate
                                    ? visibleBookingSlots.length > 0
                                      ? `${preferredBookingInstructor.name} is teaching ${visibleBookingSlots.length} time${visibleBookingSlots.length === 1 ? '' : 's'} on this date.`
                                      : `${preferredBookingInstructor.name} has no remaining times at this location on that date.`
                                    : bookingForm.instructorName || 'Choose an instructor to see their available teaching windows.'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="booking-helper-card">
                              <strong>Self-led session</strong>
                              <span>Open Gym sessions do not require an instructor selection.</span>
                            </div>
                          )}

                          <label>
                            Notes
                            <textarea
                              name="notes"
                              value={bookingForm.notes}
                              onChange={updateForm(setBookingForm)}
                              rows="4"
                              placeholder="Optional notes for the wellness staff"
                            />
                          </label>
                          {isUsingCreditForBooking ? (
                            <div className="payment-panel">
                              <div className="panel-heading compact-heading">
                                <p className="panel-kicker">Credit</p>
                                <h3>Use your Open Gym credit</h3>
                              </div>
                              <p className="price-note">No new payment is needed for this rescheduled Open Gym session.</p>
                              <p className="form-note">
                                Your previous no-show created a one-time credit. Once this new class is booked, that credit will be marked as used.
                              </p>
                              <div className="admin-actions">
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => setCreditBookingId('')}
                                >
                                  Remove credit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="payment-panel">
                              <div className="panel-heading compact-heading">
                                <p className="panel-kicker">Checkout</p>
                                <h3>Pay for this booking</h3>
                              </div>
                              <p className="price-note">
                                {selectedBookingService
                                  ? `${selectedBookingService.name} · ${formatPrice(selectedBookingService.price)}`
                                  : 'Choose a service to see your total.'}
                              </p>
                              <div className="form-grid-two">
                                <label>
                                  Cardholder name
                                  <input
                                    name="paymentCardholderName"
                                    value={bookingForm.paymentCardholderName}
                                    onChange={updateForm(setBookingForm)}
                                    placeholder="Name on card"
                                    required
                                  />
                                </label>
                                <label>
                                  Card number
                                  <input
                                    name="paymentCardNumber"
                                    value={bookingForm.paymentCardNumber}
                                    onChange={updateForm(setBookingForm)}
                                    inputMode="numeric"
                                    placeholder="1111 2222 3333 4444"
                                    autoComplete="cc-number"
                                    required
                                  />
                                </label>
                              </div>
                              <p className="form-note">Demo checkout only. Enter any 16 digits. We only save the amount and last 4 digits, not the full card number.</p>
                            </div>
                          )}
                          <button type="submit" disabled={bookingLoading || loadingServices}>
                            {bookingLoading
                              ? 'Processing...'
                              : isUsingCreditForBooking
                                ? 'Use credit and book'
                                : selectedBookingService
                                  ? `Pay ${formatPrice(selectedBookingService.price)} and book`
                                  : 'Pay and book'}
                          </button>
                        </form>
                      </>
                    )}
                  </section>
                </>
              ) : null}

              {memberPage === 'schedule' ? (
                <section className="panel bookings-panel">
                  <div className="bookings-header">
                    <div>
                      <p className="panel-kicker">Timeline</p>
                      <h2>My Schedule</h2>
                      <p className="section-copy">See your upcoming and past appointments separately.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={loadBookings}>
                      Refresh
                    </button>
                  </div>

                  {loadingBookings ? (
                    <p>Loading bookings...</p>
                  ) : (
                    <>
                    <div className="history-grid">
                      <div>
                        <h3>Upcoming</h3>
                        <div className="booking-list">
                          {upcomingBookings.length === 0 ? (
                            <p>No upcoming bookings.</p>
                          ) : (
                            upcomingBookings.map((booking) => (
                              <article key={booking._id} className="booking-card">
                                <div className="booking-topline">
                                  <h3>{booking.service?.name || 'Service unavailable'}</h3>
                                  <span className={`status-pill status-${booking.status.toLowerCase()}`}>{formatBookingStatusLabel(booking.status)}</span>
                                </div>
                                <p>{formatBookingDate(booking.appointmentDate)}</p>
                                <p><strong>Paid:</strong> {formatPrice(booking.paymentAmount || booking.service?.price || 0)}</p>
                                <p><strong>Payment status:</strong> {formatPaymentStatusLabel(booking.paymentStatus)}</p>
                                <p><strong>Location:</strong> {booking.locationName}</p>
                                {booking.instructorName ? <p><strong>Instructor:</strong> {booking.instructorName}</p> : null}
                                {booking.paymentLast4 ? <p><strong>Card:</strong> ending in {booking.paymentLast4}</p> : null}
                                {booking.notes ? <p><strong>Notes:</strong> {booking.notes}</p> : null}
                                {booking.status !== 'Cancelled' ? (
                                  <div className="admin-actions">
                                    <button type="button" className="danger-button" onClick={() => handleCancelBooking(booking._id)}>
                                      Cancel booking
                                    </button>
                                  </div>
                                ) : null}
                              </article>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <h3>Past</h3>
                        <div className="booking-list">
                          {pastBookings.length === 0 ? (
                            <p>No past bookings yet.</p>
                          ) : (
                            pastBookings.map((booking) => (
                              <article key={booking._id} className="booking-card">
                                <div className="booking-topline">
                                  <h3>{booking.service?.name || 'Service unavailable'}</h3>
                                  <span className={`status-pill status-${booking.status.toLowerCase()}`}>{formatBookingStatusLabel(booking.status)}</span>
                                </div>
                                <p>{formatBookingDate(booking.appointmentDate)}</p>
                                <p><strong>Paid:</strong> {formatPrice(booking.paymentAmount || booking.service?.price || 0)}</p>
                                <p><strong>Attendance:</strong> {formatAttendanceStatusLabel(booking.attendanceStatus)}</p>
                                <p><strong>Location:</strong> {booking.locationName}</p>
                                {booking.instructorName ? <p><strong>Instructor:</strong> {booking.instructorName}</p> : null}
                                <p>{reviewLookup.has(String(booking._id)) ? 'Review submitted' : 'Ready for review'}</p>
                              </article>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="member-stack no-show-stack">
                      <div>
                        <h3>No-shows & Credits</h3>
                        <div className="booking-list">
                          {noShowBookings.length === 0 ? (
                            <p>No no-show bookings on your account.</p>
                          ) : (
                            noShowBookings.map((booking) => {
                              const eligibleCredit =
                                isSelfLedService(booking.service) &&
                                booking.creditEligible &&
                                !booking.creditRedeemedForBookingId;

                              return (
                                <article key={booking._id} className="booking-card">
                                  <div className="booking-topline">
                                    <h3>{booking.service?.name || 'Service unavailable'}</h3>
                                    <span className="status-pill status-cancelled">No-show</span>
                                  </div>
                                  <p>{formatBookingDate(booking.appointmentDate)}</p>
                                  <p><strong>Location:</strong> {booking.locationName}</p>
                                  {eligibleCredit ? (
                                    <p><strong>Credit:</strong> You can reschedule this Open Gym session without paying again.</p>
                                  ) : (
                                    <>
                                      <p><strong>Status:</strong> This class was missed and removed from your active schedule.</p>
                                      <p><strong>Demo fee:</strong> {formatPrice(booking.noShowFeeAmount || 0)}</p>
                                    </>
                                  )}
                                  {booking.creditRedeemedForBookingId ? (
                                    <p><strong>Credit status:</strong> Already used on a new booking.</p>
                                  ) : null}
                                  {eligibleCredit ? (
                                    <div className="admin-actions">
                                      <button type="button" onClick={() => startCreditReschedule(booking)}>
                                        Reschedule with credit
                                      </button>
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                    </>
                  )}
                </section>
              ) : null}

              {memberPage === 'profile' ? (
                <>
                  <section className="panel panel-emphasis">
                    <div className="panel-heading compact-heading">
                      <p className="panel-kicker">Account</p>
                      <h2>My Profile</h2>
                    </div>
                    <p className="section-copy">Keep your member details current before booking your next visit.</p>
                    <div className="booking-insight-row">
                      <article className="booking-helper-card booking-helper-card-compact">
                        <strong>Account email</strong>
                        <span>{profileForm.email || 'No email available'}</span>
                      </article>
                      <article className="booking-helper-card booking-helper-card-compact">
                        <strong>Membership number</strong>
                        <span>{profileForm.membershipNumber || 'Will appear after registration.'}</span>
                      </article>
                      <article className="booking-helper-card booking-helper-card-compact">
                        <strong>Email status</strong>
                        <span>{user?.emailVerified ? 'Verified' : 'Pending verification'}</span>
                      </article>
                      <article className="booking-helper-card booking-helper-card-compact">
                        <strong>Password changes</strong>
                        <span>Use your current password to confirm any email or password update.</span>
                      </article>
                    </div>
                    <form className="booking-form" onSubmit={handleProfileSubmit}>
                      <div className="form-grid-two">
                        <label>
                          Full name
                          <input name="name" value={profileForm.name} onChange={updateForm(setProfileForm)} required />
                        </label>
                        <label>
                          Email
                          <input name="email" type="email" value={profileForm.email} onChange={updateForm(setProfileForm)} required />
                        </label>
                        <label>
                          Current password
                          <input
                            name="currentPassword"
                            type="password"
                            value={profileForm.currentPassword}
                            onChange={updateForm(setProfileForm)}
                            placeholder="Required for email or password changes"
                          />
                        </label>
                        <label>
                          New password
                          <input
                            name="newPassword"
                            type="password"
                            value={profileForm.newPassword}
                            onChange={updateForm(setProfileForm)}
                            placeholder="Leave blank if you do not want to change it"
                          />
                        </label>
                        <label>
                          Confirm new password
                          <input
                            name="confirmPassword"
                            type="password"
                            value={profileForm.confirmPassword}
                            onChange={updateForm(setProfileForm)}
                          />
                        </label>
                      </div>
                      <button type="submit" disabled={profileLoading}>
                        {profileLoading ? 'Saving...' : 'Save profile'}
                      </button>
                      {!user?.emailVerified ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={handleRequestVerification}
                          disabled={profileLoading}
                        >
                          {profileLoading ? 'Sending...' : 'Send verification email'}
                        </button>
                      ) : null}
                    </form>
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <p className="panel-kicker">Membership</p>
                      <h2>Your Member Snapshot</h2>
                    </div>
                    <div className="member-summary-grid">
                      <article className="summary-card">
                        <strong>{upcomingBookings.length}</strong>
                        <span>Upcoming bookings</span>
                      </article>
                      <article className="summary-card membership-summary-card">
                        <strong>{profileForm.membershipNumber || 'MEM'}</strong>
                        <span>Membership ID</span>
                      </article>
                      <article className="summary-card">
                        <strong>{pastBookings.length}</strong>
                        <span>Completed visits</span>
                      </article>
                      <article className="summary-card">
                        <strong>{reviewLookup.size}</strong>
                        <span>Reviews submitted</span>
                      </article>
                    </div>
                  </section>
                </>
              ) : null}

              {memberPage === 'reviews' ? (
                <>
                  <section className="panel panel-emphasis">
                    <div className="panel-heading compact-heading">
                      <p className="panel-kicker">Feedback</p>
                      <h2>Leave a Review</h2>
                    </div>
                    <p className="section-copy">Share feedback after a completed visit so future members know what to expect.</p>
                    <form className="booking-form" onSubmit={handleReviewSubmit}>
                      <label>
                        Completed booking
                        <select name="bookingId" value={reviewForm.bookingId} onChange={updateForm(setReviewForm)} required>
                          <option value="">Select a past booking</option>
                          {reviewableBookings.map((booking) => (
                            <option key={booking._id} value={booking._id}>
                              {booking.service?.name || 'Service'} - {formatBookingDate(booking.appointmentDate)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Rating
                        <select name="rating" value={reviewForm.rating} onChange={updateForm(setReviewForm)} required>
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating} / 5
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Comment
                        <textarea
                          name="comment"
                          value={reviewForm.comment}
                          onChange={updateForm(setReviewForm)}
                          rows="4"
                          placeholder="What stood out about the service?"
                        />
                      </label>
                      <button type="submit" disabled={reviewLoading || reviewableBookings.length === 0}>
                        {reviewLoading ? 'Saving review...' : reviewableBookings.length === 0 ? 'No reviews available yet' : 'Submit review'}
                      </button>
                    </form>
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <p className="panel-kicker">Recent Feedback</p>
                      <h2>What Members Are Saying</h2>
                    </div>
                    <div className="service-list">
                      {reviews.length === 0 ? (
                        <p>No reviews yet.</p>
                      ) : (
                        reviews.map((review) => (
                          <article key={review._id} className="service-card">
                            <div className="service-card-header">
                              <h3>{review.service?.name || 'Service review'}</h3>
                              <span>{review.rating}/5</span>
                            </div>
                            <p>{review.comment || 'No written comment provided.'}</p>
                            <p><strong>{review.userName}</strong></p>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                </>
              ) : null}

              {memberPage === 'about' ? (
                <>
                  <section className="panel panel-emphasis">
                    <div className="panel-heading">
                      <p className="panel-kicker">About Us</p>
                      <h2>A calmer way to book your wellness routine.</h2>
                    </div>
                    <p className="section-copy about-copy">
                      Wellness Center Studio brings classes, massage, spa services, and gym access into one clean booking experience. Members can manage their time, staff can manage operations, and reviews help the studio keep improving.
                    </p>
                    <div className="about-highlights">
                      <article className="feature-card about-card">
                        <h3>Classes & Movement</h3>
                        <p>Pilates and guided sessions designed to feel easy to browse and simple to reserve.</p>
                      </article>
                      <article className="feature-card about-card">
                        <h3>Restorative Care</h3>
                        <p>Massage and spa experiences that support recovery, routine, and a more elevated studio feel.</p>
                      </article>
                      <article className="feature-card about-card">
                        <h3>Member Experience</h3>
                        <p>Profiles, booking history, pricing, attendance, and reviews all live in one organized place.</p>
                      </article>
                    </div>
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <p className="panel-kicker">Signature Services</p>
                      <h2>Explore the Studio</h2>
                    </div>
                    <div className="editorial-strip member-editorial-strip">
                      {services.slice(0, 3).map((service) => {
                        const presentation = getServicePresentation(service);
                        const ratingSummary = getMedianRatingSummary(serviceRatingsById[String(service._id)]);
                        return (
                          <article key={service._id} className="editorial-card">
                            <div className="editorial-visual">
                              <img src={presentation.image || coverPicture} alt={service.name} />
                            </div>
                            <div className="editorial-copy">
                              <p>{presentation.eyebrow}</p>
                              <h3>{service.name}</h3>
                              <div className="service-rating service-rating-compact">
                                <strong>{ratingSummary.stars}</strong>
                                <span>{ratingSummary.label}</span>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                </>
              ) : null}
            </>
          )}

          {!isAdmin || (adminPage === 'schedule' && adminScheduleView !== 'overview') ? (
            <section className="panel bookings-panel">
              <div className="bookings-header">
                <div>
                  <p className="panel-kicker">{isAdmin ? 'Studio Calendar' : 'Social Proof'}</p>
                  <h2>
                    {isAdmin
                      ? adminScheduleView === 'calendar'
                        ? 'Monthly Class Calendar'
                        : adminScheduleView === 'completed'
                          ? 'Past Class Review'
                          : 'Future Class Schedule'
                      : 'Recent Reviews'}
                  </h2>
                  <p className="section-copy">
                    {isAdmin
                      ? adminScheduleView === 'calendar'
                        ? 'View the month at a glance, then jump back into class details whenever you need them.'
                        : adminScheduleView === 'completed'
                          ? 'Review finished classes, confirm attendance, and mark any no-shows after the session has passed.'
                          : 'See who is booked into each future session and how many spots are still left.'
                      : 'Member feedback helps show what the wellness center is doing well.'}
                  </p>
                </div>
              </div>

              {isAdmin ? (
                <>
                  {loadingBookings ? (
                    <p>Loading bookings...</p>
                  ) : (
                    <div className="member-stack schedule-stack">
                      {adminScheduleView === 'calendar' ? (
                        <div className="admin-calendar-panel">
                          <div className="admin-calendar-header">
                            <div>
                              <p className="panel-kicker">Monthly View</p>
                              <h2>{formatMonthLabel(calendarMonthDate)}</h2>
                            </div>
                            <div className="admin-calendar-nav">
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  setCalendarMonthDate(
                                    (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                                  )
                                }
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  setCalendarMonthDate(
                                    (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                                  )
                                }
                              >
                                Next
                              </button>
                            </div>
                          </div>
                          <div className="admin-calendar-grid">
                            {calendarWeekdays.map((weekday) => (
                              <div key={weekday} className="admin-calendar-weekday">
                                {weekday}
                              </div>
                            ))}
                            {calendarCells.map((day) => (
                              <article
                                key={day.key}
                                className={`admin-calendar-day${day.isCurrentMonth ? '' : ' muted'}${day.isToday ? ' today' : ''}`}
                              >
                                <div className="admin-calendar-day-label">{day.label}</div>
                                <div className="admin-calendar-events">
                                  {day.sessions.length === 0 ? (
                                    <span className="admin-calendar-empty">No classes</span>
                                  ) : (
                                    day.sessions.map((session) => (
                                      <div key={session.key} className="admin-calendar-event">
                                        <strong>{session.serviceName}</strong>
                                        <span>{new Date(session.appointmentDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                        <span>{session.locationName}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {adminScheduleView === 'upcoming' ? (
                        <div>
                          <div className="panel-heading compact-heading">
                            <p className="panel-kicker">Upcoming</p>
                            <h2>Future Classes</h2>
                          </div>
                          {adminUpcomingSessions.length === 0 ? (
                            <p>No upcoming sessions are booked yet.</p>
                          ) : (
                            <div className="schedule-session-grid">
                              {adminUpcomingSessions.map((session) => (
                                <article key={session.key} className="schedule-session-card">
                                  <div className="schedule-session-topline">
                                    <div>
                                      <p className="panel-kicker">{session.category || 'Session'}</p>
                                      <h3>{session.serviceName}</h3>
                                    </div>
                                    <span className="status-pill status-approved">{session.spotsLeft} spots left</span>
                                  </div>
                                  <div className="schedule-session-meta">
                                    <span>{formatBookingDate(session.appointmentDate)}</span>
                                    <span>{session.locationName}</span>
                                    <span>{formatPrice(session.price)}</span>
                                  </div>
                                  <p className="schedule-session-address">{session.locationAddress}</p>
                                  {session.instructorName ? <p className="schedule-session-address"><strong>Instructor:</strong> {session.instructorName}</p> : null}
                                  <div className="schedule-member-list">
                                    {session.bookings.map((booking) => (
                                      <article key={booking._id} className="schedule-member-card">
                                        <div>
                                          <strong>{booking.clientName}</strong>
                                          <span>{booking.email}</span>
                                          <span>{formatPaymentStatusLabel(booking.paymentStatus)}</span>
                                          {booking.paymentLast4 ? <span>Card ending in {booking.paymentLast4}</span> : null}
                                        </div>
                                        <div className="schedule-member-actions">
                                          {booking.status !== 'Cancelled' ? (
                                            <button
                                              type="button"
                                              className="danger-button"
                                              onClick={() => handleCancelBooking(booking._id)}
                                            >
                                              Cancel booking
                                            </button>
                                          ) : null}
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                  <div className="schedule-capacity-row">
                                    <strong>{session.bookings.length} booked</strong>
                                    <span>{session.capacity} total spots</span>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {adminScheduleView === 'completed' ? (
                        <div>
                          <div className="panel-heading compact-heading">
                            <p className="panel-kicker">Completed</p>
                            <h2>Past Classes</h2>
                          </div>
                          <p className="section-copy">
                            Once a class time has passed, use these member rows to confirm attended or mark a no-show.
                          </p>
                          {adminCompletedSessions.length === 0 ? (
                            <p>No past sessions yet.</p>
                          ) : (
                            <div className="schedule-session-grid">
                              {adminCompletedSessions.map((session) => (
                                <article key={session.key} className="schedule-session-card">
                                  <div className="schedule-session-topline">
                                    <div>
                                      <p className="panel-kicker">{session.category || 'Session'}</p>
                                      <h3>{session.serviceName}</h3>
                                    </div>
                                    <span className="status-pill">{session.bookings.length} bookings</span>
                                  </div>
                                  <div className="schedule-session-meta">
                                    <span>{formatBookingDate(session.appointmentDate)}</span>
                                    <span>{session.locationName}</span>
                                    <span>{formatPrice(session.price)}</span>
                                  </div>
                                  <p className="schedule-session-address">{session.locationAddress}</p>
                                  {session.instructorName ? <p className="schedule-session-address"><strong>Instructor:</strong> {session.instructorName}</p> : null}
                                  <div className="schedule-member-list">
                                    {session.bookings.map((booking) => (
                                      <article key={booking._id} className="schedule-member-card">
                                        <div>
                                          <strong>{booking.clientName}</strong>
                                          <span>{booking.email}</span>
                                          <span>{formatAttendanceStatusLabel(booking.attendanceStatus)}</span>
                                          <span>{formatPaymentStatusLabel(booking.paymentStatus)}</span>
                                          {booking.paymentLast4 ? <span>Card ending in {booking.paymentLast4}</span> : null}
                                          {booking.noShowFeeAmount ? <span>No-show fee: {formatPrice(booking.noShowFeeAmount)}</span> : null}
                                          {booking.creditEligible ? <span>Open Gym credit available</span> : null}
                                        </div>
                                        <div className="schedule-member-actions">
                                          {booking.attendanceStatus === 'Scheduled' ? (
                                            <>
                                              <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() => handleAttendanceUpdate(booking._id, 'Attended')}
                                              >
                                                Confirm attended
                                              </button>
                                              <button
                                                type="button"
                                                className="danger-button"
                                                onClick={() => handleAttendanceUpdate(booking._id, 'No-show')}
                                              >
                                                Mark no-show
                                              </button>
                                            </>
                                          ) : null}
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                  <div className="schedule-capacity-row">
                                    <strong>{session.bookings.length} booked</strong>
                                    <span>{session.capacity} total spots</span>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <div className="service-list">
                  {reviews.length === 0 ? (
                    <p>No reviews yet.</p>
                  ) : (
                    reviews.map((review) => (
                      <article key={review._id} className="service-card">
                        <div className="service-card-header">
                          <h3>{review.service?.name || 'Service review'}</h3>
                          <span>{review.rating}/5</span>
                        </div>
                        <p>{review.comment || 'No written comment provided.'}</p>
                        <p><strong>{review.userName}</strong></p>
                      </article>
                    ))
                  )}
                </div>
              )}
            </section>
          ) : null}
        </main>
      )}
    </div>
  );
}
