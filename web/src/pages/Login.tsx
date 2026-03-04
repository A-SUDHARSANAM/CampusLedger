import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, Eye, EyeOff, FlaskConical, GraduationCap, Shield, Wrench } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types/auth';
import { ROLE_HOME_ROUTE } from '../routes/routeConfig';

const ROLE_OPTIONS: {
  id: Role;
  title: string;
  icon: React.ReactNode;
  pillClass: string;
  demoEmail: string;
  demoPassword: string;
}[] = [
  {
    id: 'admin',
    title: 'Administrator',
    icon: <Shield size={18} />,
    pillClass: 'admin',
    demoEmail: 'admin@campus.edu',
    demoPassword: 'admin123'
  },
  {
    id: 'lab',
    title: 'Lab Incharge',
    icon: <FlaskConical size={18} />,
    pillClass: 'lab',
    demoEmail: 'lab@campus.edu',
    demoPassword: 'lab123'
  },
  {
    id: 'service',
    title: 'Service Staff',
    icon: <Wrench size={18} />,
    pillClass: 'service',
    demoEmail: 'service@campus.edu',
    demoPassword: 'service123'
  },
  {
    id: 'vendor',
    title: 'Vendor',
    icon: <BriefcaseBusiness size={18} />,
    pillClass: 'vendor',
    demoEmail: 'vendor@campus.edu',
    demoPassword: 'vendor123'
  }
];

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const setRoleWithDemoCreds = (role: Role) => {
    const roleMeta = ROLE_OPTIONS.find((option) => option.id === role);
    setSelectedRole(role);
    if (!isRegister && roleMeta) {
      setEmail(roleMeta.demoEmail);
      setPassword(roleMeta.demoPassword);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setError('');
    setIsLoading(true);

    try {
      if (isRegister) {
        if (!fullName.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (!email.trim() || !password.trim()) {
          throw new Error('Please complete all fields.');
        }
      }

      const user = await login(email, password, selectedRole);
      navigate(ROLE_HOME_ROUTE[user.role], { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please try again.');
      }
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
          <button className={`btn secondary-btn tab-btn ${!isRegister ? 'active' : ''}`} onClick={() => setIsRegister(false)} type="button">
            Sign In
          </button>
          <button className={`btn secondary-btn tab-btn ${isRegister ? 'active' : ''}`} onClick={() => setIsRegister(true)} type="button">
            Register
          </button>
        </div>

        <div className="auth-card">
          <h2>{isRegister ? 'Create Account' : 'Sign In'}</h2>
          <p className="auth-subtitle">
            {isRegister ? 'Register a new account to get started' : 'Enter your credentials to access the dashboard'}
          </p>

          <form onSubmit={handleSubmit}>
            {isRegister ? (
              <div className="form-field">
                <label className="label" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  className={`input ${submitted && !fullName.trim() ? 'input-error' : ''}`}
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                />
                {submitted && !fullName.trim() ? <p className="field-error-text">Full name is required.</p> : null}
              </div>
            ) : (
              <p className="quick-label">Quick login as:</p>
            )}

            <div className="role-grid role-grid-four">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.id}
                  className={`role-btn ${selectedRole === role.id ? 'active' : ''}`}
                  onClick={() => setRoleWithDemoCreds(role.id)}
                  type="button"
                >
                  <span className={`role-pill ${role.pillClass}`}>{role.icon}</span>
                  <span>{role.title}</span>
                </button>
              ))}
            </div>

            <div className="form-field">
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                className={`input ${submitted && !email.trim() ? 'input-error' : ''}`}
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
              {submitted && !email.trim() ? <p className="field-error-text">Email is required.</p> : null}
            </div>

            <div className="form-field">
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="password-wrap">
                <input
                  className={`input ${submitted && !password.trim() ? 'input-error' : ''}`}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRegister ? 'Create a password' : 'Enter your password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {submitted && !password.trim() ? <p className="field-error-text">Password is required.</p> : null}
            </div>

            <button className="btn primary-btn" disabled={isLoading} type="submit">
              {isLoading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>

            {error ? <p className="error-text">{error}</p> : null}
          </form>

          {!isRegister ? (
            <div className="demo-box">
              <div>Demo Credentials:</div>
              <div>Administrator: admin@campus.edu / admin123</div>
              <div>Lab Incharge: lab@campus.edu / lab123</div>
              <div>Service Staff: service@campus.edu / service123</div>
              <div>Vendor: vendor@campus.edu / vendor123</div>
            </div>
          ) : null}
        </div>

        <p className="auth-footer">(c) 2026 CampusLedger - Smart Campus Asset Management</p>
      </div>
    </div>
  );
}
