import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import {
  LayoutDashboard, Users, Utensils, ClipboardList, Settings, LogOut, Menu, X, Plus,
  User as UserIcon, Calendar, BarChart as BarChartIcon, TrendingUp, PieChart as PieChartIcon,
  Search, Download, Trash2, Edit, Bell, Filter, CheckCircle, XCircle, Info, RefreshCw, AlertCircle, QrCode,
  Package, Archive, FileText, Check, Upload, Power, PowerOff
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Cell, Pie
} from 'recharts';
import jsPDF from 'jspdf';
import { apiService } from './services/api';
import './index.css';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

// =========================================================
// TOAST NOTIFICATION SYSTEM
// =========================================================
const ToastContext = React.createContext(null);

const ToastContainer = ({ toasts, onRemove }) => (
  <div style={{
    position: 'fixed', top: '20px', right: '20px',
    zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px',
    pointerEvents: 'none'
  }}>
    <AnimatePresence>
      {toasts.map(t => {
        const cfg = {
          success: { bg: '#10b981', icon: <CheckCircle size={18} />, label: 'Thành công' },
          error: { bg: '#ef4444', icon: <XCircle size={18} />, label: 'Lỗi' },
          info: { bg: '#6366f1', icon: <Info size={18} />, label: 'Thông báo' },
          warning: { bg: '#f59e0b', icon: <AlertCircle size={18} />, label: 'Cảnh báo' },
        }[t.type] || { bg: '#6366f1', icon: <Info size={18} />, label: '' };
        return (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.85 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              pointerEvents: 'all',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: 'white', borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)', padding: '14px 16px',
              minWidth: '280px', maxWidth: '360px',
              borderLeft: `4px solid ${cfg.bg}`,
            }}>
            <span style={{ color: cfg.bg, flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: '700', margin: '0 0 2px', color: '#1a1a2e' }}>{cfg.label}</p>
              <p style={{ fontSize: '13px', color: '#555', margin: 0, wordBreak: 'break-word' }}>{t.message}</p>
            </div>
            <button onClick={() => onRemove(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: '0', flexShrink: 0 }}>
              <X size={15} />
            </button>
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const timerRef = useRef({});

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    clearTimeout(timerRef.current[id]);
  }, []);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    timerRef.current[id] = setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const toast = {
    success: (msg, dur) => show(msg, 'success', dur),
    error: (msg, dur) => show(msg, 'error', dur || 5000),
    info: (msg, dur) => show(msg, 'info', dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
  };

  return { toasts, toast, remove };
};

