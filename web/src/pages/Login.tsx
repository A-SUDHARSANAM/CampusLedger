import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

// ---------------------------------------------------------------------------
// Leaderboard sub-component
// ---------------------------------------------------------------------------
function TopHelpfulStudents() {
  const [entries, setEntries] = useState<{ student_name: string; student_id: string; points: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTopHelpfulStudents()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="auth-card leaderboard-card">
      <div className="leaderboard-header">
        <Trophy size={20} className="leaderboard-icon" />
        <span>Top Helpful Students <span className="leaderboard-week">(This Week)</span></span>
      </div>

      {loading ? (
        <div className="leaderboard-empty">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="leaderboard-empty">No verified student reports this week.</div>
      ) : (
        <ol className="leaderboard-list">
          {entries.map((e, i) => (
            <li key={e.student_id + i} className="leaderboard-row">
              <span className="leaderboard-rank">{RANK_MEDALS[i] ?? `${i + 1}.`}</span>
              <span className="leaderboard-name">{e.student_name}</span>
              <span className="leaderboard-id">{e.student_id}</span>
              <span className="leaderboard-pts">{e.points} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issue Report sub-component
// ---------------------------------------------------------------------------
function ReportIssueForm({ onClose }: { onClose: () => void }) {
  const [labs, setLabs] = useState<{ id: string; lab_name: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; asset_name: string }[]>([]);

  const [studentName, setStudentName]   = useState('');
  const [studentId, setStudentId]       = useState('');
  const [department, setDepartment]     = useState('');
  const [labId, setLabId]               = useState('');
  const [assetId, setAssetId]           = useState('');
  const [description, setDescription]   = useState('');
  const [priority, setPriority]         = useState('medium');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [issueError, setIssueError] = useState('');
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    api.getPublicLabs().then(setLabs).catch(() => setLabs([]));
  }, []);

  useEffect(() => {
    if (!labId) { setAssets([]); setAssetId(''); return; }
    api.getPublicAssets(labId).then((data) => { setAssets(data); setAssetId(''); }).catch(() => setAssets([]));
  }, [labId]);

  const resetForm = () => {
    setStudentName(''); setStudentId(''); setDepartment('');
    setLabId(''); setAssetId(''); setDescription(''); setPriority('medium');
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setIssueError('');
    if (!studentName.trim() || !studentId.trim() || !department.trim() || !labId || !description.trim()) {
      setIssueError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const body: {
        student_name: string; student_id: string; department: string;
        lab_id: string; issue_description: string; priority: string; asset_id?: string;
      } = { student_name: studentName.trim(), student_id: studentId.trim(), department: department.trim(), lab_id: labId, issue_description: description.trim(), priority };
      if (assetId) body.asset_id = assetId;
      await api.submitStudentQuery(body);
      setSuccess(true);
      resetForm();
      setTimeout(() => setSuccess(false), 6000);
    } catch (err: unknown) {
      setIssueError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card issue-report-card">
      <div className="issue-modal-header">
        <div className="issue-report-header">
          <AlertTriangle size={20} className="issue-report-icon" />
          <span>Report Asset Issue</span>
        </div>
        <button className="issue-modal-close" onClick={onClose} type="button" aria-label="Close">
          ✕
        </button>
      </div>
      <p className="auth-subtitle">Spotted a problem? Let us know — no login required.</p>

      {success && (
        <div className="success-banner issue-success-banner">
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          Issue reported successfully. Lab technician has been notified.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="issue-form-grid">
          {/* Row 1: Name + ID */}
          <div className="form-field">
            <label className="label" htmlFor="iq-name">Student Name <span className="req">*</span></label>
            <input
              className={`input${submitted && !studentName.trim() ? ' input-error' : ''}`}
              id="iq-name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Arjun S"
            />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="iq-sid">Student ID <span className="req">*</span></label>
            <input
              className={`input${submitted && !studentId.trim() ? ' input-error' : ''}`}
              id="iq-sid"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. 21CS101"
            />
          </div>

          {/* Row 2: Department + Lab */}
          <div className="form-field">
            <label className="label" htmlFor="iq-dept">Department <span className="req">*</span></label>
            <input
              className={`input${submitted && !department.trim() ? ' input-error' : ''}`}
              id="iq-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Computer Science"
            />
          </div>
          <div className="form-field">
            <label className="label" htmlFor="iq-lab">Lab <span className="req">*</span></label>
            <select
              className={`input${submitted && !labId ? ' input-error' : ''}`}
              id="iq-lab"
              value={labId}
              onChange={(e) => setLabId(e.target.value)}
            >
              <option value="">Select lab…</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.lab_name}</option>)}
            </select>
          </div>

          {/* Row 3: Asset (optional) + Priority */}
          <div className="form-field">
            <label className="label" htmlFor="iq-asset">Asset <span className="optional">(optional)</span></label>
            <select
              className="input"
              id="iq-asset"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              disabled={!labId || assets.length === 0}
            >
              <option value="">{!labId ? 'Select a lab first' : assets.length === 0 ? 'No assets in this lab' : 'Select asset…'}</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.asset_name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label" htmlFor="iq-priority">Priority</label>
            <select className="input" id="iq-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Description — full width */}
        <div className="form-field">
          <label className="label" htmlFor="iq-desc">Issue Description <span className="req">*</span></label>
          <textarea
            className={`input issue-textarea${submitted && !description.trim() ? ' input-error' : ''}`}
            id="iq-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail…"
            rows={3}
          />
        </div>

        {issueError && <p className="error-text">{issueError}</p>}

        <button className="btn primary-btn" disabled={submitting} type="submit">
          {submitting ? 'Submitting…' : 'Submit Issue'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Login page
// ---------------------------------------------------------------------------
export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showReport, setShowReport] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

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
        {/* ── Brand ── */}
        <div className="brand">
          <div className="brand-badge">
            <GraduationCap size={36} />
          </div>
          <h1>CampusLedger</h1>
          <p>Asset &amp; Inventory Management System</p>
        </div>

        {/* ── Leaderboard ── */}
        <TopHelpfulStudents />

        {/* ── Auth tabs ── */}
        <div className="auth-tabs">
          <button className={`btn secondary-btn tab-btn ${!isRegister ? 'active' : ''}`} onClick={() => switchTab(false)} type="button">
            Sign In
          </button>
          <button className={`btn secondary-btn tab-btn ${isRegister ? 'active' : ''}`} onClick={() => switchTab(true)} type="button">
            Register
          </button>
        </div>

        {/* ── Auth card ── */}
        <div className="auth-card">
          {isRegister ? (
            <>
              <h2>Create Account</h2>
              <p className="auth-subtitle">Fill in your details to register</p>
              <form onSubmit={handleRegister}>
                <div className="form-field">
                  <label className="label" htmlFor="fullName">Full Name</label>
                  <input className={`input ${submitted && !fullName.trim() ? 'input-error' : ''}`} id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" autoComplete="name" />
                </div>
                <div className="form-field">
                  <label className="label" htmlFor="regRole">Role</label>
                  <select className="input" id="regRole" value={regRole} onChange={(e) => setRegRole(e.target.value as Role)}>
                    {ROLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="label" htmlFor="deptName">Department Name</label>
                  <input className={`input ${submitted && !deptName.trim() ? 'input-error' : ''}`} id="deptName" value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Computer Science" />
                </div>
                <div className="form-field">
                  <label className="label" htmlFor="regEmail">Email</label>
                  <input className={`input ${submitted && !regEmail.trim() ? 'input-error' : ''}`} id="regEmail" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="Enter your email" autoComplete="email" />
                </div>
                <div className="form-field">
                  <label className="label" htmlFor="regPassword">Password</label>
                  <div className="password-wrap">
                    <input className={`input ${submitted && !regPassword.trim() ? 'input-error' : ''}`} id="regPassword" type={showRegPassword ? 'text' : 'password'} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Create a password (min 6 chars)" autoComplete="new-password" />
                    <button className="password-toggle" type="button" aria-label={showRegPassword ? 'Hide password' : 'Show password'} onClick={() => setShowRegPassword((v) => !v)}>
                      {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button className="btn primary-btn" disabled={isLoading} type="submit">{isLoading ? 'Creating Account...' : 'Create Account'}</button>
                {error ? <p className="error-text">{error}</p> : null}
              </form>
            </>
          ) : (
            <>
              <h2>Sign In</h2>
              <p className="auth-subtitle">Enter your credentials to access the dashboard</p>
              {registerSuccess ? <div className="success-banner">Account created successfully! Please sign in below.</div> : null}
              <form onSubmit={handleLogin}>
                <div className="form-field">
                  <label className="label" htmlFor="email">Email</label>
                  <input className={`input ${submitted && !email.trim() ? 'input-error' : ''}`} id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" autoComplete="email" required />
                </div>
                <div className="form-field">
                  <label className="label" htmlFor="password">Password</label>
                  <div className="password-wrap">
                    <input className={`input ${submitted && !password.trim() ? 'input-error' : ''}`} id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                    <button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button className="btn primary-btn" disabled={isLoading} type="submit">{isLoading ? 'Signing in...' : 'Sign In'}</button>
                {error ? <p className="error-text">{error}</p> : null}
              </form>
            </>
          )}
        </div>

        <p className="auth-footer">(c) 2026 CampusLedger - Smart Campus Asset Management</p>
      </div>

      {/* ── Floating Report Issue button ── */}
      <button
        className="report-fab"
        onClick={() => setShowReport(true)}
        type="button"
        aria-label="Report Issue as Student"
      >
        <AlertTriangle size={20} />
        <span>Report Issue as Student</span>
      </button>

      {/* ── Report Issue modal ── */}
      {showReport && (
        <div className="issue-modal-overlay" onClick={() => setShowReport(false)}>
          <div className="issue-modal-panel" onClick={(e) => e.stopPropagation()}>
            <ReportIssueForm onClose={() => setShowReport(false)} />
          </div>
        </div>
      )}
    </div>
  );
}