import { useEffect, useState } from 'react';
import coverPicture from './assets/cover-picture.jpg';
import gymImage from './assets/gym.jpg';
import massageImage from './assets/massage.jpg';
import pilatesImage from './assets/pilates.jpg';
import spaImage from './assets/sauna-spa.jpg';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const sessionStorageKey = 'wellness-session';

const emptyRegisterForm = {
  name: '',
  email: '',
  password: '',
  membershipNumber: '',
};

const emptyLoginForm = {
  email: '',
  password: '',
};

const emptyBookingForm = {
  serviceId: '',
  bookingDate: '',
  slotTime: '',
  locationId: '',
  instructorName: '',
  notes: '',
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

function getStoredSession() {
  const rawValue = window.localStorage.getItem(sessionStorageKey);
  if (!rawValue) {
    return { token: '', user: null };
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return { token: '', user: null };
  }
}

function formatBookingDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
  });
}

async function apiRequest(path, options = {}, token = '') {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong.');
  }

  return data;
}

export default function App() {
  const initialSession = getStoredSession();
  const [view, setView] = useState(initialSession.user ? 'app' : 'login');
  const [token, setToken] = useState(initialSession.token || '');
  const [user, setUser] = useState(initialSession.user || null);
  const [memberPage, setMemberPage] = useState('book');
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
    if (!token) {
      setBookings([]);
      return;
    }

    window.localStorage.setItem(sessionStorageKey, JSON.stringify({ token, user }));
  }, [token, user]);

  useEffect(() => {
    async function restoreSession() {
      if (!token) {
        return;
      }

      try {
        const data = await apiRequest('/auth/me', {}, token);
        setUser(data.user);
        setView('app');
      } catch {
        handleLogout();
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    if (token) {
      loadBookings();
    }
  }, [token]);

  useEffect(() => {
    if (token && user?.role === 'admin') {
      loadAdminServices();
    }
  }, [token, user]);

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

  async function refreshPublicData() {
    const [serviceData, reviewData] = await Promise.all([
      apiRequest('/services'),
      apiRequest('/reviews'),
    ]);
    setServices(serviceData);
    setReviews(reviewData);
  }

  async function loadBookings() {
    if (!token) {
      return;
    }

    setLoadingBookings(true);
    try {
      const data = await apiRequest('/bookings', {}, token);
      setBookings(data);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingBookings(false);
    }
  }

  async function loadAdminServices() {
    if (!token || user?.role !== 'admin') {
      return;
    }

    try {
      const data = await apiRequest('/admin/services', {}, token);
      setAdminServices(data);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  function handleLogout() {
    setToken('');
    setUser(null);
    setMemberPage('book');
    setBookings([]);
    setMessage('');
    setError('');
    window.localStorage.removeItem(sessionStorageKey);
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

      setToken(data.token);
      setUser(data.user);
      setRegisterForm(emptyRegisterForm);
      setView('app');
      setMessage('Your account is ready. You are now signed in as a member.');
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

      setToken(data.token);
      setUser(data.user);
      setLoginForm(emptyLoginForm);
      setView('app');
      setMessage(
        data.user.role === 'admin'
          ? 'Admin signed in. You can now review booking requests.'
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
      await apiRequest(
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
          }),
        },
        token
      );

      setBookingForm((current) => {
        const selectedService = services.find((service) => service._id === current.serviceId);
        return {
          ...emptyBookingForm,
          serviceId: current.serviceId,
          locationId: selectedService?.locations?.[0]?.id || current.locationId,
        };
      });
      await loadBookings();
      setMessage('Booking request submitted. It will stay Pending until an admin reviews it.');
    } catch (bookingError) {
      setError(bookingError.message);
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
            membershipNumber: profileForm.membershipNumber,
            currentPassword: profileForm.currentPassword,
            newPassword: profileForm.newPassword,
          }),
        },
        token
      );

      setUser(data.user);
      setProfileForm((current) => ({
        ...current,
        email: data.user.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setMessage('Profile updated successfully.');
    } catch (profileError) {
      setError(profileError.message);
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleStatusChange(bookingId, status) {
    setMessage('');
    setError('');

    try {
      await apiRequest(
        `/admin/requests/${bookingId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
        token
      );

      await loadBookings();
      setMessage(`Booking marked as ${status}.`);
    } catch (statusError) {
      setError(statusError.message);
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
        },
        token
      );

      await loadBookings();
      setMessage('Booking cancelled.');
    } catch (cancelError) {
      setError(cancelError.message);
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
        active: serviceForm.active,
      };

      if (serviceForm.id) {
        await apiRequest(
          `/admin/services/${serviceForm.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          },
          token
        );
        setMessage('Service updated.');
      } else {
        await apiRequest(
          '/admin/services',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
          token
        );
        setMessage('Service created.');
      }

      setServiceForm(emptyServiceForm);
      await loadAdminServices();
      await refreshPublicData();
    } catch (serviceError) {
      setError(serviceError.message);
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
        },
        token
      );

      setReviewForm(emptyReviewForm);
      await refreshPublicData();
      setMessage('Review submitted. Thank you for the feedback.');
    } catch (reviewError) {
      setError(reviewError.message);
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
        },
        token
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
      setError(overrideError.message);
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
        },
        token
      );

      await loadAdminServices();
      await refreshPublicData();
      setMessage('Instructor override removed.');
    } catch (removeError) {
      setError(removeError.message);
    }
  }

  function startEditingService(service) {
    setServiceForm({
      id: service._id,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      category: service.category,
      capacity: service.capacity,
      active: Boolean(service.active),
    });
  }

  async function handleDeactivateService(serviceId) {
    setMessage('');
    setError('');

    try {
      await apiRequest(
        `/admin/services/${serviceId}/deactivate`,
        {
          method: 'PATCH',
        },
        token
      );
      setMessage('Service deactivated.');
      await loadAdminServices();
      await refreshPublicData();
    } catch (deactivateError) {
      setError(deactivateError.message);
    }
  }

  const showAuth = !user || view !== 'app';
  const now = new Date();
  const upcomingBookings = bookings.filter((booking) => new Date(booking.appointmentDate) >= now);
  const pastBookings = bookings.filter((booking) => new Date(booking.appointmentDate) < now);
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
  const heroStats = [
    { label: 'Services', value: services.length || '04' },
    { label: 'Reviews', value: reviews.length || '00' },
    { label: isAdmin ? 'Requests' : 'Upcoming', value: isAdmin ? bookings.length : upcomingBookings.length },
  ];
  const memberPages = [
    { id: 'book', label: 'Book' },
    { id: 'schedule', label: 'My Schedule' },
    { id: 'profile', label: 'Profile' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'about', label: 'About Us' },
  ];

  return (
    <div className="app-shell">
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
                staff, approvals, schedules, and reviews.
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
                  Demo member login: <strong>vitoria.test@example.com</strong> with password <strong>test1234</strong>
                </p>
              </div>
            </div>

            <aside className="hero-aside editorial-mosaic">
              <div className="mosaic-large">
                <img src={coverPicture} alt="Wellness hero" />
              </div>
              <div className="mosaic-insight">
                <p className="hero-aside-label">Studio Snapshot</p>
                <div className="hero-stat-grid">
                  {heroStats.map((stat) => (
                    <div key={stat.label} className="hero-stat-card">
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
                <p className="hero-aside-note">
                  A modern member experience with role-based flows, service management, and review tracking.
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
        </>
      )}

      {message ? <p className="success-message banner-message">{message}</p> : null}
      {error ? <p className="error-message banner-message">{error}</p> : null}

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
                <label>
                  Membership number
                  <input
                    name="membershipNumber"
                    value={registerForm.membershipNumber}
                    onChange={updateForm(setRegisterForm)}
                    required
                  />
                </label>
                <button type="submit" disabled={authLoading}>
                  {authLoading ? 'Creating account...' : 'Create account'}
                </button>
              </form>
            ) : (
              <form className="booking-form" onSubmit={handleLogin}>
                <h2>Sign In</h2>
                <label>
                  Email
                  <input name="email" type="email" value={loginForm.email} onChange={updateForm(setLoginForm)} required />
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
                <p>Create an account, browse services, request appointments, track your calendar, and leave reviews after completed visits.</p>
              </article>
              <article className="feature-card">
                <h3>Admins</h3>
                <p>Review booking requests, approve schedules, and manage the live service menu from one calmer dashboard.</p>
              </article>
              <article className="feature-card">
                <h3>Reviews</h3>
                <p>Members can share completed-service feedback, and the public experience stays grounded in recent reviews.</p>
              </article>
            </div>
            <div className="editorial-strip">
              {services.slice(0, 3).map((service) => {
                const presentation = getServicePresentation(service);
                return (
                  <article key={service._id} className="editorial-card">
                    <div className="editorial-visual">
                      <img src={presentation.image || coverPicture} alt={service.name} />
                    </div>
                    <div className="editorial-copy">
                      <p>{presentation.eyebrow}</p>
                      <h3>{service.name}</h3>
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
              <section className="panel">
                <div className="panel-heading">
                  <p className="panel-kicker">Service Menu</p>
                  <h2>Available Services</h2>
                </div>
                <p className="section-copy">Pick the service and time that fit your wellness plan.</p>

                {loadingServices ? (
                  <p>Loading services...</p>
                ) : (
                  <div className="service-gallery">
                    {services.map((service) => (
                      (() => {
                        const presentation = getServicePresentation(service);
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
                                <strong>{service.durationMinutes} min</strong>
                              </div>
                              <p>{presentation.blurb}</p>
                              <div className="service-meta">
                                <span>{service.capacity} spots per slot</span>
                                <span>Booking approval included</span>
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
                <div className="panel-heading">
                  <p className="panel-kicker">Operations</p>
                  <h2>Admin Controls</h2>
                </div>
                <p className="section-copy">Review pending requests and keep the schedule moving.</p>
                <div className="admin-summary">
                  <div className="summary-card">
                    <strong>{bookings.filter((booking) => booking.status === 'Pending').length}</strong>
                    <span>Pending</span>
                  </div>
                  <div className="summary-card">
                    <strong>{bookings.filter((booking) => booking.status === 'Approved').length}</strong>
                    <span>Approved</span>
                  </div>
                  <div className="summary-card">
                    <strong>{bookings.filter((booking) => booking.status === 'Rejected').length}</strong>
                    <span>Rejected</span>
                  </div>
                </div>
                <div className="member-stack admin-stack">
                  <div>
                    <h2>Manage Services</h2>
                    <p className="section-copy">Create new offerings or update the existing ones.</p>
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
                          {serviceLoading ? 'Saving...' : serviceForm.id ? 'Update service' : 'Create service'}
                        </button>
                        {serviceForm.id ? (
                          <button type="button" className="secondary-button" onClick={() => setServiceForm(emptyServiceForm)}>
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </form>
                  </div>

                  <div>
                    <h2>Service Catalog</h2>
                    <p className="section-copy">Edit details or deactivate services that should no longer be booked.</p>
                    <div className="service-list">
                      {adminServices.map((service) => (
                        <article key={service._id} className="service-card">
                          <div className="service-card-header">
                            <h3>{service.name}</h3>
                            <span>{service.active ? 'Active' : 'Inactive'}</span>
                          </div>
                          <p>{service.description}</p>
                          <div className="service-meta">
                            <strong>{service.durationMinutes} minutes</strong>
                            <span>{service.capacity} spots</span>
                          </div>
                          <div className="admin-actions">
                            <button type="button" onClick={() => startEditingService(service)}>
                              Edit
                            </button>
                            {service.active ? (
                              <button type="button" className="danger-button" onClick={() => handleDeactivateService(service._id)}>
                                Deactivate
                              </button>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2>Instructor Schedule</h2>
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
                  </div>
                </div>
              </section>
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
                    <p className="section-copy">Choose the experience that fits your week, then send your preferred time.</p>

                    {loadingServices ? (
                      <p>Loading services...</p>
                    ) : (
                      <div className="service-gallery">
                        {services.map((service) => (
                          (() => {
                            const presentation = getServicePresentation(service);
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
                                    <strong>{service.durationMinutes} min</strong>
                                  </div>
                                  <p>{presentation.blurb}</p>
                                  <div className="service-meta">
                                    <span>{service.capacity} spots per slot</span>
                                    <span>Booking approval included</span>
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
                      <button type="submit" disabled={bookingLoading || loadingServices}>
                        {bookingLoading ? 'Submitting...' : 'Book this class'}
                      </button>
                    </form>
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
                                  <span className={`status-pill status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                                </div>
                                <p>{formatBookingDate(booking.appointmentDate)}</p>
                                <p><strong>Location:</strong> {booking.locationName}</p>
                                {booking.instructorName ? <p><strong>Instructor:</strong> {booking.instructorName}</p> : null}
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
                                  <span className={`status-pill status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                                </div>
                                <p>{formatBookingDate(booking.appointmentDate)}</p>
                                <p><strong>Location:</strong> {booking.locationName}</p>
                                {booking.instructorName ? <p><strong>Instructor:</strong> {booking.instructorName}</p> : null}
                                <p>{reviewLookup.has(String(booking._id)) ? 'Review submitted' : 'Ready for review'}</p>
                              </article>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
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
                          Membership number
                          <input
                            name="membershipNumber"
                            value={profileForm.membershipNumber}
                            onChange={updateForm(setProfileForm)}
                            required
                          />
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
                      Wellness Center Studio brings classes, massage, spa services, and gym access into one clean booking experience. Members can manage their time, staff can manage approvals, and reviews help the studio keep improving.
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
                        <p>Profiles, booking history, approvals, and reviews all live in one organized place.</p>
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
                        return (
                          <article key={service._id} className="editorial-card">
                            <div className="editorial-visual">
                              <img src={presentation.image || coverPicture} alt={service.name} />
                            </div>
                            <div className="editorial-copy">
                              <p>{presentation.eyebrow}</p>
                              <h3>{service.name}</h3>
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

          <section className="panel bookings-panel">
            <div className="bookings-header">
              <div>
                <p className="panel-kicker">{isAdmin ? 'Timeline' : 'Social Proof'}</p>
                <h2>{isAdmin ? 'All Booking Requests' : 'Recent Reviews'}</h2>
                <p className="section-copy">
                  {isAdmin ? 'Approve or reject requests below.' : 'Member feedback helps show what the wellness center is doing well.'}
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
                ) : bookings.length === 0 ? (
                  <p>No bookings found yet.</p>
                ) : (
                  <div className="booking-list">
                    {bookings.map((booking) => (
                      <article key={booking._id} className="booking-card">
                        <div className="booking-topline">
                          <h3>{booking.service?.name || 'Service unavailable'}</h3>
                          <span className={`status-pill status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                        </div>
                        <p>{formatBookingDate(booking.appointmentDate)}</p>
                        <p><strong>Location:</strong> {booking.locationName}</p>
                        {booking.instructorName ? <p><strong>Instructor:</strong> {booking.instructorName}</p> : null}
                        <p><strong>Member:</strong> {booking.clientName}</p>
                        <p><strong>Email:</strong> {booking.email}</p>
                        {booking.notes ? <p><strong>Notes:</strong> {booking.notes}</p> : null}
                        <div className="admin-actions">
                          <button type="button" onClick={() => handleStatusChange(booking._id, 'Approved')}>Approve</button>
                          <button type="button" className="danger-button" onClick={() => handleStatusChange(booking._id, 'Rejected')}>
                            Reject
                          </button>
                        </div>
                      </article>
                    ))}
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
        </main>
      )}
    </div>
  );
}
