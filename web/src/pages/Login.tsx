import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Trophy, AlertTriangle, CheckCircle2, Users, Lock, Bell, Cpu, FlaskConical, BookOpen, Settings, ClipboardList } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

const LOGIN_GRADIENTS = [
  'linear-gradient(135deg, #0d2818 0%, #1a1040 40%, #2d0a30 70%, #081520 100%)',
  'linear-gradient(135deg, #1a0828 0%, #0d2a38 40%, #2a0a40 70%, #100818 100%)',
  'linear-gradient(135deg, #08201a 0%, #220838 40%, #0a2030 70%, #180a20 100%)',
  'linear-gradient(135deg, #0d2818 0%, #1a1040 40%, #2d0a30 70%, #081520 100%)',
];

const LOGIN_ORBS = [
  { x: '10%',  y: '15%', size: 300, color: 'rgba(244,63,94,0.16)'  },
  { x: '70%',  y: '55%', size: 360, color: 'rgba(20,184,166,0.13)' },
  { x: '38%',  y: '78%', size: 240, color: 'rgba(251,146,60,0.11)' },
];

const LOGIN_BUBBLES = [
  { Icon: Users,         label: 'Users',       top: '8%',  left: '5%',   delay: 0    },
  { Icon: Lock,          label: 'Security',    top: '18%', right: '6%',  delay: 0.5  },
  { Icon: FlaskConical,  label: 'Labs',        top: '55%', left: '4%',   delay: 0.9  },
  { Icon: Cpu,           label: 'Devices',     top: '65%', right: '5%',  delay: 0.3  },
  { Icon: Bell,          label: 'Alerts',      top: '80%', left: '16%',  delay: 1.1  },
  { Icon: BookOpen,      label: 'Reports',     top: '12%', right: '20%', delay: 1.3  },
  { Icon: ClipboardList, label: 'Tasks',       top: '75%', right: '18%', delay: 0.7  },
  { Icon: Settings,      label: 'Config',      top: '42%', left: '3%',   delay: 1.5  },
];
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import type { Role } from '../types/auth';
import { ROLE_HOME_ROUTE } from '../routes/routeConfig';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin',        label: 'Administrator'  },
  { value: 'lab',          label: 'Lab Incharge/Professor' },
  { value: 'service',      label: 'Service Staff'  },
  { value: 'purchase_dept',label: 'Purchase Department' },
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
  const [searchParams] = useSearchParams();

  const [showReport, setShowReport] = useState(false);
  // Honour ?mode=register (Google-auth redirect for new users) or tab default
  const [isRegister, setIsRegister] = useState(searchParams.get('mode') === 'register');
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

  // Pre-fill email/name when coming from Google callback (account not yet registered)
  useEffect(() => {
    const gEmail = searchParams.get('google_email');
    const gName  = searchParams.get('google_name');
    if (gEmail) { setRegEmail(gEmail); setIsRegister(true); }
    if (gName)  setFullName(gName);
    const err = searchParams.get('error');
    if (err === 'google_not_registered') setError('No CampusLedger account found for your Google email. Please register below.');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError(
        'Google Sign-In requires Supabase to be configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
      );
      return;
    }
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) setError(oauthError.message);
  };

  return (
    <motion.div
      className="auth-page"
      initial={{ background: LOGIN_GRADIENTS[0] }}
      animate={{ background: LOGIN_GRADIENTS }}
      transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Ambient orbs */}
      {LOGIN_ORBS.map((orb, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: orb.color,
            filter: 'blur(72px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 7 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: i * 1.5 }}
        />
      ))}

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Floating icon bubbles */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
        {LOGIN_BUBBLES.map(({ Icon, label, top, left, right, delay }: any) => (
          <motion.div
            key={label}
            style={{
              position: 'absolute', top, left, right,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              userSelect: 'none',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0, 0.55, 0.38, 0.55], y: [20, 0, -9, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay }}
          >
            <div style={{
              background: 'rgba(255,255,255,0.07)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.13)',
              borderRadius: 14,
              padding: '10px 12px',
            }}>
              <Icon size={20} color="rgba(255,255,255,0.72)" />
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', fontWeight: 500, letterSpacing: '0.03em' }}>{label}</span>
          </motion.div>
        ))}
      </div>

      <div className="auth-wrap" style={{ position: 'relative', zIndex: 3 }}>
        {/* ── Brand ── */}
        <div className="brand">
          <div className="brand-badge">
            <img
              src="/logo.png"
              alt="CampusLedger"
              style={{
                width: 76,
                height: 76,
                objectFit: 'contain',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.95)',
                padding: 10,
                boxShadow: '0 8px 32px rgba(20,184,166,0.35)',
              }}
            />
          </div>
          <h1>CampusLedger</h1>
          <p>Asset &amp; Inventory Management System</p>
        </div>

        {/* ── Leaderboard ── */}
        <TopHelpfulStudents />

        {/* ── Auth card with AnimatePresence slide ── */}
        <AnimatePresence mode="wait" initial={false}>
          {isRegister ? (
            <motion.div
              key="register"
              className="auth-card"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <h2>Create Account</h2>
              <p className="auth-subtitle">Fill in your details to register</p>

              {/* Google sign-up */}
              <button className="auth-google-btn" type="button" onClick={handleGoogleSignIn}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 7.1 29.3 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.5-.2-2.9-.4-4.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 7.1 29.3 5 24 5 16.3 5 9.7 9.2 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 36.6 26.8 37.6 24 37.6c-5.2 0-9.6-3.4-11.2-8.1l-6.5 5C9.8 41 16.4 45 24 45z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.2 5.2C41.4 35.7 44 30.8 44 25c0-1.5-.2-2.9-.4-4.5z"/>
                </svg>
                Sign up with Google
              </button>

              <div className="auth-divider"><span>or sign up with email</span></div>

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
                <button className="btn primary-btn" disabled={isLoading} type="submit" style={{ marginTop: 18 }}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
                {error ? <p className="error-text">{error}</p> : null}
              </form>

              <p className="auth-switch">
                Already have an account?{' '}
                <button type="button" onClick={() => switchTab(false)}>Sign in</button>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="signin"
              className="auth-card"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <h2>Sign In</h2>
              <p className="auth-subtitle">Enter your credentials to access the dashboard</p>
              {registerSuccess ? <div className="success-banner">Account created successfully! Please sign in below.</div> : null}

              {/* Google sign-in */}
              <button className="auth-google-btn" type="button" onClick={handleGoogleSignIn}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 7.1 29.3 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.5-.2-2.9-.4-4.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 7.1 29.3 5 24 5 16.3 5 9.7 9.2 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 36.6 26.8 37.6 24 37.6c-5.2 0-9.6-3.4-11.2-8.1l-6.5 5C9.8 41 16.4 45 24 45z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.2 5.2C41.4 35.7 44 30.8 44 25c0-1.5-.2-2.9-.4-4.5z"/>
                </svg>
                Sign in with Google
              </button>

              <div className="auth-divider"><span>or sign in with email</span></div>

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
                <button className="btn primary-btn" disabled={isLoading} type="submit" style={{ marginTop: 18 }}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
                {error ? <p className="error-text">{error}</p> : null}
              </form>

              <p className="auth-switch">
                Don&apos;t have an account?{' '}
                <button type="button" onClick={() => switchTab(true)}>Sign up &rarr;</button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="auth-footer">(c) 2026 CampusLedger - Smart Campus Asset Management</p>
      </div>

      {/* ── Floating Report Issue button ── */}
      <button
        className="report-fab"
        onClick={() => setShowReport(true)}
        type="button"
        aria-label="Report Issue as Student"
        style={{ zIndex: 10 }}
      >
        <AlertTriangle size={20} />
        <span>Report Issue as Student</span>
      </button>

      {/* ── Report Issue modal ── */}
      {showReport && (
        <div className="issue-modal-overlay" onClick={() => setShowReport(false)} style={{ zIndex: 20 }}>
          <div className="issue-modal-panel" onClick={(e) => e.stopPropagation()}>
            <ReportIssueForm onClose={() => setShowReport(false)} />
          </div>
        </div>
      )}
    </motion.div>
  );
}