import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Eye, EyeOff, Building2, CheckCircle2 } from 'lucide-react';
import styles from './Login.module.css';
import goalLogo from '../assets/logomain.png';
import bgLogin from '../assets/bglogin.png';

const Login = () => {
  const { handleLogin, finalizeLogin } = useData();

  // ── Step 1: credentials ──────────────────────────────────
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // ── Step 2: org picker ───────────────────────────────────
  const [step, setStep]               = useState('credentials'); // 'credentials' | 'org-picker'
  const [pendingUser, setPendingUser] = useState(null);
  const [pendingOrgs, setPendingOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  // ── Step 1 submit ────────────────────────────────────────
  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await handleLogin(username, password);
      if (result.success && result.needOrgSelect) {
        setPendingUser(result.user);
        setPendingOrgs(result.organizations);
        setSelectedOrgId(result.organizations[0]?.id ?? null);
        setStep('org-picker');
      } else if (!result.success) {
        setError('Invalid username or password.');
      }
      // if success && !needOrgSelect → DataContext already called setCurrentUser
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2 confirm ───────────────────────────────────────
  const onConfirmOrg = () => {
    if (!selectedOrgId || !pendingUser) return;
    finalizeLogin(pendingUser, selectedOrgId);
  };

  const onBackToLogin = () => {
    setStep('credentials');
    setPendingUser(null);
    setPendingOrgs([]);
    setSelectedOrgId(null);
    setError(null);
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* ── Left form panel ── */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <img src={goalLogo} alt="slidust" className={styles.logo} />

          {/* ── STEP 1: Credentials ── */}
          {step === 'credentials' && (
            <>
              {error && (
                <div className={styles.errorBox}>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={onSubmit} className={styles.form}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Username</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Password</label>
                  <div className={styles.passwordWrapper}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className={`${styles.input} ${styles.inputPassword}`}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowPass(v => !v)}
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isLoading}
                >
                  {isLoading
                    ? <span className={styles.spinner} />
                    : 'Sign In'}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2: Org Picker ── */}
          {step === 'org-picker' && (
            <div className={styles.orgPickerWrap}>
              <p className={styles.orgPickerHeading}>Select Organization</p>
              <p className={styles.orgPickerSub}>
                Your account is assigned to multiple organizations.<br />
                Choose the organization you want to sign in to.
              </p>

              <div className={styles.orgList}>
                {pendingOrgs.map(org => (
                  <button
                    key={org.id}
                    type="button"
                    className={`${styles.orgItem} ${selectedOrgId === org.id ? styles.orgItemActive : ''}`}
                    onClick={() => setSelectedOrgId(org.id)}
                  >
                    <span className={styles.orgIcon}>
                      <Building2 size={20} />
                    </span>
                    <span className={styles.orgName}>{org.name}</span>
                    {selectedOrgId === org.id && (
                      <CheckCircle2 size={18} className={styles.orgCheck} />
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={styles.submitBtn}
                onClick={onConfirmOrg}
                disabled={!selectedOrgId}
              >
                Continue to Organization
              </button>

              <button
                type="button"
                className={styles.backBtn}
                onClick={onBackToLogin}
              >
                ← Back to Login
              </button>
            </div>
          )}

          <p className={styles.footer}>
            &copy; {new Date().getFullYear()} slidust
          </p>
        </div>
      </div>

      {/* ── Right image panel ── */}
      <div className={styles.imagePanel} style={{ backgroundImage: `url(${bgLogin})` }} />
    </div>
  );
};

export default Login;
