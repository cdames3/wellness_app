import { useEffect, useState } from 'react';
import coverPicture from './assets/cover-picture.jpg';
import gymImage from './assets/gym.jpg';
import massageImage from './assets/massage.jpg';
import pilatesImage from './assets/pilates.jpg';
import spaImage from './assets/sauna-spa.jpg';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

const emptyRegisterForm = {
  name: '',
  email: '',
  password: '',
};

const emptyLoginForm = {
  identifier: '',
  password: '',
};

const emptyBookingForm = {
  serviceId: '',
  bookingDate: '',
  slotTime: '',
  locationId: '',
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

const emptyOverrideForm = {
  serviceId: '',
  date: '',
  locationId: '',
  time: '',
  instructorName: '',
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

function padTime(value) {
  return String(value).padStart(2, '0');
}

function formatTimeLabel(timeValue) {
  const [hourValue, minuteValue] = String(timeValue).split(':').map(Number);
  const period = hourValue >= 12 ? 'PM' : 'AM';
  const normalizedHour = hourValue % 12 === 0 ? 12 : hourValue % 12;
  return `${normalizedHour}:${padTime(minuteValue)} ${period}`;
}

function generateServiceSlots(service, bookingDate, locationId) {
  if (!service?.schedule || !bookingDate) {
    return [];
  }

  const locations = Array.isArray(service.locations) ? service.locations : [];
  const selectedLocation = locations.find((location) => location.id === locationId) || locations[0];
  const instructors = Array.isArray(selectedLocation?.instructors) ? selectedLocation.instructors : [];
  const slotCount = Math.max(
    0,
    ((Number(service.schedule.endHour) - Number(service.schedule.startHour)) * 60) /
      Number(service.schedule.intervalMinutes || 60)
  );

  return Array.from({ length: slotCount }, (_, index) => {
    const totalMinutes = Number(service.schedule.startHour) * 60 + index * Number(service.schedule.intervalMinutes || 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const time = `${padTime(hours)}:${padTime(minutes)}`;
    const matchingOverride = (service.scheduleOverrides || []).find(
      (override) =>
        override.date === bookingDate &&
        override.time === time &&
        override.locationId === selectedLocation?.id
    );

    return {
      time,
      label: formatTimeLabel(time),
      defaultInstructor:
        service.bookingMode === 'self-led'
          ? ''
          : matchingOverride?.instructorName || instructors[index % Math.max(instructors.length, 1)] || '',
      instructorOptions: instructors,
    };
  }).filter((slot) => isUpcomingAppointment(buildAppointmentDate(bookingDate, slot.time)));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

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
  const [services, setServices] = useState([]);
  const [adminServices, setAdminServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [loginForm, setLoginForm] = useState(emptyLoginForm);
  const [bookingForm, setBookingForm] = useState(emptyBookingForm);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [reviewForm, setReviewForm] = useState(emptyReviewForm);
  const [overrideForm, setOverrideForm] = useState(emptyOverrideForm);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recentBooking, setRecentBooking] = useState(null);
  const [creditBookingId, setCreditBookingId] = useState('');
  const [editingServiceId, setEditingServiceId] = useState('');
  const [editingServiceForm, setEditingServiceForm] = useState(emptyServiceForm);
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    async function loadPublicData() {
      try {
        const [serviceData, reviewData] = await Promise.all([
          apiRequest('/services'),
          apiRequest('/reviews'),
        ]);
        setServices(serviceData);
        setReviews(reviewData);
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
    if (user) {
      loadBookings();
    }
  }, [user?._id]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminServices();
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
    if (user?.role === 'user') {
      setMemberPage('book');
    }
  }, [user?._id, user?.role]);

  useEffect(() => {
    if (user?.role === 'admin') {
      setAdminPage('services');
    }
  }, [user?._id, user?.role]);

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

  async function refreshPublicData() {
    const [serviceData, reviewData] = await Promise.all([
      apiRequest('/services'),
      apiRequest('/reviews'),
    ]);
    setServices(serviceData);
    setReviews(reviewData);
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

  function clearSessionState() {
    setUser(null);
    setAuthChecking(false);
    setView('login');
    setMemberPage('book');
    setAdminPage('services');
    setBookings([]);
    setRecentBooking(null);
    setCreditBookingId('');
    setEditingServiceId('');
    setEditingServiceForm(emptyServiceForm);
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
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout transport errors and still clear the local app state.
    }

    clearSessionState();
    setMessage('');
    setError('');
  }

  function updateForm(setter) {
    return (event) => {
      const { name, value } = event.target;
      setter((current) => ({ ...current, [name]: value }));
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

      setUser(data.user);
      setRegisterForm(emptyRegisterForm);
      setView('app');
      setMessage(`Your account is ready. Your membership number is ${data.user.membershipNumber}.`);
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

      setUser(data.user);
      setLoginForm(emptyLoginForm);
      setView('app');
      setMessage(
        data.user.role === 'admin'
          ? 'Admin signed in. Studio operations are ready.'
          : 'Welcome back. Your booking dashboard is ready.'
      );
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();
    setBookingLoading(true);
    setMessage('');
    setError('');

    try {
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
            paymentCardNumber: bookingForm.paymentCardNumber,
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
      setMessage('Profile updated successfully.');
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
      await refreshPublicData();
    } catch (serviceError) {
      if (!handleSessionError(serviceError)) {
        setError(serviceError.message);
      }
    } finally {
      setServiceLoading(false);
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
  const selectedBookingService = services.find((service) => service._id === bookingForm.serviceId) || services[0] || null;
  const selectedBookingLocation =
    selectedBookingService?.locations?.find((location) => location.id === bookingForm.locationId) ||
    selectedBookingService?.locations?.[0] ||
    null;
  const availableBookingSlots = selectedBookingService
    ? generateServiceSlots(selectedBookingService, bookingForm.bookingDate, selectedBookingLocation?.id)
    : [];
  const selectedBookingSlot = availableBookingSlots.find((slot) => slot.time === bookingForm.slotTime) || null;
  const bookingInstructorOptions =
    selectedBookingService?.bookingMode === 'self-led'
      ? []
      : selectedBookingSlot?.instructorOptions || selectedBookingLocation?.instructors || [];
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
  const overrideSlots = selectedOverrideService
    ? generateServiceSlots(selectedOverrideService, overrideForm.date, selectedOverrideLocation?.id)
    : [];
  const selectedOverrideSlot = overrideSlots.find((slot) => slot.time === overrideForm.time) || null;
  const overrideInstructorOptions = selectedOverrideSlot?.instructorOptions || selectedOverrideLocation?.instructors || [];
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
  const serviceRatingsById = buildServiceRatingMap(reviews);
  const locationCount = new Set(
    services.flatMap((service) => (service.locations || []).map((location) => location.id || location.name))
  ).size;
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
  const memberPages = [
    { id: 'book', label: 'Book' },
    { id: 'schedule', label: 'My Schedule' },
    { id: 'profile', label: 'Profile' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'about', label: 'About Us' },
  ];
  const adminPages = [
    { id: 'services', label: 'Services' },
    { id: 'instructors', label: 'Instructors' },
    { id: 'schedule', label: 'Schedule' },
  ];
  const activeNotice = error
    ? { type: 'error', title: 'Something went wrong', text: error }
    : message
      ? { type: 'success', title: 'Done', text: message }
      : null;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [showAuth]);

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
    <div className={`app-shell${!showAuth && isAdmin ? ' admin-shell' : ''}`}>
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
              <div className="demo-credentials">
                <p className="demo-note">
                  Demo admin login: <strong>admin@wellness.local</strong> with password <strong>admin123</strong>
                </p>
                <p className="demo-note">
                  Demo member login: <strong>vitoria.test@example.com</strong> or membership <strong>MEM-1001</strong> with password <strong>test1234</strong>
                </p>
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
        </>
      )}

      {activeNotice ? (
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
                className={view === 'login' ? 'tab-button active' : 'tab-button'}
                onClick={() => setView('login')}
              >
                Log In
              </button>
              <button
                type="button"
                className={view === 'register' ? 'tab-button active' : 'tab-button'}
                onClick={() => setView('register')}
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
              </form>
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

                  <section className="panel panel-emphasis bookings-panel">
                    <div className="panel-heading">
                      <p className="panel-kicker">Operations</p>
                      <h2>Admin Controls</h2>
                    </div>
                    <p className="section-copy">Create new services up top, then edit or deactivate each existing service inline below.</p>
                    <div className="admin-summary">
                      <div className="summary-card">
                        <strong>{activeAdminBookings.length}</strong>
                        <span>Booked</span>
                      </div>
                      <div className="summary-card">
                        <strong>{todayAdminBookings.length}</strong>
                        <span>Today</span>
                      </div>
                      <div className="summary-card">
                        <strong>{cancelledAdminBookings.length}</strong>
                        <span>Cancelled</span>
                      </div>
                    </div>
                    <div className="member-stack admin-stack">
                      <div>
                        <h2>Create a New Service</h2>
                        <p className="section-copy">Add a fresh service to the booking menu with its duration, price, and capacity.</p>
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
                      </div>

                      <div>
                        <h2>Service Catalog</h2>
                        <p className="section-copy">Use each card below to edit pricing, capacity, descriptions, or active status without leaving the list.</p>
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
                              </div>
                            </article>
                          )})}
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              ) : null}

              {adminPage === 'instructors' ? (
                <section className="panel panel-emphasis">
                  <div className="panel-heading">
                    <p className="panel-kicker">Instructor Schedule</p>
                    <h2>Instructor Overrides</h2>
                  </div>
                  <p className="section-copy">Assign a one-time instructor change for a specific class time and location.</p>
                  <div className="booking-insight-row">
                    <article className="booking-helper-card booking-helper-card-compact">
                      <strong>Selected service</strong>
                      <span>{selectedOverrideService?.name || 'Choose a service'}</span>
                    </article>
                    <article className="booking-helper-card booking-helper-card-compact">
                      <strong>Location team</strong>
                      <span>
                        {selectedOverrideLocation
                          ? `${selectedOverrideLocation.name} · ${selectedOverrideLocation.instructors.length || 0} instructors`
                          : 'Choose a location to see your instructor pool.'}
                      </span>
                    </article>
                  </div>
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
                </section>
              ) : null}

              {adminPage === 'schedule' ? (
                <section className="panel panel-emphasis">
                  <div className="panel-heading">
                    <p className="panel-kicker">Schedule</p>
                    <h2>Attendance & Session Overview</h2>
                  </div>
                  <p className="section-copy">Track what is booked today, confirm attendance after class time, and watch for no-shows or cancellations.</p>
                  <div className="admin-summary">
                    <div className="summary-card">
                      <strong>{todayAdminBookings.length}</strong>
                      <span>Today</span>
                    </div>
                    <div className="summary-card">
                      <strong>{attendedAdminBookings.length}</strong>
                      <span>Attended</span>
                    </div>
                    <div className="summary-card">
                      <strong>{noShowAdminBookings.length}</strong>
                      <span>No-shows</span>
                    </div>
                  </div>
                </section>
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
                                    instructorName: '',
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
                                  const nextSlot = availableBookingSlots.find((slot) => slot.time === event.target.value);
                                  setBookingForm((current) => ({
                                    ...current,
                                    slotTime: event.target.value,
                                    instructorName:
                                      selectedBookingService?.bookingMode === 'self-led'
                                        ? ''
                                        : nextSlot?.defaultInstructor || '',
                                  }));
                                }}
                                required
                                disabled={!bookingForm.bookingDate}
                              >
                                <option value="">{bookingForm.bookingDate ? 'Select a class time' : 'Choose a date first'}</option>
                                {availableBookingSlots.map((slot) => (
                                  <option key={slot.time} value={slot.time}>
                                    {slot.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          {selectedBookingService?.bookingMode === 'instructor-led' ? (
                            <div className="form-grid-two">
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
                              <div className="booking-helper-card booking-helper-card-compact">
                                <strong>Selected instructor</strong>
                                <span>{bookingForm.instructorName || 'An instructor will appear once you choose a class time.'}</span>
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
                                    placeholder="4242 4242 4242 4242"
                                    required
                                  />
                                </label>
                              </div>
                              <p className="form-note">Demo checkout only. We save the amount and last 4 digits, not the full card number.</p>
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

          {!isAdmin || adminPage === 'schedule' ? (
            <section className="panel bookings-panel">
              <div className="bookings-header">
                <div>
                  <p className="panel-kicker">{isAdmin ? 'Studio Calendar' : 'Social Proof'}</p>
                  <h2>{isAdmin ? 'Upcoming Class Schedule' : 'Recent Reviews'}</h2>
                  <p className="section-copy">
                    {isAdmin
                      ? 'See who is booked into each session, how many spots are left, and mark attendance once the class time has passed.'
                      : 'Member feedback helps show what the wellness center is doing well.'}
                  </p>
                </div>
                {isAdmin ? (
                  <button type="button" className="secondary-button" onClick={loadBookings}>
                    Refresh
                  </button>
                ) : null}
              </div>

              {isAdmin ? (
                <>
                  {loadingBookings ? (
                    <p>Loading bookings...</p>
                  ) : (
                    <div className="member-stack schedule-stack">
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