// =========================================================
// CONFIRM DIALOG
// =========================================================
const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, confirmLabel = 'Xác nhận', danger = false }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
      onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', damping: 22, stiffness: 350 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px', padding: '28px 32px',
          minWidth: '340px', maxWidth: '440px', width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{
            width: '38px', height: '38px', borderRadius: '50%',
            backgroundColor: danger ? '#fee2e2' : '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <AlertCircle size={20} color={danger ? '#ef4444' : '#6366f1'} />
          </span>
          <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#1a1a2e' }}>{title}</h3>
        </div>
        <p style={{ fontSize: '14px', color: '#555', margin: '0 0 24px', lineHeight: '1.6' }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#555' }}>
            Hủy bỏ
          </button>
          <button onClick={onConfirm}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '700', backgroundColor: danger ? '#ef4444' : '#6366f1', color: 'white' }}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const useConfirm = () => {
  const [state, setState] = useState({ open: false, title: '', message: '', danger: false, confirmLabel: 'Xác nhận', resolve: null });

  const confirm = useCallback((title, message, { danger = false, confirmLabel = 'Xác nhận' } = {}) => {
    return new Promise(resolve => {
      setState({ open: true, title, message, danger, confirmLabel, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState(s => ({ ...s, open: false }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState(s => ({ ...s, open: false }));
  }, [state]);

  const ConfirmUI = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      danger={state.danger}
      confirmLabel={state.confirmLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmUI };
};

// --- Token helper to decode JWT payload (base64) ---
const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
};

// ---------------------------------------------------------
// Login Screen
// ---------------------------------------------------------
const LoginScreen = ({ onLoginSuccess }) => {
  const [empId, setEmpId] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [server, setServer] = useState('server-1'); // Default to server-1

  // Forgot Password State
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginStep, setLoginStep] = useState(0); // 0: Credentials, 1: OTP
  const [loginOtp, setLoginOtp] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // ===== Màn chọn Sign In / Sign Up / Guest dùng chung cho cả khách hàng lẫn nhân viên =====
  // 'choose': 3 nút ban đầu | 'signin': 1 ô nhập chung, tự nhận diện SĐT (khách) vs Employee ID
  // (nhân viên) | 'signup': đăng ký tài khoản thật, có toggle khách hàng/nhân viên, đều bắt buộc
  // xác nhận OTP qua email trước khi tạo tài khoản. Guest không có state riêng ở đây — bấm Guest
  // là điều hướng thẳng sang /customer?entry=guest (CustomerOrderApp.jsx tự mở modal tab Khách).
  const [entryChoice, setEntryChoice] = useState('choose');
  const PHONE_REGEX = /^0\d{9}$/;

  const [signupRole, setSignupRole] = useState('customer'); // 'customer' | 'staff'
  const [signupStep, setSignupStep] = useState(0); // 0: form, 1: OTP
  const [signupForm, setSignupForm] = useState({
    username: '', fullName: '', phone: '', email: '', citizenPid: '', birthday: '',
    password: '', confirmPassword: '',
  });
  const [signupOtp, setSignupOtp] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');

  const resetToChooser = () => {
    setEntryChoice('choose');
    setError(''); setSuccessMessage('');
    setSignupError(''); setSignupSuccess(''); setSignupStep(0);
    setLoginStep(0);
  };

  const handleSignupFieldChange = (field) => (e) =>
    setSignupForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError(''); setSignupSuccess('');
    if (signupForm.password !== signupForm.confirmPassword) {
      setSignupError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setSignupLoading(true);
    try {
      if (signupRole === 'customer') {
        const res = await apiService.loyalty.register({
          phone: signupForm.phone.trim(),
          password: signupForm.password,
          fullName: signupForm.fullName.trim(),
          email: signupForm.email.trim(),
        });
        const data = res.data || res;
        if (data.status !== 'REQUIRE_OTP') throw new Error('Không nhận được phản hồi hợp lệ từ server.');
        setSignupStep(1);
        setSignupSuccess('Mã OTP xác nhận đăng ký đã được gửi về email của bạn.');
      } else {
        const response = await apiService.auth.register({
          username: signupForm.username.trim(),
          password: signupForm.password,
          fullName: signupForm.fullName.trim(),
          email: signupForm.email.trim(),
          phoneNumber: signupForm.phone.trim(),
          citizenPid: signupForm.citizenPid.trim(),
          birthday: signupForm.birthday ? `${signupForm.birthday}T00:00:00` : null,
        });
        if (response.status !== 'REQUIRE_OTP') throw new Error('Không nhận được phản hồi hợp lệ từ server.');
        setSignupStep(1);
        setSignupSuccess(response.message || 'Mã OTP xác nhận đăng ký đã được gửi về email của bạn.');
      }
    } catch (err) {
      setSignupError(err.message || 'Đăng ký thất bại, vui lòng thử lại.');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleSignupVerifyOtp = async (e) => {
    e.preventDefault();
    setSignupError('');
    setSignupLoading(true);
    try {
      if (signupRole === 'customer') {
        const res = await apiService.loyalty.registerVerifyOtp(signupForm.phone.trim(), signupOtp.trim());
        const data = res.data || res;
        if (!data.token) throw new Error('Xác nhận OTP thất bại.');
        localStorage.setItem('customerToken', data.token);
        window.location.href = '/customer';
      } else {
        const response = await apiService.auth.registerVerifyOtp(signupForm.username.trim(), signupOtp.trim());
        if (!response.token) throw new Error('Xác nhận OTP thất bại.');
        handleSuccessfulLogin(response.token);
      }
    } catch (err) {
      setSignupError(err.message || 'Xác nhận OTP thất bại.');
    } finally {
      setSignupLoading(false);
    }
  };

  // Lấy hoặc tạo Device ID chuẩn UUID cho trình duyệt này
  const getDeviceId = () => {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      if (window.crypto && window.crypto.randomUUID) {
        id = window.crypto.randomUUID();
      } else {
        // Fallback cho HTTP LAN (không có crypto.randomUUID do không phải https/localhost)
        id = 'device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      }
      localStorage.setItem('deviceId', id);
    }
    return id;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const identifier = empId.trim();
    try {
      // Sign In dùng chung 1 ô nhập: SĐT dạng 0xxxxxxxxx -> tài khoản khách hàng (loyalty-service),
      // còn lại coi là Employee ID -> luồng đăng nhập nhân viên (users-service) như cũ bên dưới.
      if (PHONE_REGEX.test(identifier)) {
        const res = await apiService.loyalty.login({ phone: identifier, password });
        const data = res.data || res;
        if (!data.token) throw new Error('Không nhận được token từ server');
        localStorage.setItem('customerToken', data.token);
        window.location.href = '/customer';
        return;
      }

      const deviceId = getDeviceId();
      const response = await apiService.auth.login(identifier, password, deviceId);
      // BE trả về: { code, status, message, token }

      if (response.status === 'REQUIRE_OTP') {
        setLoginStep(1);
        setSuccessMessage(response.message);
        return;
      }

      const token = response.token;
      if (!token) throw new Error('Không nhận được token từ server');

      handleSuccessfulLogin(token);
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLoginOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const deviceId = getDeviceId();
      const response = await apiService.auth.verifyOtp(empId, loginOtp, deviceId, rememberMe);
      // response: { code, status, message, token }
      if (response.token) {
        handleSuccessfulLogin(response.token);
      } else {
        throw new Error('Xác thực OTP thất bại');
      }
    } catch (err) {
      setError(err.message || 'Xác thực OTP thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessfulLogin = (token) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('token', token);

    const userPayload = parseJwt(token);
    const userData = {
      id: userPayload.sub,
      username: userPayload.sub,
      fullName: userPayload.fullName || userPayload.sub,
      role: userPayload.role, // Lấy trực tiếp từ Token
      server: 'local',
      tokenExp: userPayload.exp,
      tokenIat: userPayload.iat,
    };

    storage.setItem('user', JSON.stringify(userData));
    onLoginSuccess(userData);
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    setForgotStep(1);
    setError('');
    setSuccessMessage('');
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiService.auth.forgotPassword(forgotEmail);
      setForgotStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiService.auth.resetPassword(forgotEmail, otp, newPassword);
      setSuccessMessage('Password reset successfully! You can now login.');
      setIsForgotPassword(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', height: '100vh', width: '100%' }}>
      {/* Left Side Branding */}
      <div style={{ flex: 1, backgroundColor: 'var(--primary)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '60px', color: 'white' }}>
        <div style={{ zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'auto' }}>
          <div style={{ background: 'white', padding: '10px', borderRadius: '12px' }}>
            <Utensils color="var(--primary)" size={28} />
          </div>
          <h1 style={{ fontSize: '24px', letterSpacing: '-0.5px' }}>Restaurant Management</h1>
        </div>
        <div style={{ zIndex: 10, maxWidth: '400px' }}>
          <h2 style={{ fontSize: '48px', lineHeight: '1.1', marginBottom: '20px' }}>Manage your restaurant beautifully.</h2>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.8)' }}>Access the dashboard to oversee orders, manage staff, and analyze revenue in real-time.</p>
        </div>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)', zIndex: 0 }}></div>
      </div>

      {/* Right Side Login Form */}
      <div style={{ flex: 1, backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', marginBottom: '8px' }}>
              {isForgotPassword
                ? (forgotStep === 1 ? 'Reset Password' : 'Enter OTP')
                : entryChoice === 'choose' ? 'Xin chào'
                : entryChoice === 'signin' ? 'Welcome back'
                : 'Tạo tài khoản mới'}
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {isForgotPassword
                ? (forgotStep === 1 ? 'Enter your email to receive an OTP.' : 'Check your email for the 6-digit OTP code.')
                : entryChoice === 'choose' ? 'Bạn muốn tiếp tục với vai trò nào?'
                : entryChoice === 'signin' ? 'Please enter your details to sign in.'
                : 'Điền thông tin để đăng ký tài khoản mới — cần xác nhận OTP qua email.'}
            </p>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'rgba(244, 67, 54, 0.1)', color: 'var(--status-cancelled)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '14px' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {successMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'rgba(76, 175, 80, 0.1)', color: 'var(--status-completed)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '14px' }}>
              <AlertCircle size={16} /> {successMessage}
            </div>
          )}

          {isForgotPassword ? (
            forgotStep === 1 ? (
            // --- FORGOT PASSWORD STEP 1 ---
            <form onSubmit={handleSendOTP}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input type="email" className="form-input" placeholder="user@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', marginBottom: '16px' }} disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
              <div style={{ textAlign: 'center' }}>
                <button type="button" onClick={toggleForgotPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>← Back to Login</button>
              </div>
            </form>
          ) : (
            // --- FORGOT PASSWORD STEP 2 ---
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">6-Digit OTP</label>
                <input type="text" className="form-input" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} required maxLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" placeholder="Min 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', marginBottom: '16px' }} disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
              <div style={{ textAlign: 'center' }}>
                <button type="button" onClick={toggleForgotPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>← Cancel</button>
              </div>
            </form>
            )
          ) : entryChoice === 'choose' ? (
            // --- CHOOSER: Sign In / Sign Up / Guest ---
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <button
                type="button"
                onClick={() => { setEntryChoice('signin'); setError(''); setSuccessMessage(''); }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '16px' }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setEntryChoice('signup'); setSignupError(''); setSignupSuccess(''); setSignupStep(0); }}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '16px' }}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = '/customer?entry=guest'; }}
                style={{ width: '100%', padding: '16px', background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}
              >
                Guest
              </button>
            </div>
          ) : entryChoice === 'signin' ? (
            // --- SIGN IN (dùng chung: SĐT -> khách hàng, Employee ID -> nhân viên) ---
            loginStep === 0 ? (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Số điện thoại hoặc Employee ID</label>
                  <input type="text" className="form-input" value={empId} onChange={e => setEmpId(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <div />
                  <button type="button" onClick={toggleForgotPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--primary)', fontWeight: '500', padding: 0 }}>Forgot password?</button>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px' }} disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              // --- LOGIN OTP STEP (chỉ áp dụng cho nhân viên — khách hàng không qua bước này) ---
              <form onSubmit={handleVerifyLoginOTP}>
                <div className="form-group">
                  <label className="form-label">Nhập mã OTP (từ Email)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="______"
                    maxLength={6}
                    value={loginOtp}
                    onChange={e => setLoginOtp(e.target.value)}
                    required
                    style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: '800' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer' }} onClick={() => setRememberMe(!rememberMe)}>
                  <div style={{ width: '18px', height: '18px', border: '2px solid #11117F', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: rememberMe ? '#11117F' : 'transparent', transition: 'all 0.2s' }}>
                    {rememberMe && <CheckCircle size={14} color="white" />}
                  </div>
                  <span style={{ fontSize: '14px', color: '#11117F', fontWeight: '600' }}>Ghi nhớ đăng nhập trong 30 ngày</span>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', marginBottom: '16px' }} disabled={loading}>
                  {loading ? 'Verifying...' : 'Xác nhận OTP'}
                </button>
                <button type="button" onClick={() => setLoginStep(0)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Quay lại đăng nhập
                </button>
              </form>
            )
          ) : (
            // --- SIGN UP (khách hàng hoặc nhân viên, đều phải xác nhận OTP qua email) ---
            signupStep === 0 ? (
              <form onSubmit={handleSignupSubmit}>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-app)', padding: '4px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setSignupRole('customer')}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: signupRole === 'customer' ? 'var(--primary)' : 'transparent', color: signupRole === 'customer' ? '#FFF' : 'var(--text-secondary)' }}
                  >
                    Khách hàng
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole('staff')}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: signupRole === 'staff' ? 'var(--primary)' : 'transparent', color: signupRole === 'staff' ? '#FFF' : 'var(--text-secondary)' }}
                  >
                    Nhân viên
                  </button>
                </div>

                {signupRole === 'staff' && (
                  <div className="form-group">
                    <label className="form-label">Employee ID</label>
                    <input type="text" className="form-input" value={signupForm.username} onChange={handleSignupFieldChange('username')} required />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Họ tên</label>
                  <input type="text" className="form-input" value={signupForm.fullName} onChange={handleSignupFieldChange('fullName')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Số điện thoại</label>
                  <input type="tel" className="form-input" value={signupForm.phone} onChange={handleSignupFieldChange('phone')} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email (để nhận mã OTP)</label>
                  <input type="email" className="form-input" value={signupForm.email} onChange={handleSignupFieldChange('email')} required />
                </div>
                {signupRole === 'staff' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Căn cước công dân (CCCD)</label>
                      <input type="text" className="form-input" value={signupForm.citizenPid} onChange={handleSignupFieldChange('citizenPid')} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ngày sinh</label>
                      <input type="date" className="form-input" value={signupForm.birthday} onChange={handleSignupFieldChange('birthday')} required />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label className="form-label">Mật khẩu</label>
                  <input type="password" className="form-input" value={signupForm.password} onChange={handleSignupFieldChange('password')} required minLength={6} />
                </div>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label">Xác nhận mật khẩu</label>
                  <input type="password" className="form-input" value={signupForm.confirmPassword} onChange={handleSignupFieldChange('confirmPassword')} required minLength={6} />
                </div>

                {signupError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'rgba(244, 67, 54, 0.1)', color: 'var(--status-cancelled)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '14px' }}>
                    <AlertCircle size={16} /> {signupError}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px' }} disabled={signupLoading}>
                  {signupLoading ? 'Đang xử lý...' : 'Đăng ký'}
                </button>
              </form>
            ) : (
              // --- SIGN UP OTP STEP ---
              <form onSubmit={handleSignupVerifyOtp}>
                <div className="form-group">
                  <label className="form-label">Nhập mã OTP (từ Email)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="______"
                    maxLength={6}
                    value={signupOtp}
                    onChange={e => setSignupOtp(e.target.value)}
                    required
                    style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: '800' }}
                  />
                </div>

                {signupSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'rgba(76, 175, 80, 0.1)', color: 'var(--status-completed)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '14px' }}>
                    <AlertCircle size={16} /> {signupSuccess}
                  </div>
                )}
                {signupError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'rgba(244, 67, 54, 0.1)', color: 'var(--status-cancelled)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '14px' }}>
                    <AlertCircle size={16} /> {signupError}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', marginBottom: '16px' }} disabled={signupLoading}>
                  {signupLoading ? 'Đang xác nhận...' : 'Xác nhận OTP'}
                </button>
                <button type="button" onClick={() => setSignupStep(0)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Quay lại
                </button>
              </form>
            )
          )}

          {!isForgotPassword && entryChoice !== 'choose' && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button type="button" onClick={resetToChooser} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--primary)', fontWeight: '500' }}>
                ← Quay lại
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------
// Kitchen Display System (KDS) — ticket & board components
// ---------------------------------------------------------
// Giá trị mặc định — có thể chỉnh trong tab Settings (xem kdsSettings/KDS_SETTINGS_DEFAULT trong DashboardScreen).
const KDS_SETTINGS_DEFAULT = { warningMinutes: 10, criticalMinutes: 15, autoStartMinutes: 0, autoReadyMinutes: 0, autoPrintOnCooking: false };

// --- "Máy in bếp" mô phỏng: chưa có máy in nhiệt thật để test, nên thay vì gọi lệnh in,
// mình vẽ phiếu ra <canvas> rồi tải về dưới dạng ảnh PNG — coi như "tờ giấy" máy in nhả ra.
// Khi nào có máy in ESC/POS thật, chỉ cần thay hàm này bằng lệnh gửi lệnh in tương ứng.
const wrapCanvasTextLines = (ctx, text, maxWidth) => {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  words.forEach(word => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);
  return lines;
};

const printKitchenTicket = (item) => {
  const width = 420; // mô phỏng khổ giấy in nhiệt ~80mm
  const padding = 20;
  const contentWidth = width - padding * 2;

  // Canvas tạm chỉ để đo chữ (biết trước cần bao nhiêu dòng) trước khi dựng canvas thật với đúng chiều cao.
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');

  mctx.font = 'bold 20px monospace';
  const nameLines = wrapCanvasTextLines(mctx, `${item.quantity || 1}x ${item.foodName || 'Món'}`, contentWidth);

  let noteLines = [];
  if (item.note) {
    mctx.font = 'italic 14px monospace';
    noteLines = wrapCanvasTextLines(mctx, `Ghi chú: ${item.note}`, contentWidth);
  }

  const timeStr = new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

  let height = padding + 32 + 26 + 16; // tiêu đề + dòng phụ đề + gạch ngang
  height += 26; // dòng tên bàn
  height += nameLines.length * 26 + 6;
  if (noteLines.length) height += noteLines.length * 20 + 6;
  height += 20; // "Vào bếp: ..."
  if (item.orderId) height += 20; // "Mã đơn: ..."
  height += 16 + padding; // gạch ngang cuối + padding dưới

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(height, 220);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000'; ctx.textBaseline = 'top';

  let y = padding;
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('PHIẾU BẾP', width / 2, y); y += 32;
  ctx.font = '12px monospace';
  ctx.fillText('— mô phỏng máy in, chưa nối máy in thật —', width / 2, y); y += 26;
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#000';
  ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke(); y += 16;

  ctx.font = 'bold 17px monospace';
  ctx.fillText(item.tableNumber || 'Mang về', padding, y); y += 26;

  ctx.font = 'bold 20px monospace';
  nameLines.forEach(l => { ctx.fillText(l, padding, y); y += 26; });
  y += 6;

  if (noteLines.length) {
    ctx.font = 'italic 14px monospace';
    noteLines.forEach(l => { ctx.fillText(l, padding, y); y += 20; });
    y += 6;
  }

  ctx.font = '13px monospace';
  ctx.fillText(`Vào bếp: ${timeStr}`, padding, y); y += 20;
  if (item.orderId) { ctx.fillText(`Mã đơn: #${item.orderId}`, padding, y); y += 20; }

  y += 6;
  ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  const safeTable = String(item.tableNumber || 'mang-ve').replace(/\s+/g, '-');
  const safeFood = String(item.foodName || 'mon').replace(/\s+/g, '-');
  link.download = `phieu-bep_${safeTable}_${safeFood}_${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const getKitchenWaitMinutes = (item, now) => {
  if (!item.createdAt) return 0;
  return Math.floor((now - new Date(item.createdAt).getTime()) / 60000);
};

// Urgency chỉ tính cho món còn đang chờ/đang nấu — món đã READY không cần "giục" bếp nữa.
const getKitchenUrgency = (item, now, thresholds = KDS_SETTINGS_DEFAULT) => {
  const isActive = item.kitchenStatus === 'PENDING' || item.kitchenStatus === 'COOKING';
  if (!isActive) return 'normal';
  const waited = getKitchenWaitMinutes(item, now);
  if (waited >= thresholds.criticalMinutes) return 'critical';
  if (waited >= thresholds.warningMinutes) return 'warning';
  return 'normal';
};

// Đếm ngược tới mốc tự động chuyển trạng thái (nếu bếp có bật setting autoStartMinutes / autoReadyMinutes).
// Chạy tick riêng 1 giây/lần CHỈ khi có đếm ngược cần hiển thị, để không kéo cả DashboardScreen re-render mỗi giây.
const useAutoCountdown = (targetTime) => {
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!targetTime) return;
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [targetTime]);
  if (!targetTime) return null;
  return Math.max(0, Math.round((targetTime - Date.now()) / 1000));
};

const formatCountdown = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const KitchenTicket = ({ item, now, kiosk, onStatusChange, onPrint, thresholds = KDS_SETTINGS_DEFAULT, cookStartMap }) => {
  const ks = item.kitchenStatus;
  const statusColor = ks === 'PENDING' ? '#F59E0B' : ks === 'COOKING' ? '#EF4444' : ks === 'READY' ? '#10B981' : '#6B7280';
  const urgency = getKitchenUrgency(item, now, thresholds);
  const waited = getKitchenWaitMinutes(item, now);
  const borderColor = urgency === 'critical' ? '#DC2626' : urgency === 'warning' ? '#F59E0B' : `${statusColor}30`;

  // Mốc thời gian sẽ tự động chuyển trạng thái, nếu setting tương ứng > 0
  let autoTargetTime = null;
  if (ks === 'PENDING' && thresholds.autoStartMinutes > 0 && item.createdAt) {
    autoTargetTime = new Date(item.createdAt).getTime() + thresholds.autoStartMinutes * 60000;
  } else if (ks === 'COOKING' && thresholds.autoReadyMinutes > 0) {
    const cookStart = (cookStartMap && cookStartMap.get(item.id)) || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now());
    autoTargetTime = cookStart + thresholds.autoReadyMinutes * 60000;
  }
  const countdownSeconds = useAutoCountdown(autoTargetTime);
  const btnStyle = (color) => ({
    flex: 1,
    padding: kiosk ? '18px' : '8px',
    fontSize: kiosk ? '18px' : '12px',
    minHeight: kiosk ? '56px' : 'auto',
    fontWeight: '700',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: color,
    color: 'white',
  });
  const Dot = () => <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#CBD5E1' }} />;

  return (
    <div style={{
      padding: kiosk ? '20px' : '12px',
      borderRadius: '12px',
      backgroundColor: urgency === 'critical' ? '#FEF2F2' : '#FFF',
      border: `${urgency === 'normal' ? 1 : 3}px solid ${borderColor}`,
      animation: urgency === 'critical' ? 'kdsPulse 1.2s ease-in-out infinite' : 'none',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: kiosk ? '14px' : '8px' }}>
        <div style={{ flex: 1 }}>
          <h5 style={{ fontSize: kiosk ? '24px' : '15px', fontWeight: '700', margin: 0, color: '#1E293B' }}>{item.foodName}</h5>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: kiosk ? '20px' : '13px', fontWeight: '800', color: '#64748B' }}>x{item.quantity}</span>
            <Dot />
            <span style={{ fontSize: kiosk ? '16px' : '11px', fontWeight: '700', color: statusColor, textTransform: 'uppercase' }}>
              {ks === 'PENDING' ? '⏳ Chờ' : ks === 'COOKING' ? '🔥 Nấu' : ks === 'READY' ? '✅ Sẵn sàng' : ks}
            </span>
            {item.createdAt && (
              <>
                <Dot />
                <span style={{ fontSize: kiosk ? '16px' : '11px', fontWeight: urgency !== 'normal' ? '800' : '600', color: urgency === 'critical' ? '#DC2626' : urgency === 'warning' ? '#B45309' : '#64748B' }}>
                  ⏱️ {waited > 0 ? `${waited} phút` : 'Vừa xong'}{urgency === 'critical' ? ' — QUÁ LÂU!' : ''}
                </span>
              </>
            )}
            {item.stationName && (
              <>
                <Dot />
                <span style={{ fontSize: kiosk ? '15px' : '11px', fontWeight: '600', color: '#6366F1' }}>{item.stationName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {item.note && (
        <div style={{ fontSize: kiosk ? '15px' : '12px', fontStyle: 'italic', color: '#92400E', backgroundColor: '#FFFBEB', padding: '6px 10px', borderRadius: '6px', marginBottom: '10px', borderLeft: '3px solid #F59E0B' }}>
          📝 {item.note}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        {ks === 'PENDING' && (
          <button onClick={() => onStatusChange(item.id, 'COOKING')} style={btnStyle('#EF4444')}>
            {countdownSeconds !== null
              ? (countdownSeconds > 0 ? `🔥 Tự nấu sau ${formatCountdown(countdownSeconds)}` : '🔥 Nấu ngay')
              : '🔥 Nấu'}
          </button>
        )}
        {ks === 'COOKING' && (
          <button onClick={() => onStatusChange(item.id, 'READY')} style={btnStyle('#10B981')}>
            {countdownSeconds !== null
              ? (countdownSeconds > 0 ? `✅ Tự xong sau ${formatCountdown(countdownSeconds)}` : '✅ Xong ngay')
              : '✅ Xong'}
          </button>
        )}
        {ks === 'READY' && (
          // Bếp chỉ nấu xong tới đây — waiter mới là người xác nhận đã trả món cho khách (bên tab Orders).
          <div style={{ ...btnStyle('#EEF2FF'), color: '#6366F1', textAlign: 'center', cursor: 'default' }}>
            🔔 Chờ phục vụ trả bàn
          </div>
        )}
        {onPrint && (
          <button onClick={() => onPrint(item)} title="In phiếu (mô phỏng — tải ảnh)"
            style={{ padding: kiosk ? '18px' : '8px', minWidth: kiosk ? '56px' : '36px', minHeight: kiosk ? '56px' : 'auto', borderRadius: '8px', border: '1px solid #CBD5E1', cursor: 'pointer', backgroundColor: '#FFF', color: '#334155', fontSize: kiosk ? '18px' : '14px' }}>
            🖨️
          </button>
        )}
      </div>
    </div>
  );
};

const KitchenBoard = ({ items, viewMode, kiosk, now, onStatusChange, onCompleteAll, onPrint, thresholds = KDS_SETTINGS_DEFAULT, cookStartMap }) => {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: kiosk ? '120px 40px' : '80px', color: 'var(--text-secondary)' }}>
        <Utensils size={kiosk ? 72 : 52} style={{ margin: '0 auto 16px', opacity: 0.25 }} />
        <p style={{ fontWeight: '600', fontSize: kiosk ? '22px' : '16px' }}>Không có món nào cần chế biến</p>
        <p style={{ fontSize: kiosk ? '16px' : '13px', marginTop: '4px' }}>Tất cả đơn đã được phục vụ hoặc chưa có đơn mới.</p>
      </div>
    );
  }

  if (viewMode === 'status') {
    const columns = [
      { key: 'PENDING', label: '⏳ Chờ', color: '#F59E0B' },
      { key: 'COOKING', label: '🔥 Đang nấu', color: '#EF4444' },
      { key: 'READY', label: '✅ Sẵn sàng', color: '#10B981' },
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: kiosk ? '20px' : '16px' }}>
        {columns.map(col => {
          const colItems = items.filter(i => i.kitchenStatus === col.key)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return (
            <div key={col.key} style={{ backgroundColor: '#F8FAFC', borderRadius: '14px', padding: kiosk ? '16px' : '12px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <h4 style={{ fontSize: kiosk ? '20px' : '15px', fontWeight: '800', color: col.color, margin: 0 }}>{col.label}</h4>
                <span style={{ fontSize: kiosk ? '16px' : '12px', fontWeight: '700', color: '#64748B' }}>{colItems.length}</span>
              </div>
              {colItems.map(item => (
                <KitchenTicket key={item.id} item={item} now={now} kiosk={kiosk} onStatusChange={onStatusChange} onPrint={onPrint} thresholds={thresholds} cookStartMap={cookStartMap} />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // viewMode === 'table' (mặc định) — nhóm theo bàn, bàn nào gọi món sớm nhất lên đầu
  const groups = Object.entries(
    items.reduce((acc, item) => {
      const key = item.tableNumber || 'Mang về';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {})
  ).sort((a, b) => {
    const timeA = Math.min(...a[1].map(i => new Date(i.createdAt).getTime()));
    const timeB = Math.min(...b[1].map(i => new Date(i.createdAt).getTime()));
    return timeA - timeB;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${kiosk ? 420 : 350}px, 1fr))`, gap: kiosk ? '28px' : '24px' }}>
      {groups.map(([tableName, tItems]) => (
        <div key={tableName} className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: kiosk ? '20px 24px' : '16px 20px', backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: kiosk ? '44px' : '36px', height: kiosk ? '44px' : '36px', borderRadius: '10px', backgroundColor: '#11117F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Users size={kiosk ? 22 : 18} />
              </div>
              <h4 style={{ fontSize: kiosk ? '24px' : '18px', fontWeight: '800', color: '#11117F', margin: 0 }}>{tableName}</h4>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: kiosk ? '14px' : '12px', fontWeight: '700', color: '#64748B', backgroundColor: '#F1F5F9', padding: '4px 10px', borderRadius: '20px' }}>
                {tItems.length} món
              </span>
              {tItems.some(i => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'COOKING') && (
                <button onClick={() => onCompleteAll(tItems)}
                  style={{ padding: kiosk ? '10px 16px' : '6px 12px', fontSize: kiosk ? '15px' : '12px', fontWeight: '700', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: '#10B981', color: 'white', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>
                  <CheckCircle size={kiosk ? 18 : 14} /> Xong tất cả
                </button>
              )}
            </div>
          </div>
          <div style={{ padding: kiosk ? '20px 24px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...tItems].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(item => (
              <KitchenTicket key={item.id} item={item} now={now} kiosk={kiosk} onStatusChange={onStatusChange} onPrint={onPrint} thresholds={thresholds} cookStartMap={cookStartMap} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------
// Dashboard Screen
// ---------------------------------------------------------
const DashboardScreen = ({ user, onLogout }) => {
  const { toasts, toast, remove: removeToast } = useToast();
  const { confirm, ConfirmUI } = useConfirm();
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('activeTab');
    if (saved) return saved;
    // Mặc định dựa trên Role
    if (user?.role === 'KITCHEN') return 'Kitchen';
    if (user?.role === 'WAITER') return 'Orders';
    return 'Overview';
  });

  const handleLogout = async () => {
    const ok = await confirm(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?',
      { danger: true, confirmLabel: 'Đăng xuất' }
    );
    if (ok) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('activeTab');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onLogout();
    }
  };


  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // State to force re-render for time-dependent displays (like waiting times)
  const [timeTicker, setTimeTicker] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(Date.now());
    }, 15000); // Ticks every 15 seconds to keep waiting times updated
    return () => clearInterval(timer);
  }, []);

  // ===== NICE-TO-HAVE FEATURES =====
  // 1) Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // 2) Multi-language
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'vi');
  const t = {
    vi: {
      // Nav
      overview: 'Tổng quan', orders: 'Đơn hàng', tables: 'Lịch Sử',
      kitchen: 'Bếp', menu: 'Thực đơn', staff: 'Nhân viên', accounts: 'Tài khoản',
      reports: 'Báo cáo', settings: 'Cài đặt', inventory: 'Quản lý kho', profile: 'Hồ Sơ',
      // Profile page
      profileTitle: 'Hồ Sơ Cá Nhân', profileSubtitle: 'Thông tin tài khoản của bạn',
      accountInfo: 'Thông tin tài khoản', sessionInfo: 'Thông tin phiên đăng nhập',
      usernameLabel: 'Tên đăng nhập', displayNameLabel: 'Tên hiển thị', roleLabel: 'Vai trò',
      loginTime: 'Thời gian đăng nhập', expireTime: 'Phiên hết hạn',
      roleBadge: { ADMIN: 'Quản trị viên', WAITER: 'Phục vụ', KITCHEN: 'Bếp', GUEST: 'Khách' },
      // Settings toggles
      logout: 'Đăng xuất', darkMode: 'Giao diện tối', soundNotif: 'Âm thanh TB', language: 'Ngôn ngữ',
      // Common buttons
      add: 'Thêm', edit: 'Sửa', delete: 'Xóa', save: 'Lưu', cancel: 'Hủy',
      close: 'Đóng', refresh: 'Làm mới', search: 'Tìm kiếm', filter: 'Lọc',
      confirm: 'Xác nhận', loading: 'Đang tải...', export: 'Xuất',
      // Overview
      recentOrders: 'Đơn hàng gần đây', todayRevenue: 'Doanh thu hôm nay',
      totalOrders: 'Tổng đơn hôm nay', pendingOrders: 'Đang chờ',
      completedOrders: 'Hoàn thành', totalTables: 'Tổng số bàn',
      occupiedTables: 'Bàn đang dùng', availableTables: 'Bàn trống',
      // Table headers - Orders
      orderId: 'Mã đơn', tableCol: 'Bàn', amount: 'Thành tiền', status: 'Trạng thái',
      time: 'Thời gian', items: 'Món', actions: 'Thao tác', note: 'Ghi chú',
      // Table headers - Staff
      fullName: 'Họ tên', role: 'Vai trò', email: 'Email',
      phone: 'Điện thoại', birthday: 'Ngày sinh', server: 'Chi nhánh',
      // Table headers - Food
      foodName: 'Tên món', price: 'Giá', category: 'Danh mục', image: 'Hình ảnh',
      // Statuses
      pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', preparing: 'Đang nấu',
      ready: 'Sẵn sàng', completed: 'Hoàn thành', cancelled: 'Đã hủy',
      paid: 'Đã thanh toán', available: 'Trống', occupied: 'Có khách', cleaning: 'Dọn dẹp',
      // Section titles
      tableManagement: 'Quản lý sơ đồ bàn', addTable: 'Thêm Bàn', editTable: 'Sửa Bàn',
      foodManagement: 'Quản lý món ăn', addFood: 'Thêm Món', editFood: 'Sửa Món',
      categoryManagement: 'Quản lý danh mục', addCategory: 'Thêm Danh Mục',
      staffManagement: 'Quản lý nhân viên', addStaff: 'Thêm Nhân Viên', editStaff: 'Sửa Nhân Viên',
      createOrder: 'Tạo Đơn Hàng', orderDetail: 'Chi Tiết Đơn',
      invoiceDetail: 'Hóa Đơn Chi Tiết', downloadPdf: 'Tải PDF', closeInvoice: 'Đóng Hóa Đơn',
      checkout: 'Thanh Toán', payment: 'Phương thức thanh toán',
      cash: 'Tiền mặt', transfer: 'Chuyển khoản',
      reportTitle: 'Báo cáo', reportSubtitle: 'Phân tích hiệu quả kinh doanh dựa trên dữ liệu thực tế',
      appPreferences: 'Tùy chỉnh ứng dụng', appPreferencesDesc: 'Cá nhân hóa giao diện và trải nghiệm sử dụng',
      darkModeOn: 'Đang bật — giao diện tối', darkModeOff: 'Đang tắt — giao diện sáng',
      soundOn: 'Phát âm thanh khi có đơn hàng mới vào bếp', soundOff: 'Tắt âm thanh thông báo',
      langDesc: 'Tiếng Việt — nhấn để đổi sang English',
      // Kitchen
      kitchenTitle: 'Màn hình bếp', newOrder: 'Đơn mới', inProgress: 'Đang nấu',
      markDone: 'Hoàn thành', startCooking: 'Bắt đầu nấu',
      // Orders tab
      createNewOrder: 'Tạo Đơn Mới', allOrders: 'Tất cả đơn hàng',
      noOrders: 'Chưa có đơn hàng', selectTable: 'Chọn bàn',
      addToCart: 'Thêm vào giỏ', placeOrder: 'Đặt Đơn',
      // No data
      noData: 'Chưa có dữ liệu', noFoods: 'Chưa có món ăn', noStaff: 'Chưa có nhân viên',
      // Cart & Order
      cart: 'GIỎ HÀNG', cartEmpty: 'Chưa có món nào được chọn', total: 'TỔNG CỘNG',
      confirmOrder: 'XÁC NHẬN GỌI MÓN', noteHint: 'Ghi chú cho đơn hàng...',
      qtyLabel: 'món',
      // Invoice modal
      invoiceTitle: 'HÓA ĐƠN CHI TIẾT', tablePosition: 'Vị trí bàn',
      subtotal: 'Tạm tính', serviceFee: 'Phí dịch vụ',
      downloadPdfBtn: 'Tải PDF', closeInvoiceBtn: 'Đóng Hóa Đơn',
      // Checkout modal
      checkoutTitle: 'THANH TOÁN ĐƠN HÀNG', orderLabel: 'Đơn hàng',
      totalPayment: 'TỔNG THANH TOÁN', paymentMethodLabel: 'Phương thức thanh toán',
      cashBtn: '💵 Tiền mặt', transferBtn: '🏦 Chuyển khoản (QR)',
      cashInputLabel: 'Tiền khách đưa (đơn vị nghìn VNĐ)',
      cashHint: '💡 Hệ thống tự động nhân với 1.000 VNĐ',
      changeLabel: 'Tiền thừa trả khách:', transferMode: 'Phương thức: Chuyển khoản',
      viewQR: 'Xem lại mã QR', cancelBtn: 'Hủy', confirmPayment: 'XÁC NHẬN ĐÃ THU TIỀN',
      // QR modal
      accountName: 'Chủ tài khoản', amountLabel: 'SỐ TIỀN CẦN CHUYỂN', doneQR: 'ĐÃ QUÉT XONG',
    },
    en: {
      // Nav
      overview: 'Overview', orders: 'Orders', tables: 'Tables',
      kitchen: 'Kitchen', menu: 'Menu & Food', staff: 'Staff',
      reports: 'Reports', settings: 'Settings', inventory: 'Inventory', profile: 'Profile',
      // Profile page
      profileTitle: 'My Profile', profileSubtitle: 'Your account information',
      accountInfo: 'Account Information', sessionInfo: 'Session Information',
      usernameLabel: 'Username', displayNameLabel: 'Display Name', roleLabel: 'Role',
      loginTime: 'Login Time', expireTime: 'Session Expires',
      roleBadge: { ADMIN: 'Administrator', WAITER: 'Waiter', KITCHEN: 'Kitchen Staff', GUEST: 'Guest' },
      // Settings toggles
      logout: 'Logout', darkMode: 'Dark Mode', soundNotif: 'Sound Alert', language: 'Language',
      // Common buttons
      add: 'Add', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
      close: 'Close', refresh: 'Refresh', search: 'Search', filter: 'Filter',
      confirm: 'Confirm', loading: 'Loading...', export: 'Export',
      // Overview
      recentOrders: 'Recent Orders', todayRevenue: "Today's Revenue",
      totalOrders: 'Total Orders Today', pendingOrders: 'Pending',
      completedOrders: 'Completed', totalTables: 'Total Tables',
      occupiedTables: 'Occupied Tables', availableTables: 'Available Tables',
      // Table headers - Orders
      orderId: 'Order ID', tableCol: 'Table', amount: 'Amount', status: 'Status',
      time: 'Time', items: 'Items', actions: 'Actions', note: 'Note',
      // Table headers - Staff
      fullName: 'Full Name', role: 'Role', email: 'Email',
      phone: 'Phone', birthday: 'Birthday', server: 'Branch',
      // Table headers - Food
      foodName: 'Food Name', price: 'Price', category: 'Category', image: 'Image',
      // Statuses
      pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
      ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled',
      paid: 'Paid', available: 'Available', occupied: 'Occupied', cleaning: 'Cleaning',
      // Section titles
      tableManagement: 'Table Layout Management', addTable: 'Add Table', editTable: 'Edit Table',
      foodManagement: 'Food Management', addFood: 'Add Food', editFood: 'Edit Food',
      categoryManagement: 'Category Management', addCategory: 'Add Category',
      staffManagement: 'Staff Management', addStaff: 'Add Staff', editStaff: 'Edit Staff',
      createOrder: 'Create Order', orderDetail: 'Order Detail',
      invoiceDetail: 'Invoice Detail', downloadPdf: 'Download PDF', closeInvoice: 'Close Invoice',
      checkout: 'Checkout', payment: 'Payment Method',
      cash: 'Cash', transfer: 'Bank Transfer',
      reportTitle: 'Reports', reportSubtitle: 'Business analytics based on real-time data',
      appPreferences: 'App Preferences', appPreferencesDesc: 'Personalize the interface and your experience',
      darkModeOn: 'Enabled — dark interface', darkModeOff: 'Disabled — light interface',
      soundOn: 'Play sound when new kitchen orders arrive', soundOff: 'Sound notifications disabled',
      langDesc: 'English — click to switch to Vietnamese',
      // Kitchen
      kitchenTitle: 'Kitchen Display', newOrder: 'New Order', inProgress: 'In Progress',
      markDone: 'Mark Done', startCooking: 'Start Cooking',
      // Orders tab
      createNewOrder: 'Create New Order', allOrders: 'All Orders',
      noOrders: 'No orders yet', selectTable: 'Select Table',
      addToCart: 'Add to Cart', placeOrder: 'Place Order',
      // No data
      noData: 'No data available', noFoods: 'No foods found', noStaff: 'No staff found',
      // Cart & Order
      cart: 'CART', cartEmpty: 'No items selected yet', total: 'TOTAL',
      confirmOrder: 'CONFIRM ORDER', noteHint: 'Order note...',
      qtyLabel: 'items',
      // Invoice modal
      invoiceTitle: 'INVOICE DETAIL', tablePosition: 'Table',
      subtotal: 'Subtotal', serviceFee: 'Service Fee',
      downloadPdfBtn: 'Download PDF', closeInvoiceBtn: 'Close Invoice',
      // Checkout modal
      checkoutTitle: 'PAYMENT', orderLabel: 'Order',
      totalPayment: 'TOTAL DUE', paymentMethodLabel: 'Payment Method',
      cashBtn: '💵 Cash', transferBtn: '🏦 Bank Transfer (QR)',
      cashInputLabel: 'Customer cash (in thousands VND)',
      cashHint: '💡 System auto-multiplies by 1,000 VND',
      changeLabel: 'Change to return:', transferMode: 'Method: Bank Transfer',
      viewQR: 'View QR Code', cancelBtn: 'Cancel', confirmPayment: 'CONFIRM PAYMENT RECEIVED',
      // QR modal
      accountName: 'Account Name', amountLabel: 'AMOUNT TO TRANSFER', doneQR: 'SCAN COMPLETE',
    },
  }[lang];
  const toggleLang = () => {
    const next = lang === 'vi' ? 'en' : 'vi';
    setLang(next);
    localStorage.setItem('lang', next);
  };

  // 3) Sound Notification
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('soundEnabled') !== 'false');

  // KDS: ngưỡng cảnh báo món chậm + tự động chuyển trạng thái, để bếp đỡ phải chạm màn hình liên tục.
  // Lưu trong localStorage — áp dụng riêng cho từng máy/màn hình đang mở app (chưa đồng bộ qua backend).
  const [kdsSettings, setKdsSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kdsSettings') || 'null');
      return saved ? { ...KDS_SETTINGS_DEFAULT, ...saved } : { ...KDS_SETTINGS_DEFAULT };
    } catch { return { ...KDS_SETTINGS_DEFAULT }; }
  });
  const updateKdsSetting = (key, value) => {
    setKdsSettings(prev => {
      const next = { ...prev, [key]: Math.max(0, Number(value) || 0) };
      localStorage.setItem('kdsSettings', JSON.stringify(next));
      return next;
    });
  };

  const playNotifSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, start, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start); osc.stop(start + dur);
      };
      playBeep(880, ctx.currentTime, 0.15);
      playBeep(1100, ctx.currentTime + 0.18, 0.15);
      playBeep(1320, ctx.currentTime + 0.36, 0.2);
    } catch (e) { /* AudioContext not supported */ }
  }, [soundEnabled]);


  // Data States
  const [tables, setTables] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null); // null = đang xem danh mục; object = đang xem món của danh mục đó

  const [staff, setStaff] = useState([]);

  // Modal States
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [foodFormData, setFoodFormData] = useState({
    code: '', foodName: '', price: '', categoryId: '', imageUrl: '', options: ''
  });

  const [isProposeFoodModalOpen, setIsProposeFoodModalOpen] = useState(false);
  const [proposeFoodFormData, setProposeFoodFormData] = useState({
    code: '', foodName: '', price: '', categoryId: '', imageUrl: '', recipe: '', options: ''
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormData, setCategoryFormData] = useState({
    code: '', name: '', description: ''
  });

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffFormData, setStaffFormData] = useState({
    username: '', password: '', fullName: '', email: '', phoneNumber: '', birthday: '', role: 'WAITER', server: 'HCM', gender: 'MALE', citizenPid: ''
  });

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [tableFormData, setTableFormData] = useState({
    tableNumber: '', capacity: 4, location: ''
  });

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Create Order States
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]); // { menuItemId, foodName, unitPrice, quantity, note }
  const [selectedTableId, setSelectedTableId] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [selectedTableForOrders, setSelectedTableForOrders] = useState(null);
  const [selectedTableForQR, setSelectedTableForQR] = useState(null);

  // Order Options Popup States
  const [selectedFoodForOrder, setSelectedFoodForOrder] = useState(null);
  const [orderOptions, setOrderOptions] = useState({ ketchup: false, chili: false, mayo: false, spicy: false });
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderManualNote, setOrderManualNote] = useState('');

  // Checkout (Payment) States
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH or TRANSFER
  const [customerCash, setCustomerCash] = useState('');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const [loadingConfig, setLoadingConfig] = useState({
    overview: true, orders: false, foods: false, staff: false, tables: false, inventory: false, customers: false
  });

  // Tab "Tài khoản" (trước đây là "Nhân viên"): 2 sub-tab — nhân viên (giữ nguyên như cũ) và
  // khách hàng (mới, chỉ xem — không có form sửa/xoá khách nào).
  const [accountSubTab, setAccountSubTab] = useState('staff'); // 'staff' | 'customer'
  const [customers, setCustomers] = useState([]);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false);

  // Inventory States
  const [ingredients, setIngredients] = useState([]);
  // { [foodId]: string[] } -- tên các nguyên liệu đang ở mức cảnh báo (currentStock <= minStock) trong công thức của món đó.
  // Dùng để gợi ý cho admin món nào nên cân nhắc tắt bán / cần xác nhận thêm khi bật lại.
  const [foodLowStockMap, setFoodLowStockMap] = useState({});
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [inventoryTab, setInventoryTab] = useState('ingredients'); // 'ingredients' | 'recipes' | 'transactions'
  const [selectedMenuItemForRecipe, setSelectedMenuItemForRecipe] = useState(null);
  const [recipeItems, setRecipeItems] = useState([]); // [{ ingredientId: '', quantityNeeded: 0 }]
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showDeleteIngredientModal, setShowDeleteIngredientModal] = useState(false);
  const [deleteIngredientState, setDeleteIngredientState] = useState({ id: null, reason: '' });
  const [editingIngredient, setEditingIngredient] = useState(null);

  // Kitchen view recipe modal states
  const [isViewRecipeModalOpen, setIsViewRecipeModalOpen] = useState(false);
  const [viewingFoodItem, setViewingFoodItem] = useState(null);
  const [viewingRecipeIngredients, setViewingRecipeIngredients] = useState([]);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  const [isEditingRecipeText, setIsEditingRecipeText] = useState(false);
  const [pendingRecipeText, setPendingRecipeText] = useState('');
  const [isSubmittingRecipeProposal, setIsSubmittingRecipeProposal] = useState(false);

  const handleOpenViewRecipeModal = async (food) => {
    setViewingFoodItem(food);
    setIsViewRecipeModalOpen(true);
    setLoadingRecipe(true);
    setViewingRecipeIngredients([]);
    setIsEditingRecipeText(false);
    setPendingRecipeText(food.pendingRecipe || food.recipe || '');
    try {
      const res = await apiService.catalog.getRecipes(food.id);
      setViewingRecipeIngredients(res.data || []);
    } catch (err) {
      toast.error('Lỗi tải nguyên liệu định lượng: ' + err.message);
    } finally {
      setLoadingRecipe(false);
    }
  };

  const handleProposeRecipeUpdate = async () => {
    if (!pendingRecipeText || pendingRecipeText.trim() === '') {
      toast.error('Vui lòng nhập công thức chế biến mới');
      return;
    }
    setIsSubmittingRecipeProposal(true);
    try {
      await apiService.catalog.proposeRecipe(viewingFoodItem.id, pendingRecipeText);
      toast.success('Đã gửi đề xuất cập nhật công thức thành công, đang chờ Admin duyệt!');
      setIsEditingRecipeText(false);
      await fetchFoodsData();
      setIsViewRecipeModalOpen(false);
    } catch (err) {
      toast.error('Lỗi khi gửi đề xuất: ' + err.message);
    } finally {
      setIsSubmittingRecipeProposal(false);
    }
  };

  const handleApproveRecipeProposal = async (foodId) => {
    try {
      await apiService.catalog.approveRecipe(foodId);
      toast.success('Duyệt công thức mới thành công!');
      await fetchFoodsData();
    } catch (err) {
      toast.error('Lỗi khi duyệt công thức: ' + err.message);
    }
  };

  const handleRejectRecipeProposal = async (foodId) => {
    try {
      await apiService.catalog.rejectRecipe(foodId);
      toast.success('Đã từ chối đề xuất cập nhật công thức.');
      await fetchFoodsData();
    } catch (err) {
      toast.error('Lỗi khi từ chối đề xuất: ' + err.message);
    }
  };
  const [ingredientForm, setIngredientForm] = useState({ name: '', unit: '', minStock: '' });
  const [showStockTransactionModal, setShowStockTransactionModal] = useState(false);
  const [stockTxType, setStockTxType] = useState('IMPORT'); // 'IMPORT' | 'EXPORT_WASTE'
  const [stockTxForm, setStockTxForm] = useState({ ingredientId: '', quantity: '', price: '', reason: '' });
  const [searchIngredientQuery, setSearchIngredientQuery] = useState('');

  // WebSocket Connection for Real-time Tables
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const socket = new SockJS('http://localhost:8080/ws-tables');
    const stompClient = new Client({
      webSocketFactory: () => socket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: (str) => console.log('>>> [WS Debug Table]:', str),
      onConnect: () => {
        console.log('>>> WebSocket Connected to table-service');
        stompClient.subscribe('/topic/tables', (message) => {
          if (message.body === 'REFRESH_TABLES') {
            fetchTablesData();
            if (activeTab === 'Overview') fetchOverviewData();
            if (activeTab === 'Orders') fetchOrdersData();
          }
        });
      },
    });
    stompClient.activate();
    return () => { if (stompClient.active) stompClient.deactivate(); };
  }, [activeTab]);

  // WebSocket Connection for General Notifications
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const socket = new SockJS('http://localhost:8080/ws-notifications');
    const stompClient = new Client({
      webSocketFactory: () => socket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      debug: (str) => console.log('>>> [WS Debug Note]:', str),
      onConnect: () => {
        console.log('>>> WebSocket Connected to notification-service');
        stompClient.subscribe('/topic/public', (message) => {
          try {
            const note = JSON.parse(message.body);
            toast[note.type || 'info'](note.message || note.title);

            // Bỏ qua check activeTab để luôn fetch ngầm data mới nhất
            if (note.title?.includes('Đơn hàng') || note.title?.includes('Thanh toán')) {
              fetchOrdersData();
              fetchOverviewData();
              fetchInventoryData();
              if (user?.role === 'KITCHEN' || user?.role === 'ADMIN') {
                fetchKitchenData();
                if (note.title?.includes('Đơn hàng')) {
                  toast.info('🔔 Có món mới cần chế biến!');
                  playNotifSound();
                }
              }
            }
          } catch (e) { console.error('Error parsing notification:', e); }
        });
      },
    });
    stompClient.activate();
    return () => { if (stompClient.active) stompClient.deactivate(); };
  }, []); // Bỏ dependency activeTab để tránh reconnect liên tục khi chuyển tab

  // 4) Auto-refresh mỗi 30s — dữ liệu luôn cập nhật mà không cần F5
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'Overview') fetchOverviewData();
      else if (activeTab === 'Orders') fetchOrdersData();
      else if (activeTab === 'Kitchen') fetchKitchenData();
      else if (activeTab === 'Inventory') fetchInventoryData();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Overview',   display: t.overview,  roles: ['ADMIN'] },
    { icon: <ClipboardList size={20} />,  label: 'Orders',     display: t.orders,    roles: ['ADMIN', 'WAITER'] },
    { icon: <LayoutDashboard size={20} />,label: 'Tables',     display: t.tables,    roles: ['ADMIN', 'WAITER'] },
    { icon: <Utensils size={20} />,       label: 'Kitchen',    display: t.kitchen,   roles: ['ADMIN', 'KITCHEN'] },
    { icon: <Utensils size={20} />,       label: 'Menu & Food',display: t.menu,      roles: ['ADMIN', 'KITCHEN'] },
    { icon: <Users size={20} />,          label: 'Staff',      display: t.accounts,  roles: ['ADMIN'] },
    { icon: <Package size={20} />,        label: 'Inventory',  display: t.inventory, roles: ['ADMIN'] },
    { icon: <PieChartIcon size={20} />,   label: 'Reports',    display: t.reports,   roles: ['ADMIN'] },
    { icon: <Settings size={20} />,       label: 'Settings',   display: t.settings,  roles: ['ADMIN', 'WAITER', 'KITCHEN'] },
    { icon: <UserIcon size={20} />,       label: 'Profile',    display: t.profile,   roles: ['ADMIN', 'WAITER', 'KITCHEN'] },
  ];

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || 'USER'));

  // Validate active tab on role change or mount
  useEffect(() => {
    const isTabAllowed = filteredNavItems.some(item => item.label === activeTab);
    if (!isTabAllowed && filteredNavItems.length > 0) {
      setActiveTab(filteredNavItems[0].label);
    }
  }, [user?.role, filteredNavItems, activeTab]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'Overview') fetchOverviewData();
    else if (activeTab === 'Orders') fetchOrdersData();
    else if (activeTab === 'Tables') fetchTablesData();
    else if (activeTab === 'Menu & Food') fetchFoodsData();
    else if (activeTab === 'Staff') fetchStaffData();
    else if (activeTab === 'Kitchen') {
      fetchKitchenData();
      // Cần foods + categories để nhóm món theo khu bếp trên KDS; tải nếu chưa có (vd. tài khoản Bếp đăng nhập vào thẳng tab này).
      if (foods.length === 0) fetchFoodsData();
    }
    else if (activeTab === 'Inventory') fetchInventoryData();
  }, [activeTab]);

  // Tab "Tài khoản" > sub-tab "Khách hàng": tải danh sách khách khi chuyển sang sub-tab này lần đầu.
  useEffect(() => {
    if (activeTab === 'Staff' && accountSubTab === 'customer' && customers.length === 0) {
      fetchCustomersData();
    }
  }, [activeTab, accountSubTab]);

  const [reportSubTab, setReportSubTab] = useState('REVENUE'); // 'REVENUE' | 'COMPARISON'
  const [compDate, setCompDate] = useState(() => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
  });
  const [compShift, setCompShift] = useState('ALL');
  const [compPeriod, setCompPeriod] = useState('DAY');
  const [compData, setCompData] = useState(null);
  const [loadingComp, setLoadingComp] = useState(false);

  const fetchComparisonData = async (date = compDate, shift = compShift, period = compPeriod) => {
    setLoadingComp(true);
    try {
      const res = await apiService.order.getComparisonReport(date, shift, period);
      setCompData(res.data || null);
    } catch (error) {
      toast.error('Lỗi tải báo cáo đối soát: ' + error.message);
      setCompData(null);
    } finally {
      setLoadingComp(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Reports') {
      if (reportSubTab === 'REVENUE') fetchReportData();
      else if (reportSubTab === 'COMPARISON') fetchComparisonData(compDate, compShift, compPeriod);
    }
  }, [activeTab, reportSubTab, compDate, compShift, compPeriod]);

  const [reportData, setReportData] = useState([]);
  const [reportType, setReportType] = useState('DAY');

  const fetchReportData = async (type = reportType) => {
    setLoadingConfig(prev => ({ ...prev, reports: true }));
    try {
      const res = await apiService.order.getReports(type);
      console.log(`>>> [REPORT DEBUG] Type: ${type}, Body:`, res);
      setReportData(res.data || []);
      setReportType(type);
    } catch (error) {
      toast.error('Lỗi tải báo cáo: ' + error.message);
    } finally {
      setLoadingConfig(prev => ({ ...prev, reports: false }));
    }
  };

  const [kitchenItems, setKitchenItems] = useState([]);

  // --- KDS: chế độ xem, lọc theo khu bếp, chế độ Kiosk toàn màn hình ---
  const [kitchenViewMode, setKitchenViewMode] = useState('table'); // 'table' | 'status'
  const [kitchenCategoryFilter, setKitchenCategoryFilter] = useState('ALL');
  const [kdsKioskMode, setKdsKioskMode] = useState(false);
  const kdsWakeLockRef = useRef(null);

  // Ghép món trong bếp với danh mục món ăn (khu bếp) dựa trên tên món.
  // Ghi chú: OrderItemResponse hiện chỉ trả về foodName, chưa có categoryId/menuItemId,
  // nên đây là cách ghép tạm qua tên món. Nếu backend bổ sung categoryId vào OrderItemResponse
  // thì nên ghép trực tiếp bằng id để chính xác tuyệt đối (tránh trùng tên món ở danh mục khác).
  const kitchenItemsWithCategory = useMemo(() => {
    const foodCategoryMap = new Map();
    (foods || []).forEach(f => {
      const catName = (categories || []).find(c => c.id === f.categoryId)?.name;
      if (catName) foodCategoryMap.set(f.foodName, catName);
    });
    return kitchenItems.map(item => ({ ...item, stationName: foodCategoryMap.get(item.foodName) || null }));
  }, [kitchenItems, foods, categories]);

  const kitchenCategoryOptions = useMemo(() => {
    const set = new Set();
    kitchenItemsWithCategory.forEach(i => { if (i.stationName) set.add(i.stationName); });
    return ['ALL', ...Array.from(set).sort()];
  }, [kitchenItemsWithCategory]);

  useEffect(() => {
    if (!kitchenCategoryOptions.includes(kitchenCategoryFilter)) setKitchenCategoryFilter('ALL');
  }, [kitchenCategoryOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleKitchenItems = useMemo(() => {
    if (kitchenCategoryFilter === 'ALL') return kitchenItemsWithCategory;
    return kitchenItemsWithCategory.filter(i => i.stationName === kitchenCategoryFilter);
  }, [kitchenItemsWithCategory, kitchenCategoryFilter]);

  // Bật/tắt chế độ Kiosk: toàn màn hình + giữ màn hình tablet không tắt (Wake Lock).
  const enterKitchenKiosk = async () => {
    setKdsKioskMode(true);
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch (e) { console.warn('Không thể bật toàn màn hình:', e); }
    try {
      if ('wakeLock' in navigator) kdsWakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (e) { console.warn('Không thể giữ màn hình sáng (Wake Lock):', e); }
  };
  const exitKitchenKiosk = () => {
    setKdsKioskMode(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (kdsWakeLockRef.current) { kdsWakeLockRef.current.release().catch(() => {}); kdsWakeLockRef.current = null; }
  };
  useEffect(() => {
    const handleFsChange = () => { if (!document.fullscreenElement) setKdsKioskMode(false); };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const fetchKitchenData = async () => {
    setLoadingConfig(prev => ({ ...prev, kitchen: true }));
    try {
      // Lấy đơn PENDING, CONFIRMED và ORDERING, flatten items để bếp thấy từng món.
      // ORDERING = bàn đang ăn, vẫn có thể gọi thêm món — PHẢI lấy luôn, nếu không món gọi thêm
      // ở bàn đang ORDERING vẫn tính tiền bình thường nhưng bếp sẽ không thấy để chế biến.
      const [pendingRes, confirmedRes, orderingRes] = await Promise.allSettled([
        apiService.kitchen.getPendingOrders(),
        apiService.kitchen.getConfirmedOrders(),
        apiService.kitchen.getOrderingOrders(),
      ]);

      const orders = [
        ...(pendingRes.status === 'fulfilled' ? (pendingRes.value.data || []) : []),
        ...(confirmedRes.status === 'fulfilled' ? (confirmedRes.value.data || []) : []),
        ...(orderingRes.status === 'fulfilled' ? (orderingRes.value.data || []) : []),
      ];

      // Flatten: mỗi item giữ thông tin đơn (bàn, orderId, orderStatus)
      const flatItems = orders.flatMap(order => {
        const table = tables.find(t => String(t.id) === String(order.tableId));
        const tableName = table ? `Bàn ${table.tableNumber}` : (order.tableNumber || order.tableId || '—');

        return (order.items || []).map(item => ({
          ...item,
          tableNumber: tableName,
          orderId: order.id,
          orderStatus: order.status,
          createdAt: order.createdAt,
        }));
      }).filter(item => item.kitchenStatus !== 'SERVED');

      setKitchenItems(flatItems);
    } catch (error) { console.error('Error fetching kitchen data:', error); }
    finally { setLoadingConfig(prev => ({ ...prev, kitchen: false })); }
  };

  const handleUpdateItemStatus = async (itemId, newStatus) => {
    try {
      await apiService.kitchen.updateItemStatus(itemId, newStatus);
      const labels = { COOKING: 'đang nấu', READY: 'sẵn sàng', SERVED: 'đã phục vụ' };
      toast.success(`Cập nhật món → ${labels[newStatus] || newStatus}`);
      fetchKitchenData();
    } catch (error) { toast.error('Lỗi cập nhật: ' + error.message); }
  };

  // Waiter xác nhận đã mang món ra bàn (READY -> SERVED) — thao tác này nằm ở tab Orders vì
  // WAITER không có quyền vào tab Kitchen, và về nghiệp vụ đây đúng là việc của phục vụ chứ không phải bếp.
  const handleServeItem = async (itemId, foodName) => {
    try {
      await apiService.kitchen.updateItemStatus(itemId, 'SERVED');
      toast.success(`🛎️ Đã trả món: ${foodName}`);
      fetchOrdersData();
    } catch (error) { toast.error('Lỗi cập nhật: ' + error.message); }
  };

  const handleCompleteAllItems = async (items) => {
    try {
      const pendingAndCooking = items.filter(i => i.kitchenStatus === 'PENDING' || i.kitchenStatus === 'COOKING');
      if (pendingAndCooking.length === 0) return;
      await Promise.all(pendingAndCooking.map(item => 
        apiService.kitchen.updateItemStatus(item.id, 'READY')
      ));
      toast.success(`Đã hoàn thành ${pendingAndCooking.length} món`);
      fetchKitchenData();
    } catch (error) { toast.error('Lỗi cập nhật: ' + error.message); }
  };

  // --- KDS: tự động chuyển trạng thái món theo thời gian (nếu bật trong Settings) ---
  // Mục tiêu: giảm số lần bếp phải chạm màn hình liên tục trong lúc tay đang bận nấu.
  const kdsCookStartRef = useRef(new Map()); // itemId -> mốc thời gian (ước lượng phía client) khi món bắt đầu COOKING
  const kdsAutoTransitionInFlightRef = useRef(new Set());

  useEffect(() => {
    // Chỉ dùng để ước lượng thời điểm bắt đầu nấu cho logic tự-động-Sẵn-sàng bên dưới —
    // KHÔNG dùng cho đồng hồ hiển thị trên vé (đồng hồ hiển thị vẫn tính theo giờ tạo đơn, đúng nghĩa "khách đã chờ bao lâu").
    const next = new Map();
    kitchenItems.forEach(item => {
      if (item.kitchenStatus === 'COOKING') {
        next.set(item.id, kdsCookStartRef.current.get(item.id) || Date.now());
      }
    });
    kdsCookStartRef.current = next;
  }, [kitchenItems]);

  useEffect(() => {
    if (kdsSettings.autoStartMinutes <= 0 && kdsSettings.autoReadyMinutes <= 0) return;
    kitchenItems.forEach(item => {
      if (kdsAutoTransitionInFlightRef.current.has(item.id)) return;

      if (kdsSettings.autoStartMinutes > 0 && item.kitchenStatus === 'PENDING' && item.createdAt) {
        const waitedMs = timeTicker - new Date(item.createdAt).getTime();
        if (waitedMs >= kdsSettings.autoStartMinutes * 60000) {
          kdsAutoTransitionInFlightRef.current.add(item.id);
          apiService.kitchen.updateItemStatus(item.id, 'COOKING')
            .then(() => {
              toast.info(`⏱️ Tự động bắt đầu nấu: ${item.foodName}`);
              // In phiếu ngay lúc này để bếp không bị "quên" món tự động chuyển mà không ai bấm tay.
              if (kdsSettings.autoPrintOnCooking) printKitchenTicket(item);
              fetchKitchenData();
            })
            .catch(() => {})
            .finally(() => kdsAutoTransitionInFlightRef.current.delete(item.id));
          return;
        }
      }

      if (kdsSettings.autoReadyMinutes > 0 && item.kitchenStatus === 'COOKING') {
        const cookStart = kdsCookStartRef.current.get(item.id) || (item.createdAt ? new Date(item.createdAt).getTime() : timeTicker);
        if (timeTicker - cookStart >= kdsSettings.autoReadyMinutes * 60000) {
          kdsAutoTransitionInFlightRef.current.add(item.id);
          apiService.kitchen.updateItemStatus(item.id, 'READY')
            .then(() => { toast.info(`✅ Tự động chuyển Sẵn sàng: ${item.foodName}`); fetchKitchenData(); })
            .catch(() => {})
            .finally(() => kdsAutoTransitionInFlightRef.current.delete(item.id));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTicker, kdsSettings.autoStartMinutes, kdsSettings.autoReadyMinutes]);

  const fetchOverviewData = async () => {
    setLoadingConfig(prev => ({ ...prev, overview: true }));
    try {
      const [ordersRes, tablesRes, foodsRes] = await Promise.allSettled([
        apiService.order.getAll(),
        apiService.dashboard.getTables(),
        apiService.catalog.getItems(true)
      ]);

      console.log('Orders Response:', ordersRes);
      console.log('Tables Response:', tablesRes);
      console.log('Foods Response:', foodsRes);

      if (ordersRes.status === 'fulfilled' && ordersRes.value.data) {
        const ordersArr = Array.isArray(ordersRes.value.data) ? ordersRes.value.data : (ordersRes.value.data.content || []);

        // Làm giàu dữ liệu tên bàn
        const enrichedOrders = ordersArr.map(order => {
          const table = (tablesRes.status === 'fulfilled' && tablesRes.value.data)
            ? (Array.isArray(tablesRes.value.data) ? tablesRes.value.data : tablesRes.value.data.content).find(t => String(t.id) === String(order.tableId))
            : null;
          return {
            ...order,
            tableNumber: table ? `Bàn ${table.tableNumber}` : (order.tableNumber || order.tableId)
          };
        });

        setRecentOrders(enrichedOrders.slice(0, 5));
        setAllOrders(enrichedOrders);
      }
      if (tablesRes.status === 'fulfilled' && tablesRes.value.data) {
        const tablesArr = Array.isArray(tablesRes.value.data) ? tablesRes.value.data : (tablesRes.value.data.content || []);
        setTables(tablesArr);
      }
      if (foodsRes.status === 'fulfilled' && foodsRes.value.data) {
        const foodsArr = Array.isArray(foodsRes.value.data) ? foodsRes.value.data : (foodsRes.value.data.content || []);
        setFoods(foodsArr);
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu tổng quan:', error);
    } finally {
      setLoadingConfig(prev => ({ ...prev, overview: false }));
    }
  };



  const fetchOrdersData = async (statusFilter) => {
    // Đảm bảo statusFilter là chuỗi, nếu là Object (Event) thì coi như null
    const finalStatus = (statusFilter && typeof statusFilter === 'string') ? statusFilter : null;

    setLoadingConfig(prev => ({ ...prev, orders: true }));
    try {
      const res = await apiService.order.getAll(finalStatus);
      if (res.data) {
        const enrichedOrders = res.data.map(order => {
          const table = tables.find(t => String(t.id) === String(order.tableId));
          return {
            ...order,
            tableNumber: table ? `Bàn ${table.tableNumber}` : (order.tableNumber || order.tableId)
          };
        });
        setAllOrders(enrichedOrders);
      }
    } catch (error) { toast.error('Không thể tải đơn hàng: ' + error.message); }
    finally { setLoadingConfig(prev => ({ ...prev, orders: false })); }
  };

  const handleCancelOrder = async (orderId) => {
    const ok = await confirm('Hủy đơn hàng', 'Bạn có chắc muốn hủy đơn hàng này không?', { danger: true, confirmLabel: 'Hủy đơn' });
    if (!ok) return;
    try {
      await apiService.order.cancel(orderId);
      toast.success('Đã hủy đơn hàng');
      fetchOrdersData();
    } catch (e) { toast.error('Lỗi hủy đơn: ' + e.message); }
  };

  // Tự động hủy tất cả đơn rỗng (không có items) của bàn
  const handleCleanupEmptyOrders = async (tableId) => {
    const emptyOrders = allOrders.filter(o =>
      String(o.tableId) === String(tableId) &&
      (o.status === 'PENDING' || o.status === 'CONFIRMED') &&
      (!o.items || o.items.length === 0)
    );
    if (emptyOrders.length === 0) return;
    try {
      await Promise.all(emptyOrders.map(o => apiService.order.cancel(o.id)));
      await fetchOrdersData();
      console.log(`[CLEANUP] Đã dọn ${emptyOrders.length} đơn rỗng của bàn ${tableId}`);
    } catch (e) {
      console.error('Lỗi khi dọn đơn rỗng:', e.message);
    }
  };

  // Tự động kích hoạt dọn dẹp khi người dùng click xem 1 bàn
  useEffect(() => {
    if (selectedTableForOrders && selectedTableForOrders.id) {
      handleCleanupEmptyOrders(selectedTableForOrders.id);
    }
  }, [selectedTableForOrders?.id, allOrders.length]);


  const handleRemoveItemFromOrder = async (orderId, itemId, itemName, kitchenStatus) => {
    if (kitchenStatus && kitchenStatus !== 'PENDING') {
      toast.warning(`Không thể xóa "${itemName}" vì bếp đã nhận (${kitchenStatus}).`);
      return;
    }
    const ok = await confirm('Xóa món', `Bạn có chắc muốn xóa "${itemName}" khỏi hóa đơn?`, { danger: true, confirmLabel: 'Xóa món' });
    if (!ok) return;
    try {
      await apiService.order.removeItem(orderId, itemId);
      toast.success(`Đã xóa "${itemName}" khỏi hóa đơn`);
      fetchOrdersData();
    } catch (e) { toast.error('Lỗi xóa món: ' + e.message); }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await apiService.order.updateStatus(orderId, status);
      const labels = { CONFIRMED: 'Đã xác nhận', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy' };
      toast.success(`Đơn hàng → ${labels[status] || status}`);
      fetchOrdersData();
    } catch (e) { toast.error('Lỗi cập nhật đơn: ' + e.message); }
  };

  // ---- Logic Gọi Món (Create Order) ----
  useEffect(() => {
    if (isCreateOrderModalOpen) {
      // Đảm bảo luôn có dữ liệu bàn và món ăn mới nhất khi mở Modal
      fetchTablesData();
      fetchFoodsData();
    }
  }, [isCreateOrderModalOpen]);

  const openOrderOptionsModal = (food) => {
    setSelectedFoodForOrder(food);
    const dynamicOptions = {};
    if (food.options) {
      food.options.split(',').forEach(opt => {
        const trimmed = opt.trim();
        if (trimmed) dynamicOptions[trimmed] = false;
      });
    }
    setOrderOptions(dynamicOptions);
    setOrderQuantity(1);
    setOrderManualNote('');
  };

  const confirmAddToCart = () => {
    if (!selectedFoodForOrder) return;
    
    const options = Object.keys(orderOptions).filter(key => orderOptions[key]);
    
    const manualNote = orderManualNote.trim();
    let finalNote = '';
    if (options.length > 0) finalNote += "Tuỳ chọn: " + options.join(", ");
    if (manualNote) finalNote += (finalNote ? " | " : "") + "Ghi chú: " + manualNote;

    setCartItems(prev => {
      const existing = prev.find(item => item.menuItemId === selectedFoodForOrder.id && (item.note || '') === (finalNote || ''));
      if (existing) {
        return prev.map(item => (item.menuItemId === selectedFoodForOrder.id && (item.note || '') === (finalNote || ''))
          ? { ...item, quantity: item.quantity + orderQuantity } 
          : item);
      }
      return [...prev, { 
        menuItemId: selectedFoodForOrder.id, 
        foodName: selectedFoodForOrder.foodName, 
        unitPrice: selectedFoodForOrder.price, 
        quantity: orderQuantity, 
        note: finalNote 
      }];
    });
    
    setSelectedFoodForOrder(null);
  };

  const handleUpdateCartItem = (menuItemId, currentNote, delta, newNote = undefined) => {
    setCartItems(prev => prev.map(item => {
      if (item.menuItemId !== menuItemId || (item.note || '') !== (currentNote || '')) return item;
      const updated = { ...item };
      if (delta !== 0) updated.quantity = Math.max(1, updated.quantity + delta);
      if (newNote !== undefined) updated.note = newNote;
      return updated;
    }));
  };

  const handleRemoveFromCart = (menuItemId, note) => {
    setCartItems(prev => prev.filter(item => !(item.menuItemId === menuItemId && (item.note || '') === (note || ''))));
  };

  const handleSubmitOrder = async () => {
    if (!selectedTableId) {
      toast.error('Vui lòng chọn bàn!');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Giỏ hàng trống, vui lòng chọn món!');
      return;
    }

    try {
      const selectedTable = tables.find(t => String(t.id) === String(selectedTableId));

      // Kiểm tra xem bàn này đã có đơn hàng nào đang hoạt động chưa (PENDING/CONFIRMED/ORDERING).
      // Trước đây thiếu ORDERING nên bàn đang ăn (ORDERING) gọi thêm món sẽ bị tạo NHẦM thành đơn mới
      // thay vì cộng vào đơn cũ — khiến bếp không thấy món mới dù tiền vẫn được tính đúng.
      const existingOrder = allOrders.find(o =>
        String(o.tableId) === String(selectedTableId) &&
        (o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'ORDERING')
      );

      if (existingOrder) {
        // TRƯỜNG HỢP 1: THÊM MÓN VÀO ĐƠN HIỆN CÓ
        toast.info('Đang thêm món vào đơn hiện có của bàn...');
        for (const item of cartItems) {
          await apiService.order.addItem(existingOrder.id, item);
        }
        toast.success('🎉 Đã thêm món vào đơn thành công!');
      } else {
        // TRƯỜNG HỢP 2: TẠO ĐƠN HÀNG MỚI (MỞ BÀN)
        const payload = {
          tableId: selectedTable.id,
          tableNumber: selectedTable.tableNumber || selectedTable.id,
          note: orderNote,
          items: cartItems
        };
        await apiService.order.create(payload);
        toast.success('🎉 Đã tạo đơn hàng thành công!');
      }

      // Cleanup & Refresh
      setIsCreateOrderModalOpen(false);
      setCartItems([]);
      setSelectedTableId('');
      setOrderNote('');
      fetchOrdersData();
    } catch (err) {
      toast.error('Lỗi khi tạo đơn hàng: ' + err.message);
    }
  };

  // ---- Logic Thanh Toán (Checkout) ----
  // ---- Logic Thanh Toán (Checkout) ----
  const handleOpenCheckout = (tableId) => {
    // Lấy tất cả đơn hàng đang hoạt động của bàn này
    const tableOrders = allOrders.filter(o =>
      String(o.tableId) === String(tableId) &&
      (o.status === 'PENDING' || o.status === 'CONFIRMED')
    );

    if (tableOrders.length === 0) {
      toast.error('Bàn này không có đơn hàng nào cần thanh toán!');
      return;
    }

    const totalAmount = tableOrders.reduce((sum, o) => sum + (o.totalAmount || o.totalPrice || 0), 0);

    // Tạo một "đơn hàng ảo" để hiển thị trong modal thanh toán
    setCheckoutOrder({
      id: tableOrders[0].id, // Dùng ID đơn đầu làm đại diện
      tableId: tableId,
      tableNumber: tableOrders[0].tableNumber,
      totalAmount: totalAmount,
      orderIds: tableOrders.map(o => o.id) // Lưu danh sách ID để hoàn tất hàng loạt
    });

    setPaymentMethod('CASH');
    setCustomerCash('');
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (paymentMethod === 'CASH' && checkoutOrder) {
      const total = Number(checkoutOrder.totalAmount || 0);
      const cash = Number(customerCash.replace(/\D/g, '') || 0) * 1000;
      if (cash < total) {
        toast.error('Tiền khách đưa không đủ để thanh toán!');
        return;
      }
    }

    try {
      // 1. Lưu lịch sử thanh toán vào payment-service (Tổng số tiền của tất cả đơn)
      await apiService.payment.create({
        orderId: checkoutOrder.id,
        amount: checkoutOrder.totalAmount,
        method: paymentMethod,
        note: paymentMethod === 'CASH' ? `Khách đưa: ${Number(customerCash) * 1000}đ (Thanh toán gộp bàn ${checkoutOrder.tableNumber})` : 'Thanh toán chuyển khoản VietQR'
      });

      // 2. Cập nhật tất cả các đơn hàng của bàn này sang COMPLETED
      for (const orderId of checkoutOrder.orderIds) {
        await handleUpdateOrderStatus(orderId, 'COMPLETED');
      }

      toast.success(`🎉 Thanh toán thành công cho bàn ${checkoutOrder.tableNumber}!`);
      setIsCheckoutModalOpen(false);
      setCheckoutOrder(null);
      setCustomerCash('');
      fetchOverviewData(); // Refresh overview numbers
    } catch (error) {
      toast.error('❌ Lỗi thanh toán: ' + error.message);
      console.error('Payment Error:', error);
    }
  };
  // ------------------------------------

  const fetchFoodsData = async () => {
    setLoadingConfig(prev => ({ ...prev, foods: true }));
    try {
      const [itemsRes, catsRes, ingRes] = await Promise.all([
        // true -> admin thấy cả món đang tắt bán (INACTIVE) và món chờ duyệt (PENDING) để còn quản lý được
        apiService.catalog.getItems(true),
        apiService.catalog.getCategories(),
        apiService.catalog.getIngredients(),
      ]);
      if (itemsRes.data) setFoods(itemsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
      if (ingRes.data) setIngredients(ingRes.data || []);
    } catch (error) { toast.error('Không thể tải thực đơn: ' + error.message); }
    finally { setLoadingConfig(prev => ({ ...prev, foods: false })); }
  };

  // Khi admin mở xem 1 danh mục ở tab Menu & Food, tính sẵn cảnh báo nguyên liệu cho từng món
  // trong danh mục đó (dựa trên công thức + tồn kho hiện có) để gợi ý món nào nên cân nhắc tắt bán.
  useEffect(() => {
    if (activeTab !== 'Menu & Food' || !selectedCategory) return;
    const catFoodIds = foods
      .filter(f => f.categoryId === selectedCategory.id && f.status !== 2)
      .map(f => f.id);
    if (catFoodIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(catFoodIds.map(async (foodId) => {
          try {
            const res = await apiService.catalog.getRecipes(foodId);
            const recipeItems = res.data || [];
            const lowNames = recipeItems
              .map(r => ingredients.find(ing => ing.id === r.ingredientId))
              .filter(ing => ing && Number(ing.currentStock) <= Number(ing.minStock))
              .map(ing => ing.name);
            return [foodId, lowNames];
          } catch {
            return [foodId, []];
          }
        }));
        if (!cancelled) {
          setFoodLowStockMap(prev => ({ ...prev, ...Object.fromEntries(entries) }));
        }
      } catch {
        // Không chặn UI nếu tính cảnh báo thất bại — chỉ đơn giản là không hiện badge.
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, selectedCategory, foods, ingredients]);

  const fetchStaffData = async () => {
    setLoadingConfig(prev => ({ ...prev, staff: true }));
    try {
      const res = await apiService.dashboard.getStaff();
      if (res.data) setStaff(res.data);
    } catch (error) {
      toast.error('Không thể tải danh sách nhân viên: ' + error.message);
    } finally {
      setLoadingConfig(prev => ({ ...prev, staff: false }));
    }
  };

  // Sub-tab "Khách hàng" trong "Tài khoản" — chỉ xem, không có hàm sửa/xoá khách nào.
  const fetchCustomersData = async () => {
    setLoadingConfig(prev => ({ ...prev, customers: true }));
    try {
      const res = await apiService.loyalty.adminListCustomers();
      if (res.data) setCustomers(res.data);
    } catch (error) {
      toast.error('Không thể tải danh sách khách hàng: ' + error.message);
    } finally {
      setLoadingConfig(prev => ({ ...prev, customers: false }));
    }
  };

  const openCustomerDetail = async (customerId) => {
    setShowCustomerDetailModal(true);
    setCustomerDetailLoading(true);
    setCustomerDetail(null);
    try {
      const [customerRes, historyRes] = await Promise.all([
        apiService.loyalty.adminGetCustomer(customerId),
        apiService.loyalty.adminGetCustomerPointsHistory(customerId),
      ]);
      setCustomerDetail({ ...(customerRes.data || {}), pointsHistory: historyRes.data || [] });
    } catch (error) {
      toast.error('Không thể tải chi tiết khách hàng: ' + error.message);
      setShowCustomerDetailModal(false);
    } finally {
      setCustomerDetailLoading(false);
    }
  };

  const fetchTablesData = async () => {
    setLoadingConfig(prev => ({ ...prev, tables: true }));
    try {
      const res = await apiService.dashboard.getTables();
      if (res.data) setTables(res.data);
    } catch (error) {
      toast.error('Không thể tải danh sách bàn: ' + error.message);
    } finally {
      setLoadingConfig(prev => ({ ...prev, tables: false }));
    }
  };

  const fetchInventoryData = async () => {
    setLoadingConfig(prev => ({ ...prev, inventory: true }));
    try {
      const ingRes = await apiService.catalog.getIngredients();
      setIngredients(ingRes.data || []);
      const txRes = await apiService.catalog.getTransactions();
      setInventoryTransactions(txRes.data || []);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu kho: ' + error.message);
    } finally {
      setLoadingConfig(prev => ({ ...prev, inventory: false }));
    }
  };

  const handleSaveIngredient = async (e) => {
    e.preventDefault();
    try {
      if (editingIngredient) {
        await apiService.catalog.updateIngredient(editingIngredient.id, ingredientForm);
        toast.success('Cập nhật nguyên liệu thành công');
      } else {
        await apiService.catalog.createIngredient(ingredientForm);
        toast.success('Thêm nguyên liệu thành công');
      }
      setShowIngredientModal(false);
      setEditingIngredient(null);
      setIngredientForm({ name: '', unit: '', minStock: '' });
      fetchInventoryData();
    } catch (err) {
      toast.error('Lỗi lưu nguyên liệu: ' + err.message);
    }
  };

  const confirmDeleteIngredient = async (e) => {
    if (e) e.preventDefault();
    try {
      await apiService.catalog.deleteIngredient(deleteIngredientState.id, deleteIngredientState.reason);
      toast.success('Đã xóa nguyên liệu và lưu lý do');
      setShowDeleteIngredientModal(false);
      fetchInventoryData();
    } catch (err) {
      toast.error('Lỗi xóa nguyên liệu: ' + err.message);
    }
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ingredientId: stockTxForm.ingredientId,
        quantity: parseFloat(stockTxForm.quantity),
        price: stockTxType === 'IMPORT' ? parseFloat(stockTxForm.price || 0) : 0,
        reason: stockTxForm.reason
      };
      if (stockTxType === 'IMPORT') {
        await apiService.catalog.importStock(payload);
        toast.success('Nhập kho thành công');
      } else {
        await apiService.catalog.exportStock(payload);
        toast.success('Xuất hủy kho thành công');
      }
      setShowStockTransactionModal(false);
      setStockTxForm({ ingredientId: '', quantity: '', price: '', reason: '' });
      fetchInventoryData();
    } catch (err) {
      toast.error('Lỗi giao dịch: ' + err.message);
    }
  };

  const handleSelectMenuItemForRecipe = async (menuItem) => {
    setSelectedMenuItemForRecipe(menuItem);
    try {
      const res = await apiService.catalog.getRecipes(menuItem.id);
      setRecipeItems(res.data.map(item => ({
        ingredientId: item.ingredientId,
        quantityNeeded: item.quantityNeeded
      })) || []);
    } catch (err) {
      toast.error('Lỗi tải công thức định lượng: ' + err.message);
    }
  };

  const handleSaveRecipe = async () => {
    if (!selectedMenuItemForRecipe) return;
    try {
      await apiService.catalog.updateRecipes(selectedMenuItemForRecipe.id, recipeItems);
      toast.success('Lưu công thức định lượng thành công');
    } catch (err) {
      toast.error('Lỗi lưu công thức định lượng: ' + err.message);
    }
  };

  const handleOpenTableModal = (table = null) => {
    if (table) {
      setEditingTable(table);
      setTableFormData({
        tableNumber: table.tableNumber || '',
        capacity: table.capacity || 4,
        location: table.location || ''
      });
    } else {
      setEditingTable(null);
      setTableFormData({ tableNumber: '', capacity: 4, location: '' });
    }
    setIsTableModalOpen(true);
  };

  const handleSaveTable = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...tableFormData,
        tableNumber: parseInt(tableFormData.tableNumber),
        capacity: parseInt(tableFormData.capacity)
      };

      if (editingTable) {
        await apiService.dashboard.updateTable(editingTable.id, payload);
        toast.success('Cập nhật bàn thành công');
      } else {
        await apiService.dashboard.createTable(payload);
        toast.success('Thêm bàn mới thành công');
      }
      setIsTableModalOpen(false);
      fetchTablesData();
    } catch (err) {
      toast.error('Lỗi lưu thông tin bàn: ' + err.message);
    }
  };

  const handleDeleteTable = async (id) => {
    const ok = await confirm('Xóa bàn', 'Bạn có chắc chắn muốn xóa bàn này không?', { danger: true, confirmLabel: 'Xóa bàn' });
    if (!ok) return;
    try {
      await apiService.dashboard.deleteTable(id);
      toast.success('Đã xóa bàn');
      fetchTablesData();
    } catch (err) {
      toast.error('Lỗi xóa bàn: ' + err.message);
    }
  };

  const statCards = (() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayCompletedOrders = allOrders.filter(o => {
      if (o.status !== 'COMPLETED') return false;
      const createdAt = o.createdAt ? new Date(o.createdAt) : null;
      return createdAt && createdAt >= todayStart && createdAt <= todayEnd;
    });

    const todayRevenue = todayCompletedOrders.reduce((acc, o) => acc + (o.totalAmount || o.totalPrice || 0), 0);
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    return [
      {
        title: 'Doanh Thu Hôm Nay',
        value: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(todayRevenue),
        change: todayStr,
        positive: true
      },
      { title: 'Total Orders', value: allOrders.length || 0, change: 'All time', positive: true },
      { title: 'Total Menu Items', value: foods.length || 0, change: 'Active', positive: true },
      {
        title: 'Total Tables',
        value: tables.length || 0,
        change: `${tables.filter(t => String(t.status).toUpperCase() === 'OCCUPIED' || String(t.status) === '1').length} Occupied`,
        positive: true
      },
    ];
  })();

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'var(--status-completed)';
      case 'CONFIRMED': return 'var(--status-ordering)';
      case 'PENDING': return '#f59e0b';  // amber
      case 'CANCELLED': return 'var(--status-cancelled)';
      case 'ORDERING': return 'var(--status-ordering)';
      default: return 'var(--text-secondary)';
    }
  };

  // ---- PDF Export ----
  const handleDownloadInvoicePDF = () => {
    if (!selectedInvoice) return;

    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const pageW = doc.internal.pageSize.getWidth();
    const fmt = (v) => new Intl.NumberFormat('vi-VN').format(v) + 'đ';
    const orderId = 'ORD-' + String(selectedInvoice.id).slice(0, 8).toUpperCase();
    const tableName = selectedInvoice.tableNumber || selectedInvoice.tableId || 'N/A';
    const dateStr = new Date(selectedInvoice.updatedAt || selectedInvoice.createdAt).toLocaleString('vi-VN');
    const total = selectedInvoice.totalPrice || selectedInvoice.totalAmount || 0;
    const items = selectedInvoice.items || [];

    // --- Header ---
    doc.setFillColor(17, 17, 127);  // #11117F
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('FOOD ORDER', pageW / 2, 11, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('He thong quan ly nha hang', pageW / 2, 17, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('HOA DON CHI TIET', pageW / 2, 24, { align: 'center' });

    // --- Order Info ---
    doc.setTextColor(17, 17, 127);
    doc.setFontSize(10);
    doc.text(orderId, pageW / 2, 35, { align: 'center' });

    doc.setDrawColor(220, 220, 220);
    doc.line(10, 39, pageW - 10, 39);

    doc.setTextColor(100, 116, 139);  // slate-500
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('VI TRI BAN', 12, 46);
    doc.text('THOI GIAN', pageW - 12, 46, { align: 'right' });

    doc.setTextColor(15, 23, 42);  // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(tableName, 12, 53);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, pageW - 12, 53, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.line(10, 58, pageW - 10, 58);

    // --- Items Table ---
    let y = 65;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Mon an', 12, y);
    doc.text('SL', pageW / 2, y, { align: 'center' });
    doc.text('Thanh tien', pageW - 12, y, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.line(10, y + 3, pageW - 10, y + 3);
    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    items.forEach(item => {
      const lineTotal = (item.unitPrice || 0) * (item.quantity || 1);
      doc.setFontSize(9);
      doc.text(item.foodName || '', 12, y, { maxWidth: pageW / 2 - 8 });
      doc.text(String(item.quantity || 1), pageW / 2, y, { align: 'center' });
      doc.text(fmt(lineTotal), pageW - 12, y, { align: 'right' });
      y += 8;
    });

    // --- Totals ---
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(10, y, pageW - 10, y);
    y += 7;

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Tam tinh', 12, y);
    doc.text(fmt(total), pageW - 12, y, { align: 'right' });
    y += 7;
    doc.text('Phi dich vu', 12, y);
    doc.text('0d', pageW - 12, y, { align: 'right' });
    y += 4;

    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(10, y, pageW - 10, y);
    doc.setLineDashPattern([], 0);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('TONG CONG', 12, y);
    doc.setTextColor(17, 17, 127);
    doc.text(fmt(total), pageW - 12, y, { align: 'right' });

    // --- Footer ---
    const footerY = doc.internal.pageSize.getHeight() - 14;
    doc.setDrawColor(220, 220, 220);
    doc.line(10, footerY - 4, pageW - 10, footerY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Cam on quy khach! Hen gap lai.', pageW / 2, footerY, { align: 'center' });
    doc.text('Restaurant Management System', pageW / 2, footerY + 5, { align: 'center' });

    doc.save(`${orderId}_${tableName}.pdf`);
  };

  const handleExportReport = () => {
    const completedOrders = allOrders.filter(o => o.status === 'COMPLETED');
    if (completedOrders.length === 0) {
      toast.info('Không có dữ liệu hóa đơn hoàn thành để xuất báo cáo');
      return;
    }

    // CSV Headers
    const headers = ['Ma don', 'Vi tri ban', 'Ngay thanh toan', 'Gio thanh toan', 'Tong thanh toan (VND)', 'Trang thai'];
    
    // CSV Rows
    const rows = completedOrders.map(order => {
      const date = new Date(order.updatedAt || order.createdAt);
      return [
        `ORD-${String(order.id).slice(0, 8).toUpperCase()}`,
        String(order.tableNumber || '').includes('Bàn') ? order.tableNumber : `Ban ${order.tableNumber || order.tableId}`,
        date.toLocaleDateString('vi-VN'),
        date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        Math.floor(order.totalAmount || order.totalPrice || 0),
        'Thanh cong'
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download Blob
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
    link.setAttribute('download', `Bao-cao-hoa-don-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Đã xuất báo cáo thành công!');
  };

  const handleDownloadCompPDF = () => {
    if (!compData) {
      toast.error('Không có dữ liệu đối soát để xuất PDF');
      return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const cleanStr = (s) => {
      if (!s) return '';
      return s.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd')
              .replace(/Đ/g, 'D');
    };
    const fmt = (v) => new Intl.NumberFormat('vi-VN').format(v) + 'd';

    // --- Header ---
    doc.setFillColor(17, 17, 127);  // #11117F
    doc.rect(0, 0, pageW, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('BAO CAO DOI SOAT KHO & DOANH THU', pageW / 2, 14, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ky bao cao: ${compPeriod === 'DAY' ? 'Ngay' : 'Tuan'} | Ca lam viec: ${compShift} | Ngay tao: ${compDate}`, pageW / 2, 22, { align: 'center' });
    doc.text('Restaurant Management System', pageW / 2, 28, { align: 'center' });

    // --- Summary Section ---
    let y = 48;
    doc.setTextColor(17, 17, 127);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('I. CHI SO TONG QUAN', 14, y);
    y += 8;

    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, pageW - 14, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Doanh thu ban hang:', 16, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(compData.totalRevenue || 0), 65, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Chi phi nhap kho:', 110, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(compData.inventory?.importValue || 0), 160, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('So luong don hang:', 16, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${compData.orderCount || 0} don`, 65, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Giao dich kho hang:', 110, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${compData.inventory?.totalTransactions || 0} giao dich`, 160, y);
    y += 8;

    // --- Table Ingredients ---
    doc.setTextColor(17, 17, 127);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('II. CHI TIET DOI SOAT NGUYEN LIEU KHO', 14, y);
    y += 8;

    // Headers
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageW - 28, 8, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Ten nguyen lieu', 16, y + 5.5);
    doc.text('DVT', 68, y + 5.5);
    doc.text('Luong Nhap', 82, y + 5.5, { align: 'right' });
    doc.text('Xuat Ban', 108, y + 5.5, { align: 'right' });
    doc.text('Xuat Huy', 132, y + 5.5, { align: 'right' });
    doc.text('Tong Xuat', 158, y + 5.5, { align: 'right' });
    doc.text('Chenh lech', 182, y + 5.5, { align: 'right' });
    doc.text('Ton hien tai', pageW - 16, y + 5.5, { align: 'right' });
    
    y += 8;

    const items = compData.inventory?.items || [];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);

    if (items.length === 0) {
      doc.text('Khong co du lieu nguyen lieu', pageW / 2, y + 8, { align: 'center' });
    } else {
      items.forEach((item) => {
        // Page boundary check
        if (y > doc.internal.pageSize.getHeight() - 25) {
          doc.addPage();
          y = 20;
          // Re-render header of table in new page
          doc.setFillColor(241, 245, 249);
          doc.rect(14, y, pageW - 28, 8, 'F');
          doc.setTextColor(100, 116, 139);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text('Ten nguyen lieu', 16, y + 5.5);
          doc.text('DVT', 68, y + 5.5);
          doc.text('Luong Nhap', 82, y + 5.5, { align: 'right' });
          doc.text('Xuat Ban', 108, y + 5.5, { align: 'right' });
          doc.text('Xuat Huy', 132, y + 5.5, { align: 'right' });
          doc.text('Tong Xuat', 158, y + 5.5, { align: 'right' });
          doc.text('Chenh lech', 182, y + 5.5, { align: 'right' });
          doc.text('Ton hien tai', pageW - 16, y + 5.5, { align: 'right' });
          y += 8;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
        }

        // Draw line separator
        doc.setDrawColor(241, 245, 249);
        doc.line(14, y, pageW - 14, y);

        const name = cleanStr(item.ingredientName);
        const unit = cleanStr(item.unit);
        const impQty = item.importQuantity || 0;
        const saleQty = item.exportSaleQuantity || 0;
        const wasteQty = item.exportWasteQuantity || 0;
        const totQty = item.totalExportQuantity || 0;
        const netQty = item.netQuantity || 0;
        const curStock = item.currentStock || 0;

        doc.text(name.length > 28 ? name.slice(0, 27) + '...' : name, 16, y + 5);
        doc.text(unit, 68, y + 5);
        doc.text(String(impQty), 82, y + 5, { align: 'right' });
        doc.text(String(saleQty), 108, y + 5, { align: 'right' });
        doc.text(String(wasteQty), 132, y + 5, { align: 'right' });
        doc.text(String(totQty), 158, y + 5, { align: 'right' });
        
        // Highlight negative net qty or positive
        if (netQty < 0) {
          doc.setTextColor(239, 68, 68); // red
        } else if (netQty > 0) {
          doc.setTextColor(16, 185, 129); // green
        } else {
          doc.setTextColor(15, 23, 42);
        }
        doc.text(String(netQty), 182, y + 5, { align: 'right' });

        doc.setTextColor(15, 23, 42);
        doc.text(String(curStock), pageW - 16, y + 5, { align: 'right' });
        y += 7.5;
      });
    }

    // --- Footer ---
    const footerY = doc.internal.pageSize.getHeight() - 14;
    doc.setDrawColor(220, 220, 220);
    doc.line(14, footerY - 4, pageW - 14, footerY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Bao cao doi soat kho - doanh thu tu dong phat sinh boi Restaurant Management.', pageW / 2, footerY, { align: 'center' });

    doc.save(`Bao-cao-doi-soat-kho-doanh-thu-${compDate}.pdf`);
    toast.success('Đã tải báo cáo đối soát PDF thành công!');
  };

  // ---- Handlers ----

  const handleOpenFoodModal = (food = null) => {
    if (food) {
      setEditingFood(food);
      setFoodFormData({ code: food.code || '', foodName: food.foodName || '', price: food.price || '', categoryId: food.categoryId || '', imageUrl: food.imageUrl || '', options: food.options || '' });
    } else {
      setEditingFood(null);
      setFoodFormData({ code: '', foodName: '', price: '', categoryId: categories[0]?.id || '', imageUrl: '', options: '' });
    }
    setIsFoodModalOpen(true);
  };

  const handleFoodImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const res = await apiService.catalog.uploadImage(file);
      if (res.url) {
        setFoodFormData(prev => ({ ...prev, imageUrl: res.url }));
        toast.success('Tải ảnh lên thành công!');
      } else {
        toast.error('Không nhận được URL ảnh từ máy chủ');
      }
    } catch (err) {
      toast.error('Lỗi tải ảnh lên: ' + err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleProposeFoodImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const res = await apiService.catalog.uploadImage(file);
      if (res.url) {
        setProposeFoodFormData(prev => ({ ...prev, imageUrl: res.url }));
        toast.success('Tải ảnh lên thành công!');
      } else {
        toast.error('Không nhận được URL ảnh từ máy chủ');
      }
    } catch (err) {
      toast.error('Lỗi tải ảnh lên: ' + err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveFood = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...foodFormData, price: parseFloat(foodFormData.price) };
      if (editingFood) {
        await apiService.catalog.updateItem(editingFood.id, payload);
        toast.success('Cập nhật món ăn thành công');
      } else {
        await apiService.catalog.createItem(payload);
        toast.success('Thêm món ăn thành công');
      }
      setIsFoodModalOpen(false);
      fetchFoodsData();
    } catch (err) { toast.error('Lỗi lưu món ăn: ' + err.message); }
  };

  const handleDeleteFood = async (id) => {
    const ok = await confirm('Xóa món ăn', 'Bạn có chắc muốn xóa món ăn này không?', { danger: true, confirmLabel: 'Xóa' });
    if (!ok) return;
    try {
      await apiService.catalog.deleteItem(id);
      toast.success('Đã xóa món ăn');
      fetchFoodsData();
    } catch (err) { toast.error('Lỗi xóa món ăn: ' + err.message); }
  };

  // Bật/tắt bán món ăn — dùng khi nguyên liệu ở mức cảnh báo (tắt tạm) hoặc đã nhập thêm hàng (bật lại).
  const handleToggleFoodAvailability = async (food) => {
    const turningOn = food.status === 0; // 0 = INACTIVE -> đang bật lại
    if (turningOn) {
      const lowStockNames = foodLowStockMap[food.id] || [];
      if (lowStockNames.length > 0) {
        const ok = await confirm(
          'Nguyên liệu vẫn đang cảnh báo',
          `Món "${food.foodName}" dùng nguyên liệu đang ở mức cảnh báo: ${lowStockNames.join(', ')}. Bạn có chắc muốn bật bán lại?`,
          { confirmLabel: 'Vẫn bật bán' }
        );
        if (!ok) return;
      }
    }
    try {
      await apiService.catalog.setItemAvailability(food.id, turningOn);
      toast.success(turningOn ? `Đã bật bán "${food.foodName}"` : `Đã tắt bán "${food.foodName}"`);
      fetchFoodsData();
    } catch (err) { toast.error('Lỗi cập nhật trạng thái món: ' + err.message); }
  };

  const handleOpenProposeFoodModal = async () => {
    // Nếu chưa có categories (đang ở tab Kitchen, chưa load Menu & Food), tải về trước
    let cats = categories;
    if (!cats || cats.length === 0) {
      try {
        const catsRes = await apiService.catalog.getCategories();
        if (catsRes.data) {
          setCategories(catsRes.data);
          cats = catsRes.data;
        }
      } catch (err) {
        toast.error('Không thể tải danh mục: ' + err.message);
      }
    }
    setProposeFoodFormData({ code: '', foodName: '', price: '', categoryId: cats[0]?.id || '', imageUrl: '', recipe: '' });
    setIsProposeFoodModalOpen(true);
  };

  const handleProposeFood = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...proposeFoodFormData, price: parseFloat(proposeFoodFormData.price) };
      await apiService.catalog.proposeItem(payload);
      toast.success('Gửi đề xuất món ăn thành công chờ Admin duyệt');
      setIsProposeFoodModalOpen(false);
    } catch (err) { toast.error('Lỗi gửi đề xuất: ' + err.message); }
  };

  const handleApproveProposal = async (id) => {
    const ok = await confirm('Duyệt món', 'Đồng ý duyệt món ăn này lên Menu?', { confirmLabel: 'Duyệt' });
    if (!ok) return;
    try {
      await apiService.catalog.approveItem(id);
      toast.success('Duyệt món ăn thành công');
      fetchFoodsData();
    } catch (err) { toast.error('Lỗi duyệt món ăn: ' + err.message); }
  };

  const handleRejectProposal = async (id) => {
    const ok = await confirm('Từ chối món', 'Bạn có chắc muốn từ chối đề xuất này?', { danger: true, confirmLabel: 'Từ chối' });
    if (!ok) return;
    try {
      await apiService.catalog.rejectItem(id);
      toast.success('Từ chối món ăn thành công');
      fetchFoodsData();
    } catch (err) { toast.error('Lỗi từ chối món ăn: ' + err.message); }
  };

  const handleOpenCategoryModal = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryFormData({ code: cat.code || '', name: cat.name || '', description: cat.description || '' });
    } else {
      setEditingCategory(null);
      setCategoryFormData({ code: '', name: '', description: '' });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await apiService.catalog.updateCategory(editingCategory.id, categoryFormData);
        toast.success('Cập nhật danh mục thành công');
      } else {
        await apiService.catalog.createCategory(categoryFormData);
        toast.success('Thêm danh mục thành công');
      }
      setIsCategoryModalOpen(false);
      fetchFoodsData();
    } catch (err) { toast.error('Lỗi lưu danh mục: ' + err.message); }
  };

  const handleDeleteCategory = async (id) => {
    const ok = await confirm('Xóa danh mục', 'Các món ăn thuộc danh mục này sẽ bị ảnh hưởng. Bạn có chắc muốn xóa?', { danger: true, confirmLabel: 'Xóa danh mục' });
    if (!ok) return;
    try {
      await apiService.catalog.deleteCategory(id);
      toast.success('Đã xóa danh mục');
      fetchFoodsData();
    } catch (err) { toast.error('Lỗi xóa danh mục: ' + err.message); }
  };

  const handleOpenStaffModal = (person = null) => {
    if (person) {
      setEditingStaff(person);
      setStaffFormData({
        username: person.username || '',
        password: '',
        fullName: person.fullName || '',
        email: person.email || '',
        phoneNumber: person.phoneNumber || '',
        birthday: person.birthday || '',
        role: person.role || 'WAITER',
      });
    } else {
      setEditingStaff(null);
      setStaffFormData({ username: '', password: '', fullName: '', email: '', phoneNumber: '', birthday: '', role: 'WAITER', server: user?.server || 'HCM', gender: 'MALE' });
    }
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    try {
      const roleStrToInt = { WAITER: 0, ADMIN: 1, CHEF: 2, KITCHEN: 3 };
      const payload = { ...staffFormData };

      // Đảm bảo birthday khớp định dạng LocalDateTime (yyyy-MM-ddTHH:mm:ss)
      if (payload.birthday && payload.birthday.length === 10) {
        payload.birthday = `${payload.birthday}T00:00:00`;
      }

      if (typeof payload.role === 'string') payload.role = roleStrToInt[payload.role] ?? 0;
      if (editingStaff && !payload.password) delete payload.password;
      if (editingStaff) {
        await apiService.dashboard.updateStaff(null, editingStaff.id, payload);
        toast.success('Cập nhật nhân viên thành công');
      } else {
        await apiService.dashboard.createStaff(payload);
        toast.success('Thêm nhân viên thành công');
      }
      setIsStaffModalOpen(false);
      fetchStaffData();
    } catch (err) {
      toast.error('Lỗi lưu nhân viên: ' + err.message);
    }
  };

  const handleDeleteStaff = async (id) => {
    const ok = await confirm('Xóa nhân viên', 'Bạn có chắc muốn xóa nhân viên này không?', { danger: true, confirmLabel: 'Xóa' });
    if (!ok) return;
    try {
      await apiService.dashboard.deleteStaff(null, id);
      toast.success('Đã xóa nhân viên');
      fetchStaffData();
    } catch (err) {
      toast.error('Lỗi xóa nhân viên: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-app)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {ConfirmUI}
      {/* Sidebar */}
      <motion.aside initial={false} animate={{ width: isSidebarOpen ? '260px' : '0px', opacity: isSidebarOpen ? 1 : 0 }} style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <img src="/food_order_logo_1778061110379.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} />
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#11117F', letterSpacing: '-0.5px' }}>Food<span style={{ color: 'var(--primary)' }}>Order</span></h2>
        </div>

        <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>Menu</div>
          {filteredNavItems.map((item, idx) => (
            <button key={idx} onClick={() => setActiveTab(item.label)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: activeTab === item.label ? 'var(--primary-light)' : 'transparent', color: activeTab === item.label ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', fontWeight: activeTab === item.label ? '600' : '400', transition: 'var(--transition)' }}>
              {item.icon} <span style={{ fontSize: '15px' }}>{item.display || item.label}</span>
            </button>
          ))}
        </nav>


        {/* User Card from JWT info */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('Profile')}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '12px', transition: 'var(--transition)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '15px', fontWeight: '700', flexShrink: 0
              }}>
                {(user?.fullName || user?.username || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', margin: 0 }}>
                  {user?.fullName || user?.username}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                  @{user?.username} · {user?.role}
                </p>
              </div>
              <button onClick={e => { e.stopPropagation(); handleLogout(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-cancelled)', padding: '4px', borderRadius: '6px', flexShrink: 0 }} title={t.logout}>
                <LogOut size={17} />
              </button>
            </div>
          </button>
        </div>

      </motion.aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: '72px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Menu size={24} /></button>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)' }}>{activeTab}</h1>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>

          {/* OVERVIEW TAB */}
          {activeTab === 'Overview' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="animate-fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
                {statCards.map((stat, idx) => (
                  <div key={idx} className="card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: '500' }}>{stat.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--primary)', lineHeight: '1' }}>{stat.value}</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: stat.positive ? 'var(--status-completed)' : 'var(--text-secondary)' }}>{stat.change}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{t.recentOrders}</h3>
                    <button onClick={fetchOverviewData} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '14px', border: 'none' }}>{t.refresh}</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '14px' }}>Ngày thanh toán</th>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '14px' }}>{t.tableCol}</th>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '14px' }}>{t.amount}</th>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '14px' }}>{t.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingConfig.overview ? (
                          <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t.loading}</td></tr>
                        ) : recentOrders.length === 0 ? (
                          <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t.noOrders}</td></tr>
                        ) : (
                          recentOrders.map((order, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--bg-app)' }}>
                              <td style={{ padding: '16px 12px' }}>
                                <div style={{ color: '#475569', fontSize: '13px', fontWeight: '700' }}>{new Date(order.updatedAt || order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                                <div style={{ color: '#94A3B8', fontSize: '11px' }}>{new Date(order.updatedAt || order.createdAt).toLocaleDateString('vi-VN')}</div>
                              </td>
                              <td style={{ padding: '16px 12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{order.tableNumber || order.tableId}</td>
                              <td style={{ padding: '16px 12px', fontWeight: '700', color: '#0F172A' }}>
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.totalAmount || 0)}
                              </td>
                              <td style={{ padding: '16px 12px' }}>
                                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', backgroundColor: `${getStatusColor(order.status)}20`, color: getStatusColor(order.status) }}>
                                  {order.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card" style={{ padding: '24px', gridColumn: '2 / 3', gridRow: '1 / 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Table Status</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {loadingConfig.overview ? (
                      <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center' }}>Loading...</p>
                    ) : tables.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center' }}>No tables.</p>
                    ) : tables.map((table) => {
                      const status = String(table.status).toUpperCase();
                      const isAvailable = status === 'AVAILABLE' || status === '0';
                      const isOccupied = status === 'OCCUPIED' || status === '1';
                      const isCleaning = status === 'CLEANING' || status === '3';

                      return (
                        <div key={table.id} style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-md)',
                          textAlign: 'center',
                          border: `1px solid ${isOccupied ? 'var(--secondary)' : 'var(--border-color)'}`,
                          backgroundColor: isOccupied ? 'rgba(9, 52, 219, 0.05)' : 'var(--bg-app)',
                          transition: 'all 0.3s ease',
                          position: 'relative'
                        }}>
                          <button 
                            onClick={() => setSelectedTableForQR(table)} 
                            style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                            title="Mã QR Đặt Món"
                          >
                            <QrCode size={16} />
                          </button>
                          <span style={{ display: 'block', fontSize: '15px', fontWeight: '700', marginBottom: '6px', color: '#11117F' }}>
                            Bàn {table.tableNumber}
                          </span>
                          <span className={`badge ${isOccupied ? 'badge-occupied' : 'badge-empty'}`} style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            backgroundColor: isAvailable ? '#ecfdf5' : isOccupied ? '#fef2f2' : '#fffbeb',
                            color: isAvailable ? '#10b981' : isOccupied ? '#ef4444' : '#f59e0b'
                          }}>
                            {isAvailable ? 'Sẵn sàng' : isOccupied ? 'Có khách' : isCleaning ? 'Đang dọn' : status}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* KITCHEN TAB */}
          {activeTab === 'Kitchen' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <style>{`
                @keyframes kdsPulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.35); }
                  50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
                }
              `}</style>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>🍳 Bếp — Đơn cần chế biến</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {kitchenItems.filter(i => i.kitchenStatus === 'PENDING').length} chờ &middot;{' '}
                    {kitchenItems.filter(i => i.kitchenStatus === 'COOKING').length} đang nấu &middot;{' '}
                    {kitchenItems.filter(i => i.kitchenStatus === 'READY').length} sẵn sàng
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                    <button onClick={() => setKitchenViewMode('table')}
                      style={{ padding: '8px 14px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer', backgroundColor: kitchenViewMode === 'table' ? '#11117F' : '#FFF', color: kitchenViewMode === 'table' ? '#FFF' : '#334155' }}>
                      🗂️ Theo bàn
                    </button>
                    <button onClick={() => setKitchenViewMode('status')}
                      style={{ padding: '8px 14px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer', backgroundColor: kitchenViewMode === 'status' ? '#11117F' : '#FFF', color: kitchenViewMode === 'status' ? '#FFF' : '#334155' }}>
                      📊 Theo trạng thái
                    </button>
                  </div>
                  {user?.role === 'KITCHEN' && (
                    <button onClick={handleOpenProposeFoodModal} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>💡 Đề xuất món mới</button>
                  )}
                  <button onClick={enterKitchenKiosk} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '14px' }}>🖥️ Chế độ Kiosk</button>
                  <button onClick={fetchKitchenData} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '14px' }}>🔄 Làm mới</button>
                </div>
              </div>

              {kitchenCategoryOptions.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {kitchenCategoryOptions.map(cat => (
                    <button key={cat} onClick={() => setKitchenCategoryFilter(cat)}
                      style={{
                        padding: '6px 14px', fontSize: '12px', fontWeight: '700', borderRadius: '20px',
                        border: `1px solid ${kitchenCategoryFilter === cat ? '#11117F' : '#E2E8F0'}`,
                        backgroundColor: kitchenCategoryFilter === cat ? '#11117F' : '#FFF',
                        color: kitchenCategoryFilter === cat ? '#FFF' : '#334155', cursor: 'pointer',
                      }}>
                      {cat === 'ALL' ? 'Tất cả khu' : cat}
                    </button>
                  ))}
                </div>
              )}

              {loadingConfig.kitchen ? (
                <p style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Đang tải dữ liệu bếp...</p>
              ) : (
                <KitchenBoard
                  items={visibleKitchenItems}
                  viewMode={kitchenViewMode}
                  kiosk={false}
                  now={timeTicker}
                  onStatusChange={handleUpdateItemStatus}
                  onCompleteAll={handleCompleteAllItems}
                  onPrint={printKitchenTicket}
                  thresholds={kdsSettings}
                  cookStartMap={kdsCookStartRef.current}
                />
              )}
            </motion.div>
          )}

          {/* KDS KIOSK — màn hình toàn màn hình dành cho tablet/màn hình gắn trong bếp */}
          {kdsKioskMode && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: '#F1F5F9', overflowY: 'auto', padding: '28px' }}>
              <style>{`
                @keyframes kdsPulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.35); }
                  50% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
                }
              `}</style>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '32px', fontWeight: '800', margin: 0 }}>🍳 MÀN HÌNH BẾP</h2>
                  <p style={{ fontSize: '18px', color: '#64748B', marginTop: '4px' }}>
                    {kitchenItems.filter(i => i.kitchenStatus === 'PENDING').length} chờ &middot;{' '}
                    {kitchenItems.filter(i => i.kitchenStatus === 'COOKING').length} đang nấu &middot;{' '}
                    {kitchenItems.filter(i => i.kitchenStatus === 'READY').length} sẵn sàng
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '2px solid #CBD5E1' }}>
                    <button onClick={() => setKitchenViewMode('table')}
                      style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', backgroundColor: kitchenViewMode === 'table' ? '#11117F' : '#FFF', color: kitchenViewMode === 'table' ? '#FFF' : '#334155' }}>
                      🗂️ Theo bàn
                    </button>
                    <button onClick={() => setKitchenViewMode('status')}
                      style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', backgroundColor: kitchenViewMode === 'status' ? '#11117F' : '#FFF', color: kitchenViewMode === 'status' ? '#FFF' : '#334155' }}>
                      📊 Theo trạng thái
                    </button>
                  </div>
                  <button onClick={fetchKitchenData} style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', borderRadius: '10px', border: '2px solid #CBD5E1', cursor: 'pointer', backgroundColor: '#FFF', color: '#334155' }}>
                    🔄 Làm mới
                  </button>
                  <button onClick={exitKitchenKiosk} style={{ padding: '12px 20px', fontSize: '16px', fontWeight: '700', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: '#EF4444', color: '#FFF' }}>
                    ✕ Thoát Kiosk
                  </button>
                </div>
              </div>

              {kitchenCategoryOptions.length > 1 && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  {kitchenCategoryOptions.map(cat => (
                    <button key={cat} onClick={() => setKitchenCategoryFilter(cat)}
                      style={{
                        padding: '10px 18px', fontSize: '15px', fontWeight: '700', borderRadius: '20px',
                        border: `2px solid ${kitchenCategoryFilter === cat ? '#11117F' : '#CBD5E1'}`,
                        backgroundColor: kitchenCategoryFilter === cat ? '#11117F' : '#FFF',
                        color: kitchenCategoryFilter === cat ? '#FFF' : '#334155', cursor: 'pointer',
                      }}>
                      {cat === 'ALL' ? 'Tất cả khu' : cat}
                    </button>
                  ))}
                </div>
              )}

              <KitchenBoard
                items={visibleKitchenItems}
                viewMode={kitchenViewMode}
                kiosk={true}
                now={timeTicker}
                onStatusChange={handleUpdateItemStatus}
                onCompleteAll={handleCompleteAllItems}
                onPrint={printKitchenTicket}
                thresholds={kdsSettings}
                cookStartMap={kdsCookStartRef.current}
              />
            </div>
          )}

          {/* ORDERS TAB - New Real-time Table Grid View */}
          {activeTab === 'Orders' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Header section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#11117F', margin: 0 }}>🏪 Sơ đồ bàn & Đơn hàng</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {tables.filter(t => t.status === 'AVAILABLE' || t.status === '0').length} bàn trống &middot; {tables.filter(t => t.status === 'OCCUPIED' || t.status === '1').length} bàn đang sử dụng
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => { fetchTablesData(); fetchOrdersData(); }} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} /> Làm mới
                  </button>
                  <button onClick={() => setIsCreateOrderModalOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', borderColor: '#10b981' }}>
                    <Plus size={16} /> Mở bàn / Gọi món
                  </button>
                </div>
              </div>

              {/* Main Content Layout: Grid and Detail */}
              <div style={{ display: 'grid', gridTemplateColumns: selectedTableForOrders ? '1fr 380px' : '1fr', gap: '24px', transition: 'all 0.4s ease' }}>

                {/* Left: Table Grid */}
                <div className="card" style={{ padding: '24px', backgroundColor: '#F8FAFC' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                    {loadingConfig.tables ? (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>Loading...</div>
                    ) : (
                      tables.map((table) => {
                        const status = String(table.status).toUpperCase();

                        // Tính active orders trước để dùng trong isOccupied
                        const tableOrders = allOrders.filter(o => String(o.tableId) === String(table.id) && (o.status === 'PENDING' || o.status === 'CONFIRMED'));
                        const totalAmount = tableOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                        // Bàn "có khách" khi: backend đánh là OCCUPIED hoặc đang có đơn hàng active
                        const isOccupied = status === 'OCCUPIED' || status === '1' || tableOrders.length > 0;
                        const isSelected = selectedTableForOrders?.id === table.id;

                        return (
                          <motion.div
                            key={table.id}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setSelectedTableForOrders(isSelected ? null : table)}
                            style={{
                              aspectRatio: '1/1',
                              cursor: 'pointer',
                              borderRadius: '20px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              backgroundColor: isSelected ? '#11117F' : '#FFF',
                              boxShadow: isSelected ? '0 10px 25px rgba(17, 17, 127, 0.3)' : '0 4px 12px rgba(0,0,0,0.05)',
                              border: `2px solid ${isOccupied ? '#EF4444' : isSelected ? '#11117F' : 'transparent'}`
                            }}
                          >
                            <div style={{
                              width: '48px', height: '48px', borderRadius: '14px',
                              backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : isOccupied ? '#FEF2F2' : '#F0F9FF',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              marginBottom: '12px', color: isSelected ? '#FFF' : isOccupied ? '#EF4444' : '#11117F'
                            }}>
                              {isOccupied ? <Users size={24} /> : <Utensils size={24} />}
                            </div>
                            <span style={{ fontSize: '18px', fontWeight: '800', color: isSelected ? '#FFF' : '#0F172A' }}>
                              Bàn {table.tableNumber}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)' }}>
                              {table.capacity} chỗ
                            </span>

                            {isOccupied && (
                              <div style={{
                                marginTop: '8px', padding: '2px 8px', borderRadius: '10px',
                                backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#EF4444',
                                color: '#FFF', fontSize: '10px', fontWeight: '800'
                              }}>
                                {totalAmount.toLocaleString('vi-VN')}đ
                              </div>
                            )}

                            {isOccupied && !isSelected && (
                              <div style={{ position: 'absolute', top: '10px', right: '10px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EF4444', border: '2px solid white' }} />
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right: Bill Detail (Conditional) */}
                <AnimatePresence>
                  {selectedTableForOrders && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="card"
                      style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#FFF', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#11117F' }}>Bàn {selectedTableForOrders.tableNumber}</h4>
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Hóa đơn tạm tính</p>
                        </div>
                        <button onClick={() => setSelectedTableForOrders(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {(() => {
                          // LỌ bỏ đơn rỗng (không có items) — các đơn này đã bị xóa hết món
                          const tableOrders = allOrders.filter(o =>
                            String(o.tableId) === String(selectedTableForOrders.id) &&
                            (o.status === 'PENDING' || o.status === 'CONFIRMED') &&
                            o.items && o.items.length > 0
                          );
                          if (tableOrders.length === 0) {
                            return (
                              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                                <Utensils size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                <p>Bàn này chưa có món nào</p>
                              </div>
                            );
                          }
                          return tableOrders.map(order => (
                            <div key={order.id} style={{ borderBottom: '1px dashed #E2E8F0', paddingBottom: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', fontFamily: 'monospace' }}>#{String(order.id).slice(0, 6)}</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', backgroundColor: `${getStatusColor(order.status)}15`, color: getStatusColor(order.status) }}>{order.status}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {(order.items || []).map((item, idx) => {
                                  const canDelete = !item.kitchenStatus || item.kitchenStatus === 'PENDING';
                                  return (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', gap: '8px' }}>
                                      <span style={{ color: '#475569', flex: 1 }}><strong style={{ color: '#0F172A' }}>{item.quantity}x</strong> {item.foodName}
                                        {item.kitchenStatus && item.kitchenStatus !== 'PENDING' && (
                                          <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '8px',
                                            backgroundColor: item.kitchenStatus === 'COOKING' ? '#FEF3C7' : item.kitchenStatus === 'READY' ? '#D1FAE5' : '#E0E7FF',
                                            color: item.kitchenStatus === 'COOKING' ? '#92400E' : item.kitchenStatus === 'READY' ? '#065F46' : '#3730A3'
                                          }}>{item.kitchenStatus}</span>
                                        )}
                                      </span>
                                      <span style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{(item.unitPrice * item.quantity).toLocaleString('vi-VN')}đ</span>
                                      <button
                                        onClick={() => handleRemoveItemFromOrder(order.id, item.id, item.foodName, item.kitchenStatus)}
                                        title={canDelete ? 'Xóa món này' : `Không thể xóa — bếp đang ${item.kitchenStatus}`}
                                        style={{
                                          background: canDelete ? '#FEE2E2' : '#F1F5F9',
                                          border: 'none', borderRadius: '6px',
                                          width: '26px', height: '26px',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          cursor: canDelete ? 'pointer' : 'not-allowed',
                                          color: canDelete ? '#EF4444' : '#94A3B8',
                                          flexShrink: 0, transition: 'all 0.15s'
                                        }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                    {item.kitchenStatus === 'READY' && (
                                      <button
                                        onClick={() => handleServeItem(item.id, item.foodName)}
                                        title="Xác nhận đã mang món ra bàn cho khách"
                                        style={{
                                          background: '#10B981', border: 'none', borderRadius: '10px',
                                          padding: '14px', fontSize: '15px', fontWeight: '800',
                                          color: '#FFF', cursor: 'pointer', width: '100%',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                          boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
                                        }}
                                      >
                                        🛎️ Trả món
                                      </button>
                                    )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>

                      {(() => {
                        // LỌ bỏ đơn rỗng khỏi tính tổng
                        const tableOrders = allOrders.filter(o =>
                          String(o.tableId) === String(selectedTableForOrders.id) &&
                          (o.status === 'PENDING' || o.status === 'CONFIRMED') &&
                          o.items && o.items.length > 0
                        );
                        const total = tableOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                        if (tableOrders.length === 0) return null;

                        return (
                          <div style={{ borderTop: '2px solid #F1F5F9', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                              <span style={{ fontSize: '16px', fontWeight: '700', color: '#475569' }}>TỔNG CỘNG:</span>
                              <span style={{ fontSize: '24px', fontWeight: '900', color: '#10B981' }}>{total.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button
                                onClick={() => {
                                  setSelectedTableId(selectedTableForOrders.id);
                                  setIsCreateOrderModalOpen(true);
                                }}
                                className="btn btn-outline" style={{ flex: 1, padding: '12px', fontSize: '14px' }}
                              >
                                Thêm món
                              </button>
                              <button
                                onClick={() => handleOpenCheckout(selectedTableForOrders.id)}
                                className="btn btn-primary" style={{ flex: 2, padding: '12px', fontSize: '14px', backgroundColor: '#11117F' }}
                              >
                                💳 Thanh toán
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}



          {/* MENU & FOOD TAB */}

          {activeTab === 'Menu & Food' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              {loadingConfig.foods ? (
                <p style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Đang tải dữ liệu...</p>
              ) : selectedCategory === null ? (

                /* ===== MÀN HÌNH 1: LƯỚI DANH MỤC & ĐỀ XUẤT ===== */
                <>
                  <div style={{ marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 16px', color: '#B45309' }}>⏳ Đề xuất chờ duyệt</h3>
                    {foods.filter(f => f.status === 2).length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Không có đề xuất nào đang chờ duyệt.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {foods.filter(f => f.status === 2).map(item => (
                          <div key={item.id} className="card" style={{ padding: '16px', borderLeft: '4px solid #F59E0B' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700' }}>{item.foodName}</h4>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>Mã: {item.code} | Danh mục: {categories.find(c => c.id === item.categoryId)?.name}</p>
                                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--status-completed)', margin: '0 0 12px' }}>{item.price?.toLocaleString()} đ</p>
                              </div>
                            </div>
                            <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                              <strong>Công thức:</strong><br />
                              {item.recipe || 'Không có công thức'}
                            </div>
                            {user?.role === 'ADMIN' ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleApproveProposal(item.id)} className="btn btn-primary" style={{ flex: 1, padding: '6px', fontSize: '13px', backgroundColor: '#10B981', borderColor: '#10B981' }}>✓ Duyệt</button>
                                <button onClick={() => handleRejectProposal(item.id)} className="btn btn-outline" style={{ flex: 1, padding: '6px', fontSize: '13px', color: '#EF4444', borderColor: '#EF4444' }}>✕ Từ chối</button>
                              </div>
                            ) : (
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#F59E0B', textAlign: 'center', backgroundColor: '#FFFBEB', padding: '6px', borderRadius: '6px' }}>
                                ⏳ Đang chờ Admin duyệt
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Đề xuất sửa công thức món ăn */}
                  <div style={{ marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 16px', color: '#1D4ED8' }}>📝 Đề xuất sửa đổi công thức</h3>
                    {foods.filter(f => f.pendingRecipe && f.pendingRecipe.trim() !== '').length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Không có đề xuất sửa đổi công thức nào đang chờ duyệt.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {foods.filter(f => f.pendingRecipe && f.pendingRecipe.trim() !== '').map(item => (
                          <div key={item.id} className="card" style={{ padding: '16px', borderLeft: '4px solid #3B82F6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700' }}>{item.foodName}</h4>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>Mã: {item.code} | Danh mục: {categories.find(c => c.id === item.categoryId)?.name}</p>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', marginBottom: '16px' }}>
                              <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                                <strong style={{ color: 'var(--text-secondary)' }}>Công thức hiện tại:</strong>
                                <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{item.recipe || '(Trống)'}</div>
                              </div>
                              <div style={{ backgroundColor: '#EFF6FF', padding: '10px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                                <strong style={{ color: '#1E40AF' }}>Công thức đề xuất mới:</strong>
                                <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap', fontWeight: '500', color: '#1E3A8A' }}>{item.pendingRecipe}</div>
                              </div>
                            </div>
                            {user?.role === 'ADMIN' ? (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleApproveRecipeProposal(item.id)} className="btn btn-primary" style={{ flex: 1, padding: '6px', fontSize: '13px', backgroundColor: '#10B981', borderColor: '#10B981' }}>✓ Duyệt</button>
                                <button onClick={() => handleRejectRecipeProposal(item.id)} className="btn btn-outline" style={{ flex: 1, padding: '6px', fontSize: '13px', color: '#EF4444', borderColor: '#EF4444' }}>✕ Từ chối</button>
                              </div>
                            ) : (
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B82F6', textAlign: 'center', backgroundColor: '#EFF6FF', padding: '6px', borderRadius: '6px' }}>
                                ⏳ Đang chờ Admin duyệt công thức mới
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h3 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>📂 Danh mục thực đơn</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Chọn danh mục để xem và quản lý món ăn</p>
                    </div>
                    {user?.role === 'ADMIN' && (
                      <button onClick={() => handleOpenCategoryModal()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={16} /> Thêm Danh Mục
                      </button>
                    )}
                  </div>

                  {categories.length === 0 ? (
                    <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📂</p>
                      <p style={{ fontWeight: '600' }}>Chưa có danh mục nào.</p>
                      <p style={{ fontSize: '13px' }}>Hãy tạo danh mục đầu tiên để bắt đầu quản lý thực đơn!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                      {categories.map(cat => (
                        <div key={cat.id} className="card" style={{ padding: '0', overflow: 'hidden', cursor: 'pointer', transition: 'var(--transition)', border: '2px solid transparent' }}
                          onClick={() => setSelectedCategory(cat)}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                        >
                          {/* Header màu */}
                          <div style={{ height: '8px', background: 'linear-gradient(90deg, var(--primary), var(--primary-hover))' }} />
                          <div style={{ padding: '20px' }}>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#{cat.code}</p>
                            <h4 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 6px', color: 'var(--text-primary)' }}>{cat.name}</h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', minHeight: '20px' }}>{cat.description || '—'}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: '20px' }}>
                                {foods.filter(f => f.categoryId === cat.id && f.status !== 2).length} món
                              </span>
                              {user?.role === 'ADMIN' && (
                                <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => handleOpenCategoryModal(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}><Settings size={15} /></button>
                                  <button onClick={() => handleDeleteCategory(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-cancelled)', padding: '4px' }}><LogOut size={15} /></button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>

              ) : (

                /* ===== MÀN HÌNH 2: DANH SÁCH MÓN ĂN THEO DANH MỤC ===== */
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button onClick={() => setSelectedCategory(null)} style={{ background: 'var(--bg-app)', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600' }}>
                        ← Danh mục
                      </button>
                      <div>
                        <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>🍽️ {selectedCategory.name}</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>#{selectedCategory.code}</p>
                      </div>
                    </div>
                    {user?.role === 'ADMIN' && (
                      <button onClick={() => handleOpenFoodModal()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={16} /> Thêm Món
                      </button>
                    )}
                  </div>

                  {(() => {
                    // status === 2 (PENDING/chờ duyệt) đã có khu vực "Đề xuất chờ duyệt" riêng ở trên, không lặp lại ở đây
                    const catFoods = foods.filter(f => f.categoryId === selectedCategory.id && f.status !== 2);
                    return catFoods.length === 0 ? (
                      <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🍽️</p>
                        <p style={{ fontWeight: '600' }}>Danh mục này chưa có món ăn nào.</p>
                        {user?.role === 'ADMIN' && (
                          <button onClick={() => handleOpenFoodModal()} className="btn btn-primary" style={{ marginTop: '16px' }}>+ Thêm món đầu tiên</button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                        {catFoods.map(food => {
                          const isOff = food.status === 0; // INACTIVE — đang tắt bán
                          const lowStockNames = foodLowStockMap[food.id] || [];
                          return (
                          <div key={food.id} className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', opacity: isOff ? 0.55 : 1 }}>
                            {isOff && (
                              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 2, backgroundColor: 'rgba(15, 23, 42, 0.85)', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
                                ⏸️ Ngừng bán
                              </div>
                            )}
                            {!isOff && lowStockNames.length > 0 && (
                              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 2, backgroundColor: 'rgba(239, 68, 68, 0.92)', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }} title={`Nguyên liệu sắp hết: ${lowStockNames.join(', ')}`}>
                                ⚠️ Nguyên liệu sắp hết
                              </div>
                            )}
                            <div style={{ height: '150px', backgroundColor: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {food.imageUrl ? (
                                <img
                                  src={food.imageUrl}
                                  alt={food.foodName}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={e => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div style={{
                                display: food.imageUrl ? 'none' : 'flex',
                                width: '100%', height: '100%',
                                background: `linear-gradient(135deg, hsl(${(food.foodName?.charCodeAt(0) || 200) % 360}, 60%, 55%), hsl(${(food.foodName?.charCodeAt(0) || 200) % 360 + 40}, 70%, 45%))`,
                                alignItems: 'center', justifyContent: 'center',
                                fontSize: '36px', fontWeight: '800', color: 'white',
                                letterSpacing: '-1px', userSelect: 'none'
                              }}>
                                {food.foodName?.charAt(0)?.toUpperCase() || '🍽'}
                              </div>
                            </div>
                            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{food.foodName}</h4>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>#{food.code}</p>
                              <button 
                                onClick={() => handleOpenViewRecipeModal(food)}
                                style={{ 
                                  alignSelf: 'flex-start',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'var(--primary-light)',
                                  color: 'var(--primary)',
                                  border: 'none',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  marginTop: '4px',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.95)'; }}
                                onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                              >
                                📖 Xem công thức
                              </button>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
                                <p style={{ fontSize: '17px', fontWeight: '700', color: 'var(--status-ordering)', margin: 0 }}>
                                  {Number(food.price).toLocaleString('vi-VN')}<span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--text-secondary)' }}> đ</span>
                                </p>
                                {user?.role === 'ADMIN' && (
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => handleToggleFoodAvailability(food)}
                                      title={isOff ? 'Bật bán lại' : 'Tắt bán tạm thời'}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: isOff ? '#10B981' : '#F59E0B' }}
                                    >
                                      {isOff ? <Power size={15} /> : <PowerOff size={15} />}
                                    </button>
                                    <button onClick={() => handleOpenFoodModal(food)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Settings size={15} /></button>
                                    <button onClick={() => handleDeleteFood(food.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-cancelled)' }}><LogOut size={15} /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* MODAL FOOD (ADMIN) */}
              {isFoodModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card" style={{ width: '100%', maxWidth: '480px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>{editingFood ? '✏️ Sửa Món Ăn' : '➕ Thêm Món Ăn'}</h2>
                    <form onSubmit={handleSaveFood} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="input-group">
                        <label>Mã món (code) *</label>
                        <input type="text" required value={foodFormData.code} onChange={e => setFoodFormData({ ...foodFormData, code: e.target.value })} className="input-field" placeholder="VD: COM001" />
                      </div>
                      <div className="input-group">
                        <label>Tên món ăn *</label>
                        <input type="text" required value={foodFormData.foodName} onChange={e => setFoodFormData({ ...foodFormData, foodName: e.target.value })} className="input-field" placeholder="VD: Cơm chiên dương châu" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="input-group">
                          <label>Giá (đ) *</label>
                          <input type="number" required min="1000" value={foodFormData.price} onChange={e => setFoodFormData({ ...foodFormData, price: e.target.value })} className="input-field" placeholder="45000" />
                        </div>
                        <div className="input-group">
                          <label>Danh mục *</label>
                          <select required value={foodFormData.categoryId} onChange={e => setFoodFormData({ ...foodFormData, categoryId: e.target.value })} className="input-field">
                            <option value="">-- Chọn danh mục --</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>Các tuỳ chọn thêm (ngăn cách bởi dấu phẩy)</label>
                        <input
                          type="text"
                          value={foodFormData.options || ''}
                          onChange={e => setFoodFormData({ ...foodFormData, options: e.target.value })}
                          className="input-field"
                          placeholder="Ví dụ: Tương cà, Tương ớt, Thêm cay"
                        />
                      </div>
                      <div className="input-group">
                        <label>🖼️ Hình ảnh món ăn</label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <input
                            type="text"
                            value={foodFormData.imageUrl || ''}
                            onChange={e => setFoodFormData({ ...foodFormData, imageUrl: e.target.value })}
                            className="input-field"
                            placeholder="Nhập URL ảnh hoặc bấm chọn tải lên..."
                            style={{ flex: 1, margin: 0 }}
                          />
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', padding: '0 16px', height: '42px', margin: 0 }}
                            onClick={() => document.getElementById('food-image-file').click()}
                            disabled={isUploadingImage}
                          >
                            {isUploadingImage ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                            {isUploadingImage ? 'Đang tải...' : 'Tải lên'}
                          </button>
                          <input
                            id="food-image-file"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFoodImageUpload}
                          />
                        </div>
                        {foodFormData.imageUrl && (
                          <div style={{ marginTop: '10px', borderRadius: '10px', overflow: 'hidden', height: '140px', background: '#f1f5f9', position: 'relative' }}>
                            <img
                              src={foodFormData.imageUrl}
                              alt="preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onLoad={e => { e.target.style.display = 'block'; e.target.nextSibling.style.display = 'none'; }}
                              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                            <div style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              height: '100%', gap: '6px', color: '#ef4444', fontSize: '13px'
                            }}>
                              <span style={{ fontSize: '24px' }}>⚠️</span>
                              <span style={{ fontWeight: '600' }}>Không thể hiển thị ảnh (kiểm tra lại URL)</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '0 16px' }}>
                                URL cần hoạt động và không bị chặn cross-origin
                              </span>
                            </div>
                          </div>
                        )}
                        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 0' }}>
                          💡 Tip: Bạn có thể chọn file ảnh từ máy tính hoặc dán URL ảnh trực tiếp từ Google.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button type="button" onClick={() => setIsFoodModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Hủy</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Lưu Món Ăn</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Modal Thêm/Sửa Danh mục */}
              {isCategoryModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card" style={{ width: '100%', maxWidth: '440px', padding: '32px' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>{editingCategory ? '✏️ Sửa Danh Mục' : '➕ Thêm Danh Mục'}</h2>
                    <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="input-group">
                        <label>Mã danh mục (code) *</label>
                        <input type="text" required value={categoryFormData.code} onChange={e => setCategoryFormData({ ...categoryFormData, code: e.target.value })} className="input-field" placeholder="VD: MAIN" />
                      </div>
                      <div className="input-group">
                        <label>Tên danh mục *</label>
                        <input type="text" required value={categoryFormData.name} onChange={e => setCategoryFormData({ ...categoryFormData, name: e.target.value })} className="input-field" placeholder="VD: Món chính" />
                      </div>
                      <div className="input-group">
                        <label>Mô tả (tuỳ chọn)</label>
                        <input type="text" value={categoryFormData.description || ''} onChange={e => setCategoryFormData({ ...categoryFormData, description: e.target.value })} className="input-field" placeholder="Mô tả ngắn về danh mục..." />
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Hủy</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Lưu Danh Mục</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Modal Xem Công Thức Chi Tiết (Cho bếp/admin xem) */}
              {isViewRecipeModalOpen && viewingFoodItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card" style={{ width: '100%', maxWidth: '550px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div>
                        <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>📖 Công thức & Định lượng</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Xem chi tiết cách chế biến và nguyên liệu của món ăn</p>
                      </div>
                      <button onClick={() => setIsViewRecipeModalOpen(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Dish Details Card */}
                      <div style={{ display: 'flex', gap: '16px', backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-app)', flexShrink: 0 }}>
                          {viewingFoodItem.imageUrl ? (
                            <img src={viewingFoodItem.imageUrl} alt={viewingFoodItem.foodName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: '800' }}>
                              {viewingFoodItem.foodName?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B', margin: '0 0 4px' }}>{viewingFoodItem.foodName}</h3>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>Mã món: <strong style={{ color: '#0F172A' }}>{viewingFoodItem.code}</strong></p>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '2px 8px', borderRadius: '12px' }}>
                            {categories.find(c => c.id === viewingFoodItem.categoryId)?.name || 'Chưa rõ'}
                          </span>
                        </div>
                      </div>

                      {/* Recipe Details Section */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>🍳 Hướng dẫn chế biến</h4>
                          {user?.role === 'KITCHEN' && !isEditingRecipeText && (
                            <button 
                              onClick={() => {
                                setIsEditingRecipeText(true);
                                setPendingRecipeText(viewingFoodItem.pendingRecipe || viewingFoodItem.recipe || '');
                              }} 
                              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              ✏️ Đề xuất sửa công thức
                            </button>
                          )}
                        </div>

                        {viewingFoodItem.pendingRecipe && (
                          <div style={{ backgroundColor: '#EFF6FF', borderLeft: '4px solid #3B82F6', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', color: '#1E40AF', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontWeight: '700' }}>⏳ Đang có đề xuất sửa đổi công thức chờ Admin duyệt:</span>
                            <span style={{ fontStyle: 'italic', opacity: 0.9 }}>"{viewingFoodItem.pendingRecipe}"</span>
                          </div>
                        )}

                        {isEditingRecipeText ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <textarea 
                              value={pendingRecipeText} 
                              onChange={e => setPendingRecipeText(e.target.value)} 
                              style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical' }}
                              placeholder="Nhập hướng dẫn chế biến chi tiết..."
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={handleProposeRecipeUpdate} 
                                disabled={isSubmittingRecipeProposal}
                                className="btn btn-primary" 
                                style={{ flex: 1, padding: '8px 12px', fontSize: '13px', backgroundColor: '#10B981', borderColor: '#10B981' }}
                              >
                                {isSubmittingRecipeProposal ? 'Đang gửi...' : '✓ Gửi đề xuất'}
                              </button>
                              <button 
                                onClick={() => setIsEditingRecipeText(false)} 
                                className="btn btn-outline" 
                                style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ 
                            backgroundColor: '#FFFBEB', 
                            borderLeft: '4px solid #F59E0B', 
                            padding: '16px', 
                            borderRadius: '8px', 
                            fontSize: '14px', 
                            lineHeight: '1.6', 
                            color: '#451A03',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '200px',
                            overflowY: 'auto'
                          }}>
                            {viewingFoodItem.recipe || 'Chưa cập nhật hướng dẫn chế biến cho món ăn này.'}
                          </div>
                        )}
                      </div>

                      {/* Ingredient Dosage (Định lượng) Section */}
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>⚖️ Định lượng nguyên liệu (kho)</h4>
                        {loadingRecipe ? (
                          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Đang tải thông tin định lượng...</p>
                        ) : viewingRecipeIngredients.length === 0 ? (
                          <div style={{ backgroundColor: '#F1F5F9', padding: '16px', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            Món ăn này chưa được cấu hình nguyên liệu tự động khấu trừ trong kho.
                          </div>
                        ) : (
                          <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--border-color)' }}>
                                  <th style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Nguyên liệu</th>
                                  <th style={{ padding: '10px 12px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'right' }}>Lượng cần (cho 1 suất)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {viewingRecipeIngredients.map((item, idx) => {
                                  const ing = ingredients.find(i => i.id === item.ingredientId);
                                  return (
                                    <tr key={idx} style={{ borderBottom: idx < viewingRecipeIngredients.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155' }}>
                                        {ing ? ing.name : 'Không xác định'} {ing?.code && <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '400' }}>(#{ing.code})</span>}
                                      </td>
                                      <td style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--primary)', textAlign: 'right' }}>
                                        {item.quantityNeeded} {ing?.unit || ''}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', marginTop: '8px' }}>
                        <button type="button" onClick={() => setIsViewRecipeModalOpen(false)} className="btn btn-primary" style={{ flex: 1, padding: '12px', borderRadius: '10px', backgroundColor: '#11117F', border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer' }}>Đóng</button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

            </motion.div>
          )}

          {/* TABLES TAB - Payment History & Invoices */}
          {activeTab === 'Tables' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#11117F', letterSpacing: '-0.5px' }}>Lịch sử hóa đơn</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Quản lý và tra cứu các giao dịch đã hoàn tất</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={fetchOrdersData} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}>
                    <RefreshCw size={16} /> Làm mới
                  </button>
                  <button 
                    onClick={handleExportReport}
                    className="btn btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', boxShadow: '0 4px 12px rgba(9, 52, 219, 0.2)' }}
                  >
                    <Download size={16} /> Xuất báo cáo
                  </button>
                </div>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #EEF2F6' }}>
                      <th style={{ padding: '20px 24px', color: '#64748B', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Ngày thanh toán</th>
                      <th style={{ padding: '20px 24px', color: '#64748B', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Vị trí bàn</th>
                      <th style={{ padding: '20px 24px', color: '#64748B', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Tổng thanh toán</th>
                      <th style={{ padding: '20px 24px', color: '#64748B', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Trạng thái</th>
                      <th style={{ padding: '20px 24px', color: '#64748B', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allOrders.filter(o => o.status === 'COMPLETED').map(order => (
                      <tr key={order.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'all 0.2s' }} className="table-row-hover">
                        <td style={{ padding: '20px 24px' }}>
                          <div style={{ color: '#475569', fontSize: '13px', fontWeight: '700' }}>{new Date(order.updatedAt || order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div style={{ color: '#94A3B8', fontSize: '11px' }}>{new Date(order.updatedAt || order.createdAt).toLocaleDateString('vi-VN')}</div>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#11117F', fontWeight: '800', fontSize: '12px' }}>
                              {String(order.tableNumber || '').replace(/Bàn\s*/i, '') || '?'}
                            </div>
                            <span style={{ fontWeight: '600', color: '#1E293B' }}>
                              {String(order.tableNumber || '').includes('Bàn') ? order.tableNumber : `Bàn ${order.tableNumber || order.tableId}`}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '16px' }}>
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.totalAmount || order.totalPrice || 0)}
                          </div>
                        </td>
                        <td style={{ padding: '20px 24px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', backgroundColor: '#DCFCE7', color: '#166534' }}>
                            <CheckCircle size={14} /> Thành công
                          </span>
                        </td>
                        <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                          <button
                            className="btn-ghost"
                            style={{ color: '#6366F1', fontWeight: '700', fontSize: '13px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', border: 'none', background: 'transparent' }}
                            onClick={() => {
                              setSelectedInvoice(order);
                              setIsInvoiceModalOpen(true);
                            }}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                    {allOrders.filter(o => o.status === 'COMPLETED').length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ padding: '100px 24px', textAlign: 'center' }}>
                          <div style={{ opacity: 0.4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <ClipboardList size={64} strokeWidth={1.5} />
                            <div>
                              <p style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B', margin: 0 }}>Chưa có hóa đơn nào</p>
                              <p style={{ fontSize: '14px', color: '#64748B', marginTop: '4px' }}>Dữ liệu thanh toán sẽ xuất hiện tại đây sau khi hoàn tất đơn hàng.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
          {/* TÀI KHOẢN TAB (trước đây "Staff") — 2 sub-tab: Nhân viên (giữ nguyên) / Khách hàng (mới, chỉ xem) */}
          {activeTab === 'Staff' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-app)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => setAccountSubTab('staff')}
                    style={{
                      padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                      backgroundColor: accountSubTab === 'staff' ? 'var(--primary)' : 'transparent',
                      color: accountSubTab === 'staff' ? '#FFF' : 'var(--text-secondary)', transition: 'all 0.15s'
                    }}
                  >
                    Nhân viên
                  </button>
                  <button
                    onClick={() => setAccountSubTab('customer')}
                    style={{
                      padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                      backgroundColor: accountSubTab === 'customer' ? 'var(--primary)' : 'transparent',
                      color: accountSubTab === 'customer' ? '#FFF' : 'var(--text-secondary)', transition: 'all 0.15s'
                    }}
                  >
                    Khách hàng
                  </button>
                </div>
                {accountSubTab === 'staff' ? (
                  <button onClick={() => handleOpenStaffModal()} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>
                    <Users size={16} /> Add Staff
                  </button>
                ) : (
                  <button onClick={() => fetchCustomersData()} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                    <RefreshCw size={16} /> Làm mới
                  </button>
                )}
              </div>

              {accountSubTab === 'staff' && (
                <>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Staff Directory</h3>
                  {loadingConfig.staff ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading staff data...</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>ID</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Full Name</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Birthday</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Role</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Contact</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Server</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staff.map((person) => {
                            const roleLabel = { 0: 'WAITER', 1: 'ADMIN', 2: 'CHEF', 3: 'KITCHEN' }[person.role] || String(person.role);
                            const roleBg = { 0: '#EFF6FF', 1: '#FEF3C7', 2: '#D1FAE5', 3: '#FFF7ED' }[person.role] || '#EFF6FF';
                            const roleColor = { 0: '#1D4ED8', 1: '#92400E', 2: '#065F46', 3: '#C2410C' }[person.role] || '#1D4ED8';
                            return (
                              <tr key={person.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.id}</td>
                                <td style={{ padding: '16px', fontWeight: '700', color: '#11117F' }}>{person.fullName || 'N/A'}</td>
                                <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} style={{ opacity: 0.6 }} />
                                    {formatDate(person.birthday)}
                                  </div>
                                </td>
                                <td style={{ padding: '16px' }}>
                                  <span style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: roleBg, border: `1px solid ${roleColor}40`, fontWeight: '700', color: roleColor }}>
                                    {roleLabel}
                                  </span>
                                </td>
                                <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                  <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{person.phoneNumber || '-'}</div>
                                  <div style={{ opacity: 0.8 }}>{person.email || '-'}</div>
                                </td>
                                <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button onClick={() => handleOpenStaffModal(person)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }} title="Chỉnh sửa"><Settings size={16} /></button>
                                    <button onClick={() => handleDeleteStaff(person.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-cancelled)', padding: '4px' }} title="Xóa nhân viên"><LogOut size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {staff.length === 0 && (
                            <tr><td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No staff found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {accountSubTab === 'customer' && (
                <>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>Danh sách khách hàng</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Chỉ xem — không thể chỉnh sửa thông tin khách hàng ở đây.</p>
                  {loadingConfig.customers ? (
                    <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Đang tải danh sách khách hàng...</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Họ tên</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Liên hệ</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Hạng</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Điểm</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Đã chi tiêu</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}>Trạng thái</th>
                            <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '500' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {customers.map((c) => {
                            const tierColorMap = { BRONZE: '#B45309', SILVER: '#64748B', GOLD: '#CA8A04', DIAMOND: '#0891B2' };
                            const tierColor = tierColorMap[c.tierRank] || '#64748B';
                            const isLocked = c.status === 'LOCKED';
                            return (
                              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '16px', fontWeight: '700', color: '#11117F' }}>{c.fullName || 'N/A'}</td>
                                <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                  <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{c.phone || '-'}</div>
                                  <div style={{ opacity: 0.8 }}>{c.email || '-'}</div>
                                </td>
                                <td style={{ padding: '16px' }}>
                                  <span style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: `${tierColor}20`, border: `1px solid ${tierColor}40`, fontWeight: '700', color: tierColor }}>
                                    {c.tierName || c.tierRank || '-'}
                                  </span>
                                </td>
                                <td style={{ padding: '16px', fontWeight: '600' }}>{(c.currentPoints ?? 0).toLocaleString('vi-VN')}</td>
                                <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(c.totalSpent || 0)}</td>
                                <td style={{ padding: '16px' }}>
                                  <span style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', backgroundColor: isLocked ? '#FEE2E2' : '#D1FAE5', border: `1px solid ${isLocked ? '#EF4444' : '#10B981'}40`, fontWeight: '700', color: isLocked ? '#B91C1C' : '#065F46' }}>
                                    {isLocked ? 'Đã khoá' : 'Hoạt động'}
                                  </span>
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                  <button onClick={() => openCustomerDetail(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }} title="Xem chi tiết"><Search size={16} /></button>
                                </td>
                              </tr>
                            );
                          })}
                          {customers.length === 0 && (
                            <tr><td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chưa có khách hàng nào.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* MODAL: Chi tiết khách hàng (chỉ xem) */}
          {showCustomerDetailModal && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setShowCustomerDetailModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="card" style={{ padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Chi tiết khách hàng</h3>
                  <button onClick={() => setShowCustomerDetailModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                </div>

                {customerDetailLoading || !customerDetail ? (
                  <p style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>Đang tải...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Họ tên</p><p style={{ margin: '2px 0 0', fontWeight: '600' }}>{customerDetail.fullName || 'N/A'}</p></div>
                      <div><p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>SĐT</p><p style={{ margin: '2px 0 0', fontWeight: '600' }}>{customerDetail.phone || '-'}</p></div>
                      <div><p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Email</p><p style={{ margin: '2px 0 0', fontWeight: '600' }}>{customerDetail.email || '-'}</p></div>
                      <div><p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Ngày tạo</p><p style={{ margin: '2px 0 0', fontWeight: '600' }}>{customerDetail.createdAt ? formatDate(customerDetail.createdAt) : '-'}</p></div>
                      <div><p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Hạng thành viên</p><p style={{ margin: '2px 0 0', fontWeight: '600' }}>{customerDetail.tierName || customerDetail.tierRank || '-'}</p></div>
                      <div><p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Trạng thái</p><p style={{ margin: '2px 0 0', fontWeight: '600' }}>{customerDetail.status === 'LOCKED' ? 'Đã khoá' : 'Hoạt động'}</p></div>
                      <div><p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Điểm hiện tại</p><p style={{ margin: '2px 0 0', fontWeight: '700', color: '#CA8A04' }}>{(customerDetail.currentPoints ?? 0).toLocaleString('vi-VN')}</p></div>
                      <div><p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Tổng chi tiêu</p><p style={{ margin: '2px 0 0', fontWeight: '700' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(customerDetail.totalSpent || 0)}</p></div>
                    </div>

                    <div>
                      <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Lịch sử điểm</p>
                      <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                        {(customerDetail.pointsHistory || []).length === 0 ? (
                          <p style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Chưa có giao dịch điểm nào.</p>
                        ) : (
                          customerDetail.pointsHistory.map((tx, idx) => (
                            <div key={tx.id || idx} style={{ padding: '10px 14px', borderBottom: idx === customerDetail.pointsHistory.length - 1 ? 'none' : '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{tx.description || tx.type || 'Giao dịch điểm'}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>{tx.createdAt ? formatDate(tx.createdAt) : ''}</p>
                              </div>
                              <span style={{ fontWeight: '700', color: (tx.points ?? 0) >= 0 ? '#059669' : '#DC2626' }}>{(tx.points ?? 0) >= 0 ? '+' : ''}{tx.points ?? 0}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* SETTINGS TAB - System Configuration */}
          {activeTab === 'Settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

              {/* Table Management Section — ADMIN only */}
              {user?.role === 'ADMIN' && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: 'var(--primary)' }}>🪑 {t.tableManagement}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{lang === 'vi' ? 'Thêm, sửa, xóa các bàn trong nhà hàng' : 'Add, edit, remove tables in the restaurant'}</p>
                  </div>
                  <button onClick={() => handleOpenTableModal()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> {t.addTable}
                  </button>
                </div>

                {loadingConfig.tables ? (
                  <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>{t.loading}</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                    {tables.map(table => {
                      const tableId = table.id || table.ID;
                      return (
                        <div key={tableId} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ display: 'block', fontWeight: '700', fontSize: '16px' }}>Bàn {table.tableNumber}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{table.capacity} chỗ &middot; {table.location || '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setSelectedTableForQR(table)} className="btn-ghost" style={{ color: 'var(--primary)', padding: '4px' }} title="Mã QR Đặt Món"><QrCode size={16} /></button>
                            <button onClick={() => handleOpenTableModal(table)} className="btn-ghost" style={{ color: 'var(--primary)', padding: '4px' }}><Settings size={16} /></button>
                            <button onClick={() => handleDeleteTable(tableId)} className="btn-ghost" style={{ color: 'var(--status-cancelled)', padding: '4px' }}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )} {/* end ADMIN-only Table Management */}

              {/* App Preferences Section */}
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: 'var(--primary)' }}>🎨 {t.appPreferences}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{t.appPreferencesDesc}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Dark Mode */}
                  <div
                    onClick={() => setIsDarkMode(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: '14px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: isDarkMode ? 'rgba(99,102,241,0.15)' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🌙</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>{t.darkMode}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{isDarkMode ? t.darkModeOn : t.darkModeOff}</p>
                      </div>
                    </div>
                    <div style={{ width: '52px', height: '28px', borderRadius: '14px', backgroundColor: isDarkMode ? '#6366F1' : '#CBD5E1', position: 'relative', transition: 'background 0.3s', flexShrink: 0 }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#FFF', position: 'absolute', top: '3px', left: isDarkMode ? '27px' : '3px', transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>

                  {/* Sound Notification */}
                  <div
                    onClick={() => setSoundEnabled(v => { const n = !v; localStorage.setItem('soundEnabled', String(n)); return n; })}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: '14px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: soundEnabled ? 'rgba(16,185,129,0.15)' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{soundEnabled ? '🔔' : '🔕'}</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>{t.soundNotif}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{soundEnabled ? t.soundOn : t.soundOff}</p>
                      </div>
                    </div>
                    <div style={{ width: '52px', height: '28px', borderRadius: '14px', backgroundColor: soundEnabled ? '#10B981' : '#CBD5E1', position: 'relative', transition: 'background 0.3s', flexShrink: 0 }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#FFF', position: 'absolute', top: '3px', left: soundEnabled ? '27px' : '3px', transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>

                  {/* Language */}
                  <div
                    onClick={toggleLang}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: '14px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(17,17,127,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🌐</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>{t.language}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{t.langDesc}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['vi', 'en'].map(l => (
                        <span key={l} style={{ padding: '6px 14px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', backgroundColor: lang === l ? 'var(--primary)' : 'var(--bg-surface)', color: lang === l ? '#FFF' : 'var(--text-secondary)', border: `1px solid ${lang === l ? 'var(--primary)' : 'var(--border-color)'}`, transition: 'all 0.2s' }}>
                          {l.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* KDS Settings Section — ADMIN & KITCHEN */}
              {(user?.role === 'ADMIN' || user?.role === 'KITCHEN') && (
              <div className="card" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: 'var(--primary)' }}>🍳 Cấu hình Bếp (KDS)</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Áp dụng cho màn hình bếp trên thiết bị này. Chỉnh theo tốc độ nấu thực tế của quán.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div className="input-group">
                    <label>⚠️ Cảnh báo món chậm sau (phút)</label>
                    <input type="number" min="1" className="input-field"
                      value={kdsSettings.warningMinutes}
                      onChange={e => updateKdsSetting('warningMinutes', e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>🔴 Báo động đỏ sau (phút)</label>
                    <input type="number" min="1" className="input-field"
                      value={kdsSettings.criticalMinutes}
                      onChange={e => updateKdsSetting('criticalMinutes', e.target.value)} />
                  </div>
                </div>

                <div style={{ paddingTop: '16px', borderTop: '1px dashed var(--border-color)' }}>
                  <p style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 4px' }}>Tự động chuyển trạng thái (đỡ phải chạm màn hình)</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
                    Để 0 = tắt (giữ nguyên thao tác tay như hiện tại). Bật lên nếu bếp bận tay liên tục và muốn hệ thống tự chạy vé.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    <div className="input-group">
                      <label>Tự chuyển "Chờ" → "Đang nấu" sau (phút, 0 = tắt)</label>
                      <input type="number" min="0" className="input-field"
                        value={kdsSettings.autoStartMinutes}
                        onChange={e => updateKdsSetting('autoStartMinutes', e.target.value)} />
                    </div>
                    <div className="input-group">
                      <label>Tự chuyển "Đang nấu" → "Sẵn sàng" sau (phút, 0 = tắt)</label>
                      <input type="number" min="0" className="input-field"
                        value={kdsSettings.autoReadyMinutes}
                        onChange={e => updateKdsSetting('autoReadyMinutes', e.target.value)} />
                    </div>
                  </div>
                  {kdsSettings.autoReadyMinutes > 0 && (
                    <p style={{ fontSize: '12px', color: '#B45309', backgroundColor: '#FFFBEB', padding: '10px 12px', borderRadius: '8px', marginTop: '12px', borderLeft: '3px solid #F59E0B' }}>
                      ⚠️ Hệ thống sẽ tự đánh dấu món "Sẵn sàng" mà không cần bếp xác nhận tay. Chỉ nên bật nếu bạn tự tin về thời gian nấu trung bình của quán — nếu không, nhân viên phục vụ có thể mang món chưa thật sự xong ra bàn.
                    </p>
                  )}
                </div>

                <div style={{ paddingTop: '16px', marginTop: '16px', borderTop: '1px dashed var(--border-color)' }}>
                  <div
                    onClick={() => updateKdsSetting('autoPrintOnCooking', kdsSettings.autoPrintOnCooking ? 0 : 1)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: '14px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: kdsSettings.autoPrintOnCooking ? 'rgba(99,102,241,0.15)' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🖨️</div>
                      <div>
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>Tự in phiếu khi tự động chuyển "Đang nấu"</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {kdsSettings.autoPrintOnCooking ? 'Đang bật — chỉ áp dụng khi "Tự chuyển Chờ → Đang nấu" ở trên > 0' : 'Đang tắt'}. Chưa có máy in thật nên sẽ tải về 1 ảnh mô phỏng tờ phiếu.
                        </p>
                      </div>
                    </div>
                    <div style={{ width: '52px', height: '28px', borderRadius: '14px', backgroundColor: kdsSettings.autoPrintOnCooking ? '#6366F1' : '#CBD5E1', position: 'relative', transition: 'background 0.3s', flexShrink: 0 }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#FFF', position: 'absolute', top: '3px', left: kdsSettings.autoPrintOnCooking ? '27px' : '3px', transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>
                </div>
              </div>
              )} {/* end KDS Settings */}

              {isTableModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '24px' }}>{editingTable ? '✏️ Sửa Thông Tin Bàn' : '➕ Thêm Bàn Mới'}</h2>
                    <form onSubmit={handleSaveTable} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="input-group">
                        <label>Số bàn *</label>
                        <input type="number" required value={tableFormData.tableNumber} onChange={e => setTableFormData({ ...tableFormData, tableNumber: e.target.value })} className="input-field" placeholder="VD: 10" />
                      </div>
                      <div className="input-group">
                        <label>Sức chứa (người) *</label>
                        <input type="number" required min="1" value={tableFormData.capacity} onChange={e => setTableFormData({ ...tableFormData, capacity: e.target.value })} className="input-field" placeholder="VD: 4" />
                      </div>
                      <div className="input-group">
                        <label>Vị trí (tầng, khu vực)</label>
                        <input type="text" value={tableFormData.location} onChange={e => setTableFormData({ ...tableFormData, location: e.target.value })} className="input-field" placeholder="VD: Tầng 1, cạnh cửa sổ" />
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button type="button" onClick={() => setIsTableModalOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>Hủy</button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Lưu Bàn</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* PROFILE TAB - Trang cá nhân */}
          {activeTab === 'Profile' && (() => {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const jwtData = token ? parseJwt(token) : null;
            const loginAt = jwtData?.iat ? new Date(jwtData.iat * 1000) : null;
            const expAt  = jwtData?.exp ? new Date(jwtData.exp * 1000) : null;
            const roleColors = { ADMIN: '#6366f1', WAITER: '#10b981', KITCHEN: '#f59e0b', GUEST: '#94a3b8' };
            const roleColor = roleColors[user?.role] || '#94a3b8';
            const initials = (user?.fullName || user?.username || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Hero Card */}
                <div style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', position: 'relative' }}>
                  {/* Banner */}
                  <div style={{ height: '110px', background: `linear-gradient(135deg, ${roleColor}cc, #6366f1)`, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
                  </div>
                  {/* Body */}
                  <div style={{ background: 'var(--bg-surface)', padding: '0 32px 28px', position: 'relative' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '88px', height: '88px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${roleColor}, #6366f1)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: '34px', fontWeight: '800',
                      border: '4px solid var(--bg-surface)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                      position: 'absolute', top: '-44px', left: '32px',
                    }}>{initials}</div>
                    {/* Role badge */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px' }}>
                      <span style={{
                        background: roleColor + '22', color: roleColor,
                        border: `1px solid ${roleColor}66`,
                        borderRadius: '20px', padding: '4px 14px',
                        fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px'
                      }}>{(t.roleBadge || {})[user?.role] || user?.role}</span>
                    </div>
                    {/* Name */}
                    <div style={{ marginTop: '32px' }}>
                      <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px' }}>{user?.fullName || user?.username}</h2>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>@{user?.username}</p>
                    </div>
                  </div>
                </div>

                {/* Info Cards Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                  {/* Account Info */}
                  <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UserIcon size={17} /> {t.accountInfo}
                    </h3>
                    {[
                      { label: t.usernameLabel,    value: user?.username || '—' },
                      { label: t.displayNameLabel, value: user?.fullName  || '—' },
                      { label: t.roleLabel,        value: (t.roleBadge || {})[user?.role] || user?.role || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Session Info */}
                  <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={17} /> {t.sessionInfo}
                    </h3>
                    {[
                      { label: t.loginTime,  value: loginAt ? loginAt.toLocaleString('vi-VN') : '—' },
                      { label: t.expireTime, value: expAt   ? expAt.toLocaleString('vi-VN')   : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)', fontFamily: 'monospace' }}>{value}</span>
                      </div>
                    ))}
                    {/* Token expiry bar */}
                    {jwtData?.iat && jwtData?.exp && (() => {
                      const total = jwtData.exp - jwtData.iat;
                      const elapsed = Math.floor(Date.now() / 1000) - jwtData.iat;
                      const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
                      const barColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981';
                      return (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Phiên đã dùng</span>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: barColor }}>{Math.round(pct)}%</span>
                          </div>
                          <div style={{ height: '6px', borderRadius: '4px', background: 'var(--border-color)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Logout button */}
                <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 2px' }}>{t.logout}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{lang === 'vi' ? 'Kết thúc phiên làm việc hiện tại' : 'End your current working session'}</p>
                  </div>
                  <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>
                    <LogOut size={17} /> {t.logout}
                  </button>
                </div>

              </motion.div>
            );
          })()}

          {/* Development Placeholders for others */}
          {activeTab === 'Reports' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              
              {/* Sub-tab navigation */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'var(--bg-card)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', width: 'fit-content' }}>
                <button
                  onClick={() => setReportSubTab('REVENUE')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                    backgroundColor: reportSubTab === 'REVENUE' ? 'var(--primary)' : 'transparent',
                    color: reportSubTab === 'REVENUE' ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  <TrendingUp size={16} />
                  Doanh Thu Món Ăn
                </button>
                <button
                  onClick={() => setReportSubTab('COMPARISON')}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                    backgroundColor: reportSubTab === 'COMPARISON' ? 'var(--primary)' : 'transparent',
                    color: reportSubTab === 'COMPARISON' ? 'white' : 'var(--text-secondary)',
                    transition: 'all 0.2s'
                  }}
                >
                  <ClipboardList size={16} />
                  Đối Soát Kho & Doanh Thu
                </button>
              </div>

              {/* TAB 1: REVENUE REPORTING (EXISTING VIEW) */}
              {reportSubTab === 'REVENUE' && (
                <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(17, 17, 127, 0.1)', color: '#11117F' }}>
                        <BarChartIcon size={24} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#11117F', margin: 0 }}> {t.reportTitle} </h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>{t.reportSubtitle}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '4px', borderRadius: '12px' }}>
                      {['DAY', 'MONTH', 'YEAR', 'CATEGORY'].map(type => (
                        <button
                          key={type}
                          onClick={() => fetchReportData(type)}
                          style={{
                            padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            fontWeight: '700', fontSize: '12px',
                            backgroundColor: reportType === type ? '#FFF' : 'transparent',
                            color: reportType === type ? '#11117F' : '#64748B',
                            boxShadow: reportType === type ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none'
                          }}
                        >
                          {type === 'DAY' ? '📅 Ngày' : type === 'MONTH' ? '🗓️ Tháng' : type === 'YEAR' ? '📆 Năm' : '🍔 Món Ăn'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <motion.div
                    key={reportType}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{ height: '450px', width: '100%', marginTop: '20px' }}
                  >
                    {loadingConfig.reports ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <RefreshCw className="animate-spin" size={32} color="var(--primary)" />
                      </div>
                    ) : reportData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '100px 0' }}>
                        <TrendingUp size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Chưa có đủ dữ liệu để tạo biểu đồ.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        {reportType !== 'CATEGORY' ? (
                          <BarChart data={reportData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                            <defs>
                              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4F46E5" stopOpacity={1} />
                                <stop offset="100%" stopColor="#11117F" stopOpacity={0.85} />
                              </linearGradient>
                              <linearGradient id="barGradientHover" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#818CF8" stopOpacity={1} />
                                <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.9} />
                              </linearGradient>
                              <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#11117F" floodOpacity="0.25" />
                              </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748B', fontWeight: 600 }}
                              dy={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#94A3B8' }}
                              tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                            />
                            <Tooltip
                              cursor={{ fill: 'rgba(79,70,229,0.06)', radius: 8 }}
                              contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.12)', padding: '12px 16px' }}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const val = payload[0].value;
                                return (
                                  <div style={{ background: '#FFF', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 20px 40px rgba(0,0,0,0.12)', minWidth: '170px' }}>
                                    <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'linear-gradient(135deg,#4F46E5,#11117F)', display: 'inline-block' }} />
                                      <div>
                                        <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#11117F' }}>{new Intl.NumberFormat('vi-VN').format(val)}đ</p>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>Doanh thu</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Bar
                              dataKey="value"
                              fill="url(#barGradient)"
                              radius={[8, 8, 0, 0]}
                              barSize={42}
                              isAnimationActive={true}
                              animationDuration={1000}
                              animationEasing="ease-out"
                              activeBar={{ fill: 'url(#barGradientHover)', filter: 'url(#barShadow)' }}
                            />
                          </BarChart>
                        ) : (
                          <PieChart>
                            <defs>
                              {reportData.map((entry, index) => {
                                const hue = Math.round((index * 137.508) % 360);
                                return (
                                  <filter key={`glow-${index}`} id={`glow-${index}`} x="-30%" y="-30%" width="160%" height="160%">
                                    <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={`hsl(${hue},65%,52%)`} floodOpacity="0.6" />
                                  </filter>
                                );
                              })}
                            </defs>
                            <Pie
                              data={reportData}
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={130}
                              paddingAngle={4}
                              dataKey="value"
                              isAnimationActive={true}
                              animationBegin={0}
                              animationDuration={1100}
                              animationEasing="ease-out"
                              activeShape={(props) => {
                                const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, index } = props;
                                const total = reportData.reduce((s, d) => s + (d.value || 0), 0);
                                const pct = total > 0 ? ((payload.value / total) * 100).toFixed(1) : '0';
                                const RADIAN = Math.PI / 180;
                                const expandedOuter = outerRadius + 16;
                                const sin = Math.sin(-RADIAN * ((startAngle + endAngle) / 2));
                                const cos = Math.cos(-RADIAN * ((startAngle + endAngle) / 2));
                                const hue = Math.round((index * 137.508) % 360);
                                const x1o = cx + expandedOuter * cos; const y1o = cy + expandedOuter * sin;
                                return (
                                  <g>
                                    <path
                                      d={`M ${cx + innerRadius * Math.cos(-RADIAN * startAngle)} ${cy + innerRadius * Math.sin(-RADIAN * startAngle)}
                                         L ${cx + expandedOuter * Math.cos(-RADIAN * startAngle)} ${cy + expandedOuter * Math.sin(-RADIAN * startAngle)}
                                         A ${expandedOuter} ${expandedOuter} 0 ${endAngle - startAngle > 180 ? 1 : 0} 0
                                           ${cx + expandedOuter * Math.cos(-RADIAN * endAngle)} ${cy + expandedOuter * Math.sin(-RADIAN * endAngle)}
                                         L ${cx + innerRadius * Math.cos(-RADIAN * endAngle)} ${cy + innerRadius * Math.sin(-RADIAN * endAngle)}
                                         A ${innerRadius} ${innerRadius} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1
                                           ${cx + innerRadius * Math.cos(-RADIAN * startAngle)} ${cy + innerRadius * Math.sin(-RADIAN * startAngle)} Z`}
                                      fill={fill}
                                      filter={`url(#glow-${index})`}
                                      style={{ transition: 'all 0.2s ease' }}
                                    />
                                    <text x={cx} y={cy - 14} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '28px', fontWeight: '900', fill: `hsl(${hue},65%,42%)`, fontFamily: 'sans-serif' }}>
                                      {pct}%
                                    </text>
                                    <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '12px', fontWeight: '700', fill: '#475569', fontFamily: 'sans-serif' }}>
                                      {payload.name.length > 14 ? payload.name.slice(0, 13) + '…' : payload.name}
                                    </text>
                                    <text x={cx} y={cy + 34} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '11px', fill: '#94a3b8', fontFamily: 'sans-serif' }}>
                                      {new Intl.NumberFormat('vi-VN').format(payload.value)}đ
                                    </text>
                                  </g>
                                );
                              }}
                            >
                              {reportData.map((entry, index) => {
                                const hue = (index * 137.508) % 360;
                                const color = `hsl(${Math.round(hue)}, 65%, 52%)`;
                                return <Cell key={`cell-${index}`} fill={color} />;
                              })}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        )}
                      </ResponsiveContainer>
                    )}
                  </motion.div>

                  {(() => {
                    const now = new Date();
                    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                    const thisMonthStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
                    const thisYearStr = `${now.getFullYear()}`;

                    let currentPeriodRevenue = 0;
                    let currentPeriodLabel = '';

                    if (reportType === 'DAY') {
                      const todayEntry = reportData.find(d => d.name === todayStr);
                      currentPeriodRevenue = todayEntry ? todayEntry.value : 0;
                      currentPeriodLabel = `Hôm nay (${todayStr})`;
                    } else if (reportType === 'MONTH') {
                      const monthEntry = reportData.find(d => d.name === thisMonthStr);
                      currentPeriodRevenue = monthEntry ? monthEntry.value : 0;
                      currentPeriodLabel = `Tháng này (${thisMonthStr})`;
                    } else if (reportType === 'YEAR') {
                      const yearEntry = reportData.find(d => d.name === thisYearStr);
                      currentPeriodRevenue = yearEntry ? yearEntry.value : 0;
                      currentPeriodLabel = `Năm nay (${thisYearStr})`;
                    } else {
                      currentPeriodRevenue = reportData.reduce((acc, curr) => acc + curr.value, 0);
                      currentPeriodLabel = 'Tổng tất cả danh mục';
                    }

                    const totalAllRevenue = reportData.reduce((acc, curr) => acc + curr.value, 0);
                    const typeLabel = reportType === 'DAY' ? '📅 Theo Ngày' : reportType === 'MONTH' ? '🗓️ Theo Tháng' : reportType === 'YEAR' ? '📆 Theo Năm' : '🍔 Theo Món Ăn';

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '24px' }}>
                        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #11117F' }}>
                          <p style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DOANH THU KỲ NÀY</p>
                          <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 8px' }}>{currentPeriodLabel}</p>
                          <h4 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#11117F' }}>
                            {new Intl.NumberFormat('vi-VN').format(currentPeriodRevenue)}đ
                          </h4>
                        </div>
                        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10B981' }}>
                          <p style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TỔNG CỘNG (TẤT CẢ KỲ)</p>
                          <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 8px' }}>{reportData.length} kỳ trong biểu đồ</p>
                          <h4 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#10B981' }}>
                            {new Intl.NumberFormat('vi-VN').format(totalAllRevenue)}đ
                          </h4>
                        </div>
                        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #F59E0B' }}>
                          <p style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ĐANG XEM</p>
                          <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 8px' }}>Loại báo cáo hiện tại</p>
                          <h4 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#F59E0B' }}>{typeLabel}</h4>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 2: INVENTORY & REVENUE COMPARISON (NEW DASHBOARD) */}
              {reportSubTab === 'COMPARISON' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Control filter panel */}
                  <div className="card" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(17, 17, 127, 0.1)', color: '#11117F' }}>
                        <ClipboardList size={24} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#11117F', margin: 0 }}>Đối Soát Doanh Thu & Kho Hàng</h3>
                        <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0' }}>So sánh doanh số với biến động nhập xuất nguyên liệu</p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      {/* Date Picker */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>CHỌN NGÀY</label>
                        <input
                          type="date"
                          value={compDate}
                          onChange={(e) => setCompDate(e.target.value)}
                          style={{
                            padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
                            fontWeight: '600', fontSize: '13px', color: '#334155', outline: 'none'
                          }}
                        />
                      </div>
                      
                      {/* Period Switch */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>KỲ BÁO CÁO</label>
                        <select
                          value={compPeriod}
                          onChange={(e) => {
                            setCompPeriod(e.target.value);
                            if (e.target.value === 'WEEK') setCompShift('ALL');
                          }}
                          style={{
                            padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
                            fontWeight: '600', fontSize: '13px', color: '#334155', outline: 'none', background: 'white'
                          }}
                        >
                          <option value="DAY">Theo Ngày</option>
                          <option value="WEEK">Theo Tuần</option>
                        </select>
                      </div>

                      {/* Shift Switch */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>CA LÀM VIỆC</label>
                        <select
                          value={compShift}
                          disabled={compPeriod === 'WEEK'}
                          onChange={(e) => setCompShift(e.target.value)}
                          style={{
                            padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
                            fontWeight: '600', fontSize: '13px', color: '#334155', outline: 'none', background: 'white',
                            opacity: compPeriod === 'WEEK' ? 0.6 : 1
                          }}
                        >
                          <option value="ALL">Tất cả ca</option>
                          <option value="MORNING">Ca Sáng (06h - 14h)</option>
                          <option value="AFTERNOON">Ca Chiều (14h - 22h)</option>
                          <option value="NIGHT">Ca Tối (22h - 06h)</option>
                        </select>
                      </div>

                      {/* Export PDF Button */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'stretch', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleDownloadCompPDF}
                          disabled={!compData || loadingComp}
                          style={{
                            padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            fontWeight: '700', fontSize: '13px', backgroundColor: '#10B981', color: 'white',
                            display: 'flex', alignItems: 'center', gap: '6px', height: '37px',
                            transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(16,185,129,0.2)',
                            opacity: (!compData || loadingComp) ? 0.6 : 1
                          }}
                        >
                          <Download size={15} />
                          Xuất PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* LOADING OR EMPTY LAYOUT */}
                  {loadingComp ? (
                    <div className="card" style={{ padding: '80px 0', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <RefreshCw className="animate-spin" size={36} color="var(--primary)" />
                    </div>
                  ) : !compData ? (
                    <div className="card" style={{ padding: '80px 0', textAlign: 'center' }}>
                      <ClipboardList size={48} style={{ opacity: 0.15, marginBottom: '16px', color: 'var(--primary)' }} />
                      <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Không tìm thấy dữ liệu đối soát phù hợp.</p>
                    </div>
                  ) : (
                    <>
                      {/* KPI METRIC GRID */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                        {/* KPI 1: Doanh thu */}
                        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #11117F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DOANH THU ĐƠN HÀNG</p>
                            <h4 style={{ fontSize: '24px', fontWeight: '800', color: '#11117F', margin: '4px 0' }}>
                              {new Intl.NumberFormat('vi-VN').format(compData.totalRevenue || 0)}đ
                            </h4>
                            <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Từ các đơn hàng COMPLETED</p>
                          </div>
                          <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(17, 17, 127, 0.08)', color: '#11117F' }}>
                            <TrendingUp size={24} />
                          </div>
                        </div>

                        {/* KPI 2: Nhập kho */}
                        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #F59E0B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CHI PHÍ NHẬP HÀNG</p>
                            <h4 style={{ fontSize: '24px', fontWeight: '800', color: '#F59E0B', margin: '4px 0' }}>
                              {new Intl.NumberFormat('vi-VN').format(compData.inventory?.importValue || 0)}đ
                            </h4>
                            <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Nguyên liệu đầu vào</p>
                          </div>
                          <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#F59E0B' }}>
                            <Package size={24} />
                          </div>
                        </div>

                        {/* KPI 3: Lượng đơn */}
                        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10B981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SỐ LƯỢNG ĐƠN HÀNG</p>
                            <h4 style={{ fontSize: '24px', fontWeight: '800', color: '#10B981', margin: '4px 0' }}>
                              {compData.orderCount || 0} đơn
                            </h4>
                            <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Trung bình {new Intl.NumberFormat('vi-VN').format(compData.averageOrderValue || 0)}đ/đơn</p>
                          </div>
                          <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#10B981' }}>
                            <FileText size={24} />
                          </div>
                        </div>

                        {/* KPI 4: Giao dịch kho */}
                        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #8B5CF6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GIAO DỊCH KHO HÀNG</p>
                            <h4 style={{ fontSize: '24px', fontWeight: '800', color: '#8B5CF6', margin: '4px 0' }}>
                              {compData.inventory?.totalTransactions || 0} GD
                            </h4>
                            <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Nhập xuất trong kỳ đối soát</p>
                          </div>
                          <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(139, 92, 246, 0.08)', color: '#8B5CF6' }}>
                            <Archive size={24} />
                          </div>
                        </div>
                      </div>

                      {/* CHARTS LAYOUT */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                        
                        {/* Chart 1: Doanh thu chi tiết theo thời gian */}
                        <div className="card" style={{ padding: '20px' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', margin: '0 0 16px' }}>
                            {compPeriod === 'DAY' ? '⏰ Biểu đồ doanh thu theo giờ' : '📅 Biểu đồ doanh thu trong tuần'}
                          </h4>
                          <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={compData.breakdown} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                <YAxis
                                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                                />
                                <Tooltip
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                  formatter={(val) => [`${new Intl.NumberFormat('vi-VN').format(val)}đ`, 'Doanh thu']}
                                />
                                <Line type="monotone" dataKey="value" stroke="#11117F" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 2: Nhập xuất của 10 nguyên liệu hàng đầu */}
                        <div className="card" style={{ padding: '20px' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#334155', margin: '0 0 16px' }}>
                            📊 Cân đối nhập xuất nguyên vật liệu chính (Top 10)
                          </h4>
                          <div style={{ height: '300px', width: '100%' }}>
                            {(!compData.inventory?.items || compData.inventory.items.length === 0) ? (
                              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
                                Chưa ghi nhận giao dịch nhập xuất nguyên liệu.
                              </div>
                            ) : (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={compData.inventory.items.slice(0, 10).map(item => ({
                                    name: item.ingredientName,
                                    'Lượng Nhập': item.importQuantity || 0,
                                    'Lượng Xuất': item.totalExportQuantity || 0
                                  }))}
                                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                                  <Bar dataKey="Lượng Nhập" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={14} />
                                  <Bar dataKey="Lượng Xuất" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={14} />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* DETAILED AUDIT TABLE CARD */}
                      <div className="card" style={{ padding: '24px', overflowX: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#11117F', margin: 0 }}>
                            📋 Bảng chi tiết đối soát chênh lệch kho
                          </h4>
                          <span style={{ fontSize: '12px', color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' }}>
                            {compData.inventory?.items?.length || 0} nguyên liệu
                          </span>
                        </div>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #E2E8F0', paddingBottom: '12px' }}>
                              <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Tên nguyên liệu</th>
                              <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: '700', color: '#64748B', width: '80px' }}>ĐVT</th>
                              <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: '700', color: '#3B82F6', textAlign: 'right' }}>Lượng Nhập (1)</th>
                              <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: '700', color: '#8B5CF6', textAlign: 'right' }}>Xuất Bán (2)</th>
                              <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: '700', color: '#EF4444', textAlign: 'right' }}>Xuất Hủy (3)</th>
                              <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: '700', color: '#6D28D9', textAlign: 'right' }}>Tổng Xuất (2+3)</th>
                              <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Chênh lệch (1 - Tổng)</th>
                              <th style={{ padding: '12px 8px', fontSize: '12px', fontWeight: '700', color: '#0F172A', textAlign: 'right' }}>Tồn hiện tại</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(!compData.inventory?.items || compData.inventory.items.length === 0) ? (
                              <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: '13px' }}>
                                  Không ghi nhận biến động kho nguyên liệu trong kỳ đối soát.
                                </td>
                              </tr>
                            ) : (
                              compData.inventory.items.map((item, index) => {
                                const netVal = item.netQuantity || 0;
                                return (
                                  <tr
                                    key={item.ingredientId || index}
                                    style={{
                                      borderBottom: '1px solid #F1F5F9',
                                      backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(241, 245, 249, 0.25)',
                                      transition: 'background-color 0.2s'
                                    }}
                                    className="table-row-hover"
                                  >
                                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>{item.ingredientName}</td>
                                    <td style={{ padding: '12px 8px', fontSize: '13px', color: '#64748B', fontWeight: '600' }}>{item.unit || '-'}</td>
                                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: '700', color: '#3B82F6', textAlign: 'right' }}>
                                      {item.importQuantity || 0}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: '600', color: '#8B5CF6', textAlign: 'right' }}>
                                      {item.exportSaleQuantity || 0}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: '600', color: '#EF4444', textAlign: 'right' }}>
                                      {item.exportWasteQuantity || 0}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: '700', color: '#6D28D9', textAlign: 'right' }}>
                                      {item.totalExportQuantity || 0}
                                    </td>
                                    <td
                                      style={{
                                        padding: '12px 8px',
                                        fontSize: '13px',
                                        fontWeight: '800',
                                        textAlign: 'right',
                                        color: netVal < 0 ? '#EF4444' : netVal > 0 ? '#10B981' : '#475569'
                                      }}
                                    >
                                      {netVal > 0 ? `+${netVal}` : netVal}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontSize: '13px', fontWeight: '700', color: '#0F172A', textAlign: 'right' }}>
                                      {item.currentStock || 0}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'Inventory' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Top Navigation for Inventory */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'var(--bg-card)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                {[
                  { key: 'ingredients', label: 'Nguyên Vật Liệu', icon: <Package size={18} /> },
                  { key: 'recipes', label: 'Công Thức Định Lượng', icon: <Archive size={18} /> },
                  { key: 'transactions', label: 'Lịch Sử Kho', icon: <FileText size={18} /> }
                ].map(subTab => (
                  <button
                    key={subTab.key}
                    onClick={() => {
                      setInventoryTab(subTab.key);
                      if (subTab.key === 'recipes' && foods.length > 0 && !selectedMenuItemForRecipe) {
                        handleSelectMenuItemForRecipe(foods[0]);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontWeight: '700', fontSize: '13px', transition: 'var(--transition)',
                      backgroundColor: inventoryTab === subTab.key ? 'var(--primary-light)' : 'transparent',
                      color: inventoryTab === subTab.key ? 'var(--primary)' : 'var(--text-secondary)'
                    }}
                  >
                    {subTab.icon}
                    {subTab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: INGREDIENTS */}
              {inventoryTab === 'ingredients' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                      <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                      <input
                        type="text"
                        placeholder="Tìm kiếm nguyên liệu..."
                        value={searchIngredientQuery}
                        onChange={(e) => setSearchIngredientQuery(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => {
                          setStockTxType('IMPORT');
                          setStockTxForm({ ingredientId: ingredients[0]?.id || '', quantity: '', price: '', reason: '' });
                          setShowStockTransactionModal(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--primary)', backgroundColor: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700' }}
                      >
                        <Plus size={16} />
                        Nhập/Xuất Kho
                      </button>
                      <button
                        onClick={() => {
                          setEditingIngredient(null);
                          setIngredientForm({ name: '', unit: '', minStock: '' });
                          setShowIngredientModal(true);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFF', cursor: 'pointer', fontWeight: '700' }}
                      >
                        <Plus size={16} />
                        Thêm Nguyên Liệu
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Tên nguyên liệu</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Đơn vị tính</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Tồn kho hiện tại</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Ngưỡng tối thiểu</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Trạng thái</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ingredients
                          .filter(ing => ing.name.toLowerCase().includes(searchIngredientQuery.toLowerCase()))
                          .map(ing => {
                            const isLow = ing.currentStock <= ing.minStock;
                            return (
                              <tr key={ing.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '14px 12px', fontWeight: '600' }}>{ing.name}</td>
                                <td style={{ padding: '14px 12px' }}>{ing.unit}</td>
                                <td style={{ padding: '14px 12px', fontWeight: '700' }}>
                                  {parseFloat(ing.currentStock).toFixed(2)}
                                </td>
                                <td style={{ padding: '14px 12px' }}>
                                  {parseFloat(ing.minStock).toFixed(2)}
                                </td>
                                <td style={{ padding: '14px 12px' }}>
                                  <span style={{
                                    padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                                    backgroundColor: isLow ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                    color: isLow ? '#ef4444' : '#10b981'
                                  }}>
                                    {isLow ? '⚠️ Sắp hết hàng' : '✅ An toàn'}
                                  </span>
                                </td>
                                <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => {
                                      setEditingIngredient(ing);
                                      setIngredientForm({ name: ing.name, unit: ing.unit, minStock: ing.minStock });
                                      setShowIngredientModal(true);
                                    }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginRight: '10px' }}
                                  >
                                    <Edit size={16} />
                                  </button>
                                  <button
                                    onClick={() => { setDeleteIngredientState({ id: ing.id, reason: '' }); setShowDeleteIngredientModal(true); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        {ingredients.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chưa có nguyên liệu nào. Hãy thêm mới!</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: RECIPES */}
              {inventoryTab === 'recipes' && (
                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
                  {/* Left Column: Foods List */}
                  <div className="card" style={{ padding: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px' }}>Thực Đơn Món Ăn</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {foods.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectMenuItemForRecipe(item)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left',
                            backgroundColor: selectedMenuItemForRecipe?.id === item.id ? 'var(--primary-light)' : 'transparent',
                            color: selectedMenuItemForRecipe?.id === item.id ? 'var(--primary)' : 'var(--text-primary)'
                          }}
                        >
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.foodName} style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '40px', height: '40px', borderRadius: '6px', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Utensils size={18} /></div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.foodName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mã: {item.code}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Recipe details */}
                  <div className="card" style={{ padding: '24px' }}>
                    {selectedMenuItemForRecipe ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                          {selectedMenuItemForRecipe.imageUrl ? (
                            <img src={selectedMenuItemForRecipe.imageUrl} alt={selectedMenuItemForRecipe.foodName} style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '60px', height: '60px', borderRadius: '10px', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Utensils size={24} /></div>
                          )}
                          <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Công thức: {selectedMenuItemForRecipe.foodName}</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Định lượng nguyên liệu tiêu hao cho 1 đơn vị món bán ra</p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                          {recipeItems.map((item, idx) => {
                            const matchedIng = ingredients.find(ing => ing.id === item.ingredientId);
                            return (
                              <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <div style={{ flex: 2 }}>
                                  <select
                                    value={item.ingredientId}
                                    onChange={(e) => {
                                      const updated = [...recipeItems];
                                      updated[idx].ingredientId = e.target.value;
                                      setRecipeItems(updated);
                                    }}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                                  >
                                    <option value="">-- Chọn nguyên liệu --</option>
                                    {ingredients.map(ing => (
                                      <option key={ing.id} value={ing.id}>{ing.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input
                                    type="number"
                                    step="0.001"
                                    placeholder="Số lượng"
                                    value={item.quantityNeeded}
                                    onChange={(e) => {
                                      const updated = [...recipeItems];
                                      updated[idx].quantityNeeded = e.target.value;
                                      setRecipeItems(updated);
                                    }}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                                  />
                                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', width: '40px' }}>{matchedIng?.unit || ''}</span>
                                </div>
                                <button
                                  onClick={() => setRecipeItems(recipeItems.filter((_, i) => i !== idx))}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            );
                          })}

                          {recipeItems.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                              Chưa có cấu hình nguyên liệu định lượng cho món ăn này.
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                          <button
                            onClick={() => setRecipeItems([...recipeItems, { ingredientId: '', quantityNeeded: '' }])}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: '1px dashed var(--primary)', backgroundColor: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: '700' }}
                          >
                            <Plus size={16} /> Thêm Nguyên Liệu
                          </button>
                          <button
                            onClick={handleSaveRecipe}
                            style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFF', cursor: 'pointer', fontWeight: '700' }}
                          >
                            Lưu Công Thức
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
                        <Archive size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <h3>Chọn món ăn ở danh mục bên trái</h3>
                        <p>Chọn món ăn để cấu hình công thức định lượng tiêu hao nguyên liệu khi chế biến.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: TRANSACTIONS HISTORY */}
              {inventoryTab === 'transactions' && (
                <div className="card" style={{ padding: '24px' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Thời gian</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Nguyên liệu</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Loại giao dịch</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Số lượng</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Đơn giá</th>
                          <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Ghi chú / Lý do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryTransactions.map(tx => {
                          const matchedIng = ingredients.find(ing => ing.id === tx.ingredientId);
                          const isImport = tx.transactionType === 'IMPORT';
                          const isSale = tx.transactionType === 'EXPORT_SALE';
                          return (
                            <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '14px 12px', fontSize: '13px' }}>
                                {new Date(tx.createdAt).toLocaleString('vi-VN')}
                              </td>
                              <td style={{ padding: '14px 12px', fontWeight: '600' }}>
                                {matchedIng?.name || 'Nguyên liệu cũ'}
                              </td>
                              <td style={{ padding: '14px 12px' }}>
                                <span style={{
                                  padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                                  backgroundColor: isImport ? 'rgba(16, 185, 129, 0.1)' : isSale ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  color: isImport ? '#10b981' : isSale ? '#6366f1' : '#ef4444'
                                }}>
                                  {isImport ? '📥 Nhập kho' : isSale ? '🛍️ Xuất bán hàng' : '🗑️ Xuất hủy'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 12px', fontWeight: '700' }}>
                                {isImport ? '+' : '-'}{parseFloat(tx.quantity).toFixed(2)} {matchedIng?.unit || ''}
                              </td>
                              <td style={{ padding: '14px 12px' }}>
                                {tx.price ? `${new Intl.NumberFormat('vi-VN').format(tx.price)}đ` : '-'}
                              </td>
                              <td style={{ padding: '14px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                {tx.reason || 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                        {inventoryTransactions.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chưa có lịch sử giao dịch kho hàng.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </div>
      </main>

      {/* QR Code Modal for Tables (Global) */}
      <QRCodeModal table={selectedTableForQR} onClose={() => setSelectedTableForQR(null)} />


      {/* Ingredient Modal overlay */}
      {showIngredientModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '30px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px' }}>
                {editingIngredient ? 'Cập Nhật Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}
              </h2>
              <button
                onClick={() => setShowIngredientModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>Tên nguyên liệu *</label>
                <input
                  type="text"
                  required
                  value={ingredientForm.name}
                  onChange={e => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                  className="form-input"
                  placeholder="Ví dụ: Thịt bò, Trứng, Sốt BBQ..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="input-group">
                <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>Đơn vị tính *</label>
                <input
                  type="text"
                  required
                  value={ingredientForm.unit}
                  onChange={e => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                  className="form-input"
                  placeholder="Ví dụ: kg, quả, lít, gram..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="input-group">
                <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>Ngưỡng tối thiểu cảnh báo *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={ingredientForm.minStock}
                  onChange={e => setIngredientForm({ ...ingredientForm, minStock: e.target.value })}
                  className="form-input"
                  placeholder="Cảnh báo khi tồn kho thấp hơn mức này"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowIngredientModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '700' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFF', cursor: 'pointer', fontWeight: '700' }}
                >
                  Lưu Lại
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Stock Transaction Modal overlay */}
      {showStockTransactionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '30px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px' }}>
                Giao Dịch Nhập / Xuất Kho
              </h2>
              <button
                onClick={() => setShowStockTransactionModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Type selector tab */}
            <div style={{ display: 'flex', gap: '10px', background: 'var(--bg-body)', padding: '4px', borderRadius: '8px', marginBottom: '10px' }}>
              {['IMPORT', 'EXPORT_WASTE'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setStockTxType(type)}
                  style={{
                    flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                    backgroundColor: stockTxType === type ? 'var(--bg-surface)' : 'transparent',
                    color: stockTxType === type ? 'var(--primary)' : 'var(--text-secondary)',
                    boxShadow: stockTxType === type ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  {type === 'IMPORT' ? '📥 Nhập kho' : '🗑️ Xuất hủy'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>Chọn nguyên vật liệu *</label>
                <select
                  required
                  value={stockTxForm.ingredientId}
                  onChange={e => setStockTxForm({ ...stockTxForm, ingredientId: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                >
                  <option value="">-- Chọn nguyên liệu --</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>Số lượng giao dịch *</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="Ví dụ: 10, 5.5..."
                  value={stockTxForm.quantity}
                  onChange={e => setStockTxForm({ ...stockTxForm, quantity: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                />
              </div>

              {stockTxType === 'IMPORT' && (
                <div className="input-group">
                  <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>Đơn giá nhập kho (VNĐ)</label>
                  <input
                    type="number"
                    placeholder="Ví dụ: 150000"
                    value={stockTxForm.price}
                    onChange={e => setStockTxForm({ ...stockTxForm, price: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                  />
                </div>
              )}

              <div className="input-group">
                <label className="form-label" style={{ fontWeight: '700', marginBottom: '6px', display: 'block', color: 'var(--text-primary)' }}>Lý do / Ghi chú *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nhập hàng sỉ định kỳ, Xuất hủy thịt hết hạn..."
                  value={stockTxForm.reason}
                  onChange={e => setStockTxForm({ ...stockTxForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-body)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowStockTransactionModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '700' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary)', color: '#FFF', cursor: 'pointer', fontWeight: '700' }}
                >
                  Xác Nhận
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Staff Modal overlay - Outside main card to avoid hover interference */}
      {isStaffModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              width: '100%',
              maxWidth: '650px',
              padding: '40px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#11117F', letterSpacing: '-0.5px' }}>
                {editingStaff ? 'Update Staff Member' : 'Register New Staff'}
              </h2>
              <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F0FF', borderRadius: '12px', color: '#11117F' }}>
                <Users size={24} />
              </div>
            </div>

            <form onSubmit={handleSaveStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="input-group">
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Username</label>
                  <input type="text" required value={staffFormData.username} onChange={e => setStaffFormData({ ...staffFormData, username: e.target.value })} className="form-input" disabled={!!editingStaff} style={{ opacity: editingStaff ? 0.7 : 1, borderColor: '#E0E0E0' }} />
                </div>
                <div className="input-group">
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Password</label>
                  <input type="password" required={!editingStaff} value={staffFormData.password} onChange={e => setStaffFormData({ ...staffFormData, password: e.target.value })} className="form-input" placeholder={editingStaff ? '••••••••' : 'Enter password'} style={{ borderColor: '#E0E0E0' }} />
                  {editingStaff && <small style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>Leave blank to keep current password</small>}
                </div>

                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Full Name</label>
                  <input type="text" required value={staffFormData.fullName} onChange={e => setStaffFormData({ ...staffFormData, fullName: e.target.value })} className="form-input" placeholder="e.g. John Doe" style={{ borderColor: '#E0E0E0' }} />
                </div>

                <div className="input-group">
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Email Address</label>
                  <input type="email" required value={staffFormData.email} onChange={e => setStaffFormData({ ...staffFormData, email: e.target.value })} className="form-input" placeholder="john@example.com" style={{ borderColor: '#E0E0E0' }} />
                </div>
                <div className="input-group">
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Phone Number</label>
                  <input type="text" required value={staffFormData.phoneNumber} onChange={e => setStaffFormData({ ...staffFormData, phoneNumber: e.target.value })} className="form-input" placeholder="090 123 4567" style={{ borderColor: '#E0E0E0' }} />
                </div>

                <div className="input-group">
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Birthday</label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#11117F', opacity: 0.5, pointerEvents: 'none' }} />
                    <input
                      type="date"
                      value={staffFormData.birthday}
                      onChange={e => setStaffFormData({ ...staffFormData, birthday: e.target.value })}
                      className="form-input"
                      style={{ paddingLeft: '44px', borderColor: '#E0E0E0' }}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Gender</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {['MALE', 'FEMALE', 'OTHER'].map(g => (
                      <label key={g} style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: staffFormData.gender === g ? '2px solid #11117F' : '1px solid #E0E0E0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        fontSize: '13px', color: staffFormData.gender === g ? '#11117F' : '#666', fontWeight: staffFormData.gender === g ? '700' : '500'
                      }}>
                        <input type="radio" name="gender" value={g} checked={staffFormData.gender === g} onChange={() => setStaffFormData({ ...staffFormData, gender: g })} style={{ display: 'none' }} />
                        {g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Other'}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Số CCCD (Citizen ID) *</label>
                  <input type="text" required value={staffFormData.citizenPid} onChange={e => setStaffFormData({ ...staffFormData, citizenPid: e.target.value })} className="form-input" placeholder="Nhập 12 số CCCD" style={{ borderColor: '#E0E0E0' }} />
                </div>

                <div className="input-group">
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Phân quyền (Role)</label>
                  <div style={{ position: 'relative' }}>
                    <select value={staffFormData.server} onChange={e => setStaffFormData({ ...staffFormData, server: e.target.value })} className="form-input" style={{ appearance: 'none', paddingRight: '40px', borderColor: '#E0E0E0' }}>
                      <option value="HCM">Ho Chi Minh (HCM)</option>
                      <option value="HN">Ha Noi (HN)</option>
                      <option value="DN">Da Nang (DN)</option>
                    </select>
                    <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#11117F', opacity: 0.5 }}>
                      <Filter size={16} />
                    </div>
                  </div>
                </div>

                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ color: '#11117F', fontWeight: '700' }}>Access Role</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    {['WAITER', 'KITCHEN', 'ADMIN'].map(role => (
                      <label key={role} style={{
                        flex: 1, padding: '14px', borderRadius: '12px', border: staffFormData.role === role ? '2px solid #11117F' : '1px solid #E0E0E0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        color: staffFormData.role === role ? '#11117F' : '#666',
                        fontWeight: staffFormData.role === role ? '800' : '500',
                        backgroundColor: 'white'
                      }}>
                        <input
                          type="radio" name="role" value={role}
                          checked={staffFormData.role === role}
                          onChange={() => setStaffFormData({ ...staffFormData, role })}
                          style={{ display: 'none' }}
                        />
                        {role === 'WAITER' ? 'WAITRESS/WAITER' : role === 'KITCHEN' ? 'KITCHEN' : 'ADMINISTRATOR'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginTop: '32px' }}>
                <button type="button" onClick={() => setIsStaffModalOpen(false)} className="btn" style={{ flex: 1, padding: '16px', borderRadius: '12px', border: '2px solid #11117F', color: '#11117F', fontWeight: '800', background: 'white', cursor: 'pointer' }}>Discard Changes</button>
                <button type="submit" className="btn" style={{ flex: 1, padding: '16px', borderRadius: '12px', border: 'none', background: '#11117F', color: 'white', fontWeight: '800', cursor: 'pointer' }}>
                  {editingStaff ? 'Update Information' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* CREATE ORDER MODAL (POS) */}
      {isCreateOrderModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#F8FAFC', borderRadius: '16px', width: '100%', maxWidth: '1100px', height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', backgroundColor: '#FFF', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0F172A', fontSize: '20px', fontWeight: '800' }}>TẠO ĐƠN HÀNG MỚI (POS)</h3>
              <button onClick={() => setIsCreateOrderModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={24} /></button>
            </div>

            {/* Split Content */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

              {/* LEFT COLUMN: Menus & Tables */}
              <div style={{ flex: 6, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', overflow: 'hidden' }}>
                <div style={{ padding: '20px', backgroundColor: '#FFF', borderBottom: '1px solid #E2E8F0' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '8px' }}>CHỌN BÀN (Chỉ hiển thị bàn trống)</label>
                  <select
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '15px', fontWeight: '600', color: '#0F172A' }}
                  >
                    <option value="">-- Bấm để chọn bàn --</option>
                    {tables.map(t => {
                      const isOccupied = String(t.status).toUpperCase() === 'OCCUPIED' || String(t.status) === '1';
                      return (
                        <option key={t.id} value={t.id}>
                          Bàn {t.tableNumber || t.id} {isOccupied ? '(Đang có khách - Gọi thêm)' : '(Trống)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '15px', color: '#475569' }}>DANH SÁCH MÓN ĂN</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                    {/* Chỉ hiện món đang ACTIVE (status === 1) — món đã tắt bán hoặc đang chờ duyệt sẽ không thể chọn để lên đơn */}
                    {foods.filter(food => food.status === 1).map(food => (
                      <div key={food.id} style={{ backgroundColor: '#FFF', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => openOrderOptionsModal(food)}>
                        <div style={{ height: '120px', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {food.imageUrl ? (
                            <img
                              src={food.imageUrl}
                              alt={food.foodName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div style={{
                            display: food.imageUrl ? 'none' : 'flex',
                            width: '100%', height: '100%',
                            background: `linear-gradient(135deg, hsl(${(food.foodName?.charCodeAt(0) || 200) % 360}, 60%, 55%), hsl(${(food.foodName?.charCodeAt(0) || 200) % 360 + 40}, 70%, 45%))`,
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: '28px', fontWeight: '800', color: 'white',
                            userSelect: 'none'
                          }}>
                            {food.foodName?.charAt(0)?.toUpperCase() || '🍽'}
                          </div>
                        </div>
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', lineHeight: 1.3 }}>{food.foodName}</span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#10B981' }}>{new Intl.NumberFormat('vi-VN').format(food.price)}đ</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Cart */}
              <div style={{ flex: 4, display: 'flex', flexDirection: 'column', backgroundColor: '#FFF' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F1F5F9' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#0F172A', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t.cart}</span>
                    <span style={{ backgroundColor: '#10B981', color: '#FFF', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{cartItems.reduce((acc, i) => acc + i.quantity, 0)} {t.qtyLabel}</span>
                  </h4>
                </div>

                <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                  {cartItems.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: '12px' }}>
                      <ClipboardList size={48} />
                      <p>{t.cartEmpty}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {cartItems.map(item => (
                        <div key={`${item.menuItemId}_${item.note || ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '16px', borderBottom: '1px dashed #E2E8F0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{item.foodName}</p>
                              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>{new Intl.NumberFormat('vi-VN').format(item.unitPrice)}đ / món</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                                <button onClick={() => handleUpdateCartItem(item.menuItemId, item.note, -1)} style={{ padding: '4px 8px', border: 'none', background: '#F1F5F9', cursor: 'pointer' }}>-</button>
                                <span style={{ padding: '0 12px', fontSize: '14px', fontWeight: '600' }}>{item.quantity}</span>
                                <button onClick={() => handleUpdateCartItem(item.menuItemId, item.note, 1)} style={{ padding: '4px 8px', border: 'none', background: '#F1F5F9', cursor: 'pointer' }}>+</button>
                              </div>
                              <button onClick={() => handleRemoveFromCart(item.menuItemId, item.note)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }}><X size={18} /></button>
                            </div>
                          </div>
                          {/* Note input for each item */}
                          <input
                            type="text"
                            placeholder="Ghi chú món (ví dụ: ít cay...)"
                            value={item.note || ''}
                            onChange={(e) => handleUpdateCartItem(item.menuItemId, item.note, 0, e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px', outline: 'none' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <textarea
                    placeholder="Ghi chú chung cho đơn hàng..."
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', marginBottom: '16px', resize: 'none', outline: 'none' }}
                    rows={2}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#475569' }}>TỔNG CỘNG:</span>
                    <span style={{ fontSize: '24px', fontWeight: '800', color: '#10B981' }}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cartItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0))}
                    </span>
                  </div>
                  <button
                    onClick={handleSubmitOrder}
                    disabled={cartItems.length === 0 || !selectedTableId}
                    style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', backgroundColor: (cartItems.length === 0 || !selectedTableId) ? '#94A3B8' : '#10B981', color: '#FFF', fontSize: '16px', fontWeight: '800', cursor: (cartItems.length === 0 || !selectedTableId) ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
                  >
                    {t.confirmOrder}
                  </button>
                </div>

              </div>
            </div>

          </motion.div>
        </div>
      )}

      {/* INVOICE MODAL */}
      {isInvoiceModalOpen && selectedInvoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: '#FFF', borderRadius: '16px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>

            {/* Header */}
            <div style={{ padding: '24px', backgroundColor: '#F8FAFC', borderBottom: '1px dashed #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0F172A', fontSize: '20px', fontWeight: '800' }}>{t.invoiceTitle}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--primary)', fontSize: '14px', fontWeight: '800', fontFamily: 'monospace' }}>ORD-{String(selectedInvoice.id).slice(0, 8).toUpperCase()}</p>
              </div>
              <button onClick={() => setIsInvoiceModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={24} /></button>
            </div>

            {/* Content (Scrollable) */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>{t.tablePosition}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#0F172A', fontWeight: '700' }}>{selectedInvoice.tableNumber || selectedInvoice.tableId}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700' }}>{t.time}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#0F172A', fontWeight: '600' }}>
                    {new Date(selectedInvoice.updatedAt || selectedInvoice.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #EEF2F6', borderBottom: '1px solid #EEF2F6', padding: '16px 0', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ color: '#64748B' }}>
                      <th style={{ textAlign: 'left', paddingBottom: '12px', fontWeight: '600' }}>{t.foodName}</th>
                      <th style={{ textAlign: 'center', paddingBottom: '12px', fontWeight: '600' }}>SL</th>
                      <th style={{ textAlign: 'right', paddingBottom: '12px', fontWeight: '600' }}>{t.amount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px 0', color: '#1E293B', fontWeight: '500' }}>{item.foodName}</td>
                        <td style={{ padding: '8px 0', textAlign: 'center', color: '#475569' }}>{item.quantity}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: '#1E293B', fontWeight: '600' }}>
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.unitPrice * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '14px' }}>
                  <span>{t.subtotal}</span>
                  <span>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedInvoice.totalPrice || selectedInvoice.totalAmount || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '14px' }}>
                  <span>{t.serviceFee}</span>
                  <span>đ 0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '16px', borderTop: '1px dashed #CBD5E1', fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                  <span>{t.total}</span>
                  <span style={{ color: 'var(--primary)' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedInvoice.totalPrice || selectedInvoice.totalAmount || 0)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '24px', backgroundColor: '#F8FAFC', display: 'flex', gap: '12px' }}>
              <button
                onClick={handleDownloadInvoicePDF}
                className="btn btn-outline" style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Download size={18} /> {t.downloadPdfBtn}
              </button>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="btn btn-primary" style={{ flex: 1, padding: '12px' }}>
                Đóng Hóa Đơn
              </button>
            </div>

          </motion.div>
        </div>
      )}

      {/* CHECKOUT MODAL (PAYMENT) */}
      {isCheckoutModalOpen && checkoutOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: '#FFF', borderRadius: '16px', width: '100%', maxWidth: '600px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0F172A', fontSize: '20px', fontWeight: '800' }}>{t.checkoutTitle}</h3>
              <button onClick={() => setIsCheckoutModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={24} /></button>
            </div>

            {/* Content */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Order Summary Summary */}
              <div style={{ backgroundColor: '#F1F5F9', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Đơn hàng: #{String(checkoutOrder.id).slice(0, 8).toUpperCase()}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#0F172A', fontWeight: '700' }}>{checkoutOrder.tableNumber || checkoutOrder.tableId}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: '600' }}>{t.totalPayment}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '24px', color: '#10B981', fontWeight: '800' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(checkoutOrder.totalAmount || checkoutOrder.totalPrice || 0)}
                  </p>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', marginBottom: '12px', display: 'block' }}>{t.paymentMethodLabel}</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setPaymentMethod('CASH')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: paymentMethod === 'CASH' ? '2px solid #3B82F6' : '1px solid #CBD5E1', backgroundColor: paymentMethod === 'CASH' ? '#EFF6FF' : '#FFF', color: paymentMethod === 'CASH' ? '#1D4ED8' : '#475569', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {t.cashBtn}
                  </button>
                  <button onClick={() => { setPaymentMethod('TRANSFER'); setIsQRModalOpen(true); }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: paymentMethod === 'TRANSFER' ? '2px solid #3B82F6' : '1px solid #CBD5E1', backgroundColor: paymentMethod === 'TRANSFER' ? '#EFF6FF' : '#FFF', color: paymentMethod === 'TRANSFER' ? '#1D4ED8' : '#475569', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {t.transferBtn}
                  </button>
                </div>
              </div>

              {/* Dynamic Payment Body */}
              <div style={{ minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {paymentMethod === 'CASH' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>{t.cashInputLabel}</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder=""
                          value={customerCash}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            // Store the raw input (thousands), but we can display the formatted full amount
                            setCustomerCash(val);
                          }}
                          style={{ width: '100%', padding: '16px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '24px', fontWeight: '800', outline: 'none', color: '#11117F' }}
                        />
                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', fontWeight: '700', color: '#94A3B8' }}>
                          .000 đ
                        </div>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                        {t.cashHint}
                      </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#F8FAFC', border: '1px dashed #94A3B8', borderRadius: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '600', color: '#475569' }}>{t.changeLabel}</span>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#EF4444' }}>
                        {(() => {
                          const total = Number(checkoutOrder.totalAmount || checkoutOrder.totalPrice || 0);
                          const cash = Number(customerCash.replace(/\D/g, '') || 0) * 1000;
                          if (cash < total || !cash) return '0 đ';
                          return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cash - total);
                        })()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F9FF', padding: '32px', borderRadius: '12px', border: '1px solid #BAE6FD' }}>
                    <div style={{ padding: '16px', backgroundColor: '#3B82F6', borderRadius: '50%', color: '#FFF', marginBottom: '16px' }}>
                      <QrCode size={32} />
                    </div>
                    <p style={{ margin: 0, fontSize: '16px', color: '#0369A1', fontWeight: '700' }}>Phương thức: Chuyển khoản</p>
                    <button
                      onClick={() => setIsQRModalOpen(true)}
                      style={{ marginTop: '12px', padding: '8px 16px', background: '#3B82F6', color: '#FFF', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {t.viewQR}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '20px 24px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
              <button onClick={() => setIsCheckoutModalOpen(false)} className="btn btn-outline" style={{ flex: 1, padding: '14px' }}>
                {t.cancelBtn}
              </button>
              <button
                onClick={handleConfirmPayment}
                className="btn btn-primary"
                style={{ flex: 2, padding: '14px', backgroundColor: '#3B82F6', borderColor: '#3B82F6', fontSize: '16px' }}
              >
                XÁC NHẬN ĐÃ THU TIỀN
              </button>
            </div>

          </motion.div>
        </div>
      )}

      {/* QR CODE POPUP MODAL */}
      {isQRModalOpen && checkoutOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ background: '#FFF', borderRadius: '24px', width: '100%', maxWidth: '420px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>

            {/* Header with Bank Color */}
            <div style={{ padding: '20px', background: '#E01020', color: '#FFF', textAlign: 'center', position: 'relative' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>TECHCOMBANK</h3>
              <button onClick={() => setIsQRModalOpen(false)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFF' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>{t.accountName}</p>
                <p style={{ margin: '4px 0 0', fontSize: '20px', color: '#0F172A', fontWeight: '800' }}>NGUYEN LAN VIET</p>
                <p style={{ margin: '8px 0 0', fontSize: '18px', color: '#11117F', fontWeight: '700', letterSpacing: '1px' }}>1903 7974 1810 12</p>
              </div>

              {/* QR Image */}
              <div style={{ padding: '16px', backgroundColor: '#FFF', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #F1F5F9' }}>
                <img
                  src={`https://img.vietqr.io/image/970407-19037974181012-print.jpg?amount=${checkoutOrder.totalAmount || checkoutOrder.totalPrice || 0}&addInfo=Thanh toan don ${String(checkoutOrder.id).slice(0, 8)}&accountName=NGUYEN LAN VIET`}
                  alt="QR Code"
                  style={{ width: '280px', height: '280px', objectFit: 'contain' }}
                />
              </div>

              <div style={{ textAlign: 'center', backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '12px', width: '100%' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: '600' }}>SỐ TIỀN CẦN CHUYỂN</p>
                <p style={{ margin: '4px 0 0', fontSize: '26px', color: '#10B981', fontWeight: '900' }}>
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(checkoutOrder.totalAmount || checkoutOrder.totalPrice || 0)}
                </p>
              </div>

              <button
                onClick={() => setIsQRModalOpen(false)}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: '#0F172A', color: '#FFF', border: 'none', fontSize: '16px', fontWeight: '700', cursor: 'pointer', transition: 'opacity 0.2s' }}
                onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                onMouseLeave={(e) => e.target.style.opacity = '1'}
              >
                ĐÃ QUÉT XONG
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* GLOBAL MODAL: PROPOSE FOOD (có thể mở từ bất kỳ tab nào) */}
      {isProposeFoodModalOpen && (
        <div onClick={() => setIsProposeFoodModalOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>💡 Đề xuất món ăn mới</h3>
              <button onClick={() => setIsProposeFoodModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleProposeFood}>
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Mã món (Code) *</label>
                  <input type="text" className="input-field" required value={proposeFoodFormData.code} onChange={e => setProposeFoodFormData({ ...proposeFoodFormData, code: e.target.value })} placeholder="VD: SUON-XAO" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Tên món ăn *</label>
                  <input type="text" className="input-field" required value={proposeFoodFormData.foodName} onChange={e => setProposeFoodFormData({ ...proposeFoodFormData, foodName: e.target.value })} placeholder="VD: Sườn xào chua ngọt" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Giá bán dự kiến (VNĐ) *</label>
                  <input type="number" className="input-field" required value={proposeFoodFormData.price} onChange={e => setProposeFoodFormData({ ...proposeFoodFormData, price: e.target.value })} placeholder="VD: 85000" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Danh mục *</label>
                  <select className="input-field" value={proposeFoodFormData.categoryId} onChange={e => setProposeFoodFormData({ ...proposeFoodFormData, categoryId: e.target.value })} required style={{ width: '100%' }}>
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Công thức chế biến *</label>
                  <textarea className="input-field" required value={proposeFoodFormData.recipe} onChange={e => setProposeFoodFormData({ ...proposeFoodFormData, recipe: e.target.value })} placeholder="Chi tiết nguyên liệu, định lượng, cách làm..." style={{ width: '100%', minHeight: '110px', resize: 'vertical' }}></textarea>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>Hình ảnh (Tùy chọn)</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="input-field"
                      value={proposeFoodFormData.imageUrl}
                      onChange={e => setProposeFoodFormData({ ...proposeFoodFormData, imageUrl: e.target.value })}
                      placeholder="Nhập URL hoặc tải ảnh lên..."
                      style={{ flex: 1, margin: 0 }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', padding: '0 16px', height: '42px', margin: 0 }}
                      onClick={() => document.getElementById('propose-food-image-file').click()}
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                      {isUploadingImage ? 'Đang tải...' : 'Tải lên'}
                    </button>
                    <input
                      id="propose-food-image-file"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleProposeFoodImageUpload}
                    />
                  </div>
                  {proposeFoodFormData.imageUrl && (
                    <div style={{ marginTop: '10px', borderRadius: '10px', overflow: 'hidden', height: '100px', background: '#f1f5f9', position: 'relative' }}>
                      <img
                        src={proposeFoodFormData.imageUrl}
                        alt="preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onLoad={e => { e.target.style.display = 'block'; e.target.nextSibling.style.display = 'none'; }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        height: '100%', gap: '6px', color: '#ef4444', fontSize: '12px'
                      }}>
                        <span style={{ fontSize: '20px' }}>⚠️</span>
                        <span style={{ fontWeight: '600' }}>Không thể hiển thị ảnh</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsProposeFoodModalOpen(false)} className="btn btn-outline">Hủy</button>
                <button type="submit" className="btn btn-primary">📨 Gửi Đề Xuất</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Options Popup */}
      {selectedFoodForOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ backgroundColor: '#FFF', borderRadius: '16px', width: '400px', overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>{selectedFoodForOrder.foodName}</h3>
              <button type="button" onClick={() => setSelectedFoodForOrder(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#475569' }}>Giá:</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#10B981' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedFoodForOrder.price)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: '#475569' }}>Số lượng:</span>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))} style={{ width: '40px', height: '40px', border: 'none', background: '#F1F5F9', cursor: 'pointer', fontSize: '18px', fontWeight: '600' }}>-</button>
                  <span style={{ width: '50px', textAlign: 'center', fontSize: '16px', fontWeight: '700' }}>{orderQuantity}</span>
                  <button type="button" onClick={() => setOrderQuantity(orderQuantity + 1)} style={{ width: '40px', height: '40px', border: 'none', background: '#F1F5F9', cursor: 'pointer', fontSize: '18px', fontWeight: '600' }}>+</button>
                </div>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <span style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>Tuỳ chọn thêm:</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {Object.keys(orderOptions).map(opt => (
                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={orderOptions[opt]} 
                        onChange={e => setOrderOptions({...orderOptions, [opt]: e.target.checked})} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                      /> {opt}
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <span style={{ display: 'block', fontSize: '16px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>Ghi chú tự do:</span>
                <textarea 
                  value={orderManualNote}
                  onChange={e => setOrderManualNote(e.target.value)}
                  placeholder="Ví dụ: ít đá, không hành..."
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', outline: 'none', resize: 'none' }}
                  rows={3}
                />
              </div>
            </div>
            
            <div style={{ padding: '16px 28px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setSelectedFoodForOrder(null)} className="btn btn-outline" style={{ flex: 1, padding: '12px' }}>Hủy</button>
              <button type="button" onClick={confirmAddToCart} className="btn btn-primary" style={{ flex: 1, padding: '12px' }}>Thêm vào đơn</button>
            </div>
          </motion.div>
        </div>
      )}

        {/* Delete Ingredient Modal */}
        {showDeleteIngredientModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              style={{ width: '400px', backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ef4444' }}>Xác nhận xóa nguyên liệu</h3>
              <p style={{ color: 'var(--text-secondary)' }}>Bạn có chắc chắn muốn xóa nguyên liệu này? Mọi tồn kho hiện tại sẽ được đánh dấu là Xuất bỏ.</p>
              
              <div className="input-group">
                <label className="form-label" style={{ fontWeight: '600' }}>Lý do xóa (không bắt buộc)</label>
                <textarea 
                  className="form-input" 
                  value={deleteIngredientState.reason}
                  onChange={(e) => setDeleteIngredientState({...deleteIngredientState, reason: e.target.value})}
                  placeholder="Ví dụ: Nhập sai tên, Hư hỏng..."
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowDeleteIngredientModal(false)} className="btn btn-outline" style={{ padding: '8px 16px' }}>Hủy</button>
                <button type="button" onClick={confirmDeleteIngredient} className="btn" style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Xóa Nguyên Liệu</button>
              </div>
            </motion.div>
          </div>
        )}

    </div>
  );
};

// ---------------------------------------------------------
// Main App Component
// ---------------------------------------------------------
const App = () => {
  const [currentUser, setCurrentUser] = useState(null);

  // Auto-login if valid token in storage
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      const payload = parseJwt(token);
      if (payload) {
        // Kiểm tra hết hạn (nếu token có exp)
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          return;
        }

        setCurrentUser({
          id: payload.sub || payload.uid,
          username: payload.sub || payload.uid,
          role: payload.role || 'GUEST',
          server: 'local',
          fullName: payload.fullName || payload.sub,
          tokenExp: payload.exp,
          tokenIat: payload.iat,
        });
      }
    }
  }, []);


  return (
    <AnimatePresence mode="wait">
      {currentUser ? (
        <DashboardScreen key="dashboard" user={currentUser} onLogout={() => setCurrentUser(null)} />
      ) : (
        <LoginScreen key="login" onLoginSuccess={(user) => setCurrentUser(user)} />
      )}
    </AnimatePresence>
  );
};

const QRCodeModal = ({ table, onClose }) => {
  const [hostIp, setHostIp] = useState(() => {
    return window.location.hostname === 'localhost' ? '192.168.1.4:5173' : window.location.host;
  });

  if (!table) return null;
  const qrUrl = `http://${hostIp}/customer?tableId=${table.id || table.ID}&tableName=${table.tableNumber}`;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div className="modal-header">
          <h3>Mã QR Đặt Món - Bàn {table.tableNumber}</h3>
          <button className="btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ padding: '20px' }}>
          {window.location.hostname === 'localhost' && (
            <details style={{ marginBottom: '20px', textAlign: 'left', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
              <summary style={{ fontSize: '13px', color: '#64748B', fontWeight: '600', userSelect: 'none' }}>⚙️ Cài đặt IP mạng LAN (Nâng cao)</summary>
              <div style={{ marginTop: '12px', cursor: 'default' }}>
                <input 
                  type="text" 
                  value={hostIp} 
                  onChange={(e) => setHostIp(e.target.value)} 
                  className="input-field" 
                  style={{ width: '100%', padding: '8px', fontSize: '14px', fontFamily: 'monospace' }} 
                />
                <p style={{ fontSize: '12px', color: '#EF4444', margin: '8px 0 0 0', fontWeight: '500' }}>
                  *Chỉ thay đổi nếu điện thoại khách hàng báo lỗi kết nối. Hãy điền IP LAN thực tế của máy tính này.
                </p>
              </div>
            </details>
          )}
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>Khách hàng quét mã QR này bằng điện thoại để tự xem Menu và đặt món.</p>
          <div style={{ backgroundColor: 'white', padding: '16px', display: 'inline-block', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <QRCodeCanvas 
              value={qrUrl} 
              size={250} 
              level={"H"}
              includeMargin={false}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1 }}
              onClick={() => window.open(qrUrl, '_blank')}
            >
              Mở Trang khách
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
