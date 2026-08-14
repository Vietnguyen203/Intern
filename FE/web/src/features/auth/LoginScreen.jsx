import { useState } from 'react';
import { motion } from 'framer-motion';
import { Utensils, AlertCircle, CheckCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import { parseJwt } from '../../shared/utils/jwt';

// ---------------------------------------------------------
// Login Screen
// ---------------------------------------------------------
export const LoginScreen = ({ onLoginSuccess }) => {
  const [empId, setEmpId] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [server, setServer] = useState('server-1'); // Default to server-1

  // Forgot Password State
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  // Cần cả Employee ID (username) lẫn email — email không unique trong hệ thống nên chỉ nhập email
  // không đủ để xác định đúng 1 tài khoản (xem UserService.forgotPassword bên BE).
  const [forgotUsername, setForgotUsername] = useState('');
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
    setForgotUsername('');
    setForgotEmail('');
    setError('');
    setSuccessMessage('');
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiService.auth.forgotPassword(forgotUsername, forgotEmail);
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
      await apiService.auth.resetPassword(forgotUsername, forgotEmail, otp, newPassword);
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
                ? (forgotStep === 1 ? 'Enter your Employee ID and email to receive an OTP.' : 'Check your email for the 6-digit OTP code.')
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
                <label className="form-label">Employee ID</label>
                <input type="text" className="form-input" placeholder="Your Employee ID" value={forgotUsername} onChange={e => setForgotUsername(e.target.value)} required />
              </div>
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
                <input type="password" className="form-input" placeholder="Min 6 chars, incl. 1 uppercase, 1 number, 1 symbol" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
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
