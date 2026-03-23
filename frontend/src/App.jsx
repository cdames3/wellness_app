import { useEffect, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
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
  appointmentDate: '',
  notes: '',
};

const emptyProfileForm = {
  name: '',
  membershipNumber: '',
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
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
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
        if (serviceData.length > 0) {
          setBookingForm((current) => ({ ...current, serviceId: serviceData[0]._id }));
        }
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
        membershipNumber: user.membershipNumber || '',
      });
    }
  }, [user]);

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
          body: JSON.stringify(bookingForm),
        },
        token
      );

      setBookingForm((current) => ({
        ...emptyBookingForm,
        serviceId: current.serviceId,
      }));
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
      const data = await apiRequest(
        '/auth/me',
        {
          method: 'PATCH',
          body: JSON.stringify(profileForm),
        },
        token
      );

      setUser(data.user);
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

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-topline">
          <p className="eyebrow">Wellness Center MVP</p>
          {user ? (
            <button type="button" className="secondary-button" onClick={handleLogout}>
              Log out
            </button>
          ) : null}
        </div>
        <h1>Book wellness services with member and admin accounts.</h1>
        <p className="hero-copy">
          This version includes sign up, sign in, member booking requests, admin approvals, and reviews.
        </p>
        {!user ? (
          <p className="demo-note">
            Demo admin login: <strong>admin@wellness.local</strong> with password <strong>admin123</strong>
          </p>
        ) : (
          <p className="demo-note">
            Signed in as <strong>{user.name}</strong> ({user.role}) with membership{' '}
            <strong>{user.membershipNumber}</strong>.
          </p>
        )}
      </header>

      {message ? <p className="success-message banner-message">{message}</p> : null}
      {error ? <p className="error-message banner-message">{error}</p> : null}

      {showAuth ? (
        <main className="grid auth-grid">
          <section className="panel">
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
            <h2>What works now</h2>
            <div className="service-list">
              <article className="service-card">
                <h3>Members</h3>
                <p>Create an account, browse services, request appointments, track history, and leave reviews.</p>
              </article>
              <article className="service-card">
                <h3>Admins</h3>
                <p>Sign in with the demo admin account to review bookings and manage the services catalog.</p>
              </article>
              <article className="service-card">
                <h3>Reviews</h3>
                <p>Members can review completed services, and everyone can read recent feedback.</p>
              </article>
            </div>
          </section>
        </main>
      ) : (
        <main className="grid">
          <section className="panel">
            <h2>Available Services</h2>
            <p className="section-copy">Pick the service and time that fit your wellness plan.</p>

            {loadingServices ? (
              <p>Loading services...</p>
            ) : (
              <div className="service-list">
                {services.map((service) => (
                  <article key={service._id} className="service-card">
                    <div className="service-card-header">
                      <h3>{service.name}</h3>
                      <span>{service.category}</span>
                    </div>
                    <p>{service.description}</p>
                    <div className="service-meta">
                      <strong>{service.durationMinutes} minutes</strong>
                      <span>{service.capacity} spots per slot</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            {user.role === 'admin' ? (
              <>
                <h2>Admin Controls</h2>
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
                </div>
              </>
            ) : (
              <div className="member-stack">
                <div>
                  <h2>My Profile</h2>
                  <p className="section-copy">Keep your member details current before making a booking request.</p>
                  <form className="booking-form" onSubmit={handleProfileSubmit}>
                    <label>
                      Full name
                      <input name="name" value={profileForm.name} onChange={updateForm(setProfileForm)} required />
                    </label>
                    <label>
                      Email
                      <input value={user.email} disabled readOnly />
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
                    <button type="submit" disabled={profileLoading}>
                      {profileLoading ? 'Saving...' : 'Save profile'}
                    </button>
                  </form>
                </div>

                <div>
                  <h2>Request a Booking</h2>
                  <p className="section-copy">Your account details are used automatically, so you only need to pick a service and time.</p>
                  <form className="booking-form" onSubmit={handleBookingSubmit}>
                    <label>
                      Service
                      <select name="serviceId" value={bookingForm.serviceId} onChange={updateForm(setBookingForm)} required>
                        {services.map((service) => (
                          <option key={service._id} value={service._id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Appointment date and time
                      <input
                        name="appointmentDate"
                        type="datetime-local"
                        value={bookingForm.appointmentDate}
                        onChange={updateForm(setBookingForm)}
                        required
                      />
                    </label>
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
                      {bookingLoading ? 'Submitting...' : 'Submit booking request'}
                    </button>
                  </form>
                </div>

                <div>
                  <h2>Leave a Review</h2>
                  <p className="section-copy">Completed appointments can be rated and commented on here.</p>
                  <form className="booking-form" onSubmit={handleReviewSubmit}>
                    <label>
                      Completed booking
                      <select name="bookingId" value={reviewForm.bookingId} onChange={updateForm(setReviewForm)} required>
                        <option value="">Select a past booking</option>
                        {pastBookings
                          .filter((booking) => !reviewLookup.has(String(booking._id)))
                          .map((booking) => (
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
                    <button type="submit" disabled={reviewLoading}>
                      {reviewLoading ? 'Saving review...' : 'Submit review'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </section>

          <section className="panel bookings-panel">
            <div className="bookings-header">
              <div>
                <h2>{user.role === 'admin' ? 'All Booking Requests' : 'Booking History'}</h2>
                <p className="section-copy">
                  {user.role === 'admin' ? 'Approve or reject requests below.' : 'See your upcoming and past appointments separately.'}
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={loadBookings}>
                Refresh
              </button>
            </div>

            {loadingBookings ? (
              <p>Loading bookings...</p>
            ) : user.role === 'admin' ? (
              bookings.length === 0 ? (
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
              )
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
                          <p>{reviewLookup.has(String(booking._id)) ? 'Review submitted' : 'Ready for review'}</p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="panel bookings-panel">
            <h2>Recent Reviews</h2>
            <p className="section-copy">Member feedback helps show what the wellness center is doing well.</p>
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
        </main>
      )}
    </div>
  );
}
