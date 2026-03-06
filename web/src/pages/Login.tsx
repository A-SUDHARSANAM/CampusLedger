import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import type { Role } from '../types/auth';
import { ROLE_HOME_ROUTE } from '../routes/routeConfig';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin',        label: 'Administrator'  },
  { value: 'lab',          label: 'Lab Incharge/Professor' },
  { value: 'service',      label: 'Service Staff'  },
  { value: 'purchase_dept',label: 'Vendor'         },
];

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Sign-in fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Register-only fields
  const [fullName, setFullName]   = useState('');
  const [deptName, setDeptName]   = useState('');
  const [regEmail, setRegEmail]   = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole]     = useState<Role>('lab');

  const [showPassword, setShowPassword]       = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');
  const [submitted, setSubmitted] = useState(false);

  const switchTab = (toRegister: boolean) => {
    setIsRegister(toRegister);
    setError('');
    setSubmitted(false);
    setRegisterSuccess(false);
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setError('');

    if (!fullName.trim())       { setError('Full name is required.');            return; }
    if (!deptName.trim())       { setError('Department name is required.');       return; }
    if (!regEmail.trim())       { setError('Email is required.');                return; }
    if (!regPassword.trim())    { setError('Password is required.');             return; }
    if (regPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setIsLoading(true);
    try {
      await api.register(regEmail, regPassword, fullName, regRole, deptName);
      // Clear fields and redirect to login tab with success message
      setFullName(''); setDeptName(''); setRegEmail(''); setRegPassword('');
      setRegRole('lab');
      setRegisterSuccess(true);
      setIsRegister(false);
      setSubmitted(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setError('');

    if (!email.trim() || !password.trim()) { setError('Please enter email and password.'); return; }

    setIsLoading(true);
    try {
      const user = await login(email, password);
      navigate(ROLE_HOME_ROUTE[user.role], { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <div className="brand">
          <div className="brand-badge">
            <GraduationCap size={36} />
          </div>
          <h1>CampusLedger</h1>
          <p>Asset &amp; Inventory Management System</p>
        </div>

        <div className="auth-tabs">
          <button className={`btn secondary-btn tab-btn ${!isRegister ? 'active' : ''}`} onClick={() => switchTab(false)} type="button">
            Sign In
          </button>
          <button className={`btn secondary-btn tab-btn ${isRegister ? 'active' : ''}`} onClick={() => switchTab(true)} type="button">
            Register
          </button>
        </div>

        <div className="auth-card">
          {/* ── REGISTER FORM ── */}
          {isRegister ? (
            <>
              <h2>Create Account</h2>
              <p className="auth-subtitle">Fill in your details to register</p>

              <form onSubmit={handleRegister}>
                <div className="form-field">
                  <label className="label" htmlFor="fullName">Full Name</label>
                  <input
                    className={`input ${submitted && !fullName.trim() ? 'input-error' : ''}`}
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                  />
                </div>

                <div className="form-field">
                  <label className="label" htmlFor="regRole">Role</label>
                  <select
                    className="input"
                    id="regRole"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as Role)}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="label" htmlFor="deptName">Department Name</label>
                  <input
                    className={`input ${submitted && !deptName.trim() ? 'input-error' : ''}`}
                    id="deptName"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Computer Science"
                  />
                </div>

                <div className="form-field">
                  <label className="label" htmlFor="regEmail">Email</label>
                  <input
                    className={`input ${submitted && !regEmail.trim() ? 'input-error' : ''}`}
                    id="regEmail"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>

                <div className="form-field">
                  <label className="label" htmlFor="regPassword">Password</label>
                  <div className="password-wrap">
                    <input
                      className={`input ${submitted && !regPassword.trim() ? 'input-error' : ''}`}
                      id="regPassword"
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create a password (min 6 chars)"
                      autoComplete="new-password"
                    />
                    <button className="password-toggle" type="button" aria-label={showRegPassword ? 'Hide password' : 'Show password'} onClick={() => setShowRegPassword((v) => !v)}>
                      {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button className="btn primary-btn" disabled={isLoading} type="submit">
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>

                {error ? <p className="error-text">{error}</p> : null}
              </form>
            </>
          ) : (
            /* ── SIGN-IN FORM ── */
            <>
              <h2>Sign In</h2>
              <p className="auth-subtitle">Enter your credentials to access the dashboard</p>

              {registerSuccess ? (
                <div className="success-banner">
                  Account created successfully! Please sign in below.
                </div>
              ) : null}

              <form onSubmit={handleLogin}>
                <div className="form-field">
                  <label className="label" htmlFor="email">Email</label>
                  <input
                    className={`input ${submitted && !email.trim() ? 'input-error' : ''}`}
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="label" htmlFor="password">Password</label>
                  <div className="password-wrap">
                    <input
                      className={`input ${submitted && !password.trim() ? 'input-error' : ''}`}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button className="btn primary-btn" disabled={isLoading} type="submit">
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>

                {error ? <p className="error-text">{error}</p> : null}
              </form>
            </>
          )}
        </div>

        <p className="auth-footer">(c) 2026 CampusLedger - Smart Campus Asset Management</p>
      </div>
    </div>
  );
}
