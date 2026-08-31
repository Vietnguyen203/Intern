import React, { useState, useEffect, useRef } from 'react';
import { apiService } from './services/api';
import { ShoppingCart, Plus, Minus, X, CheckCircle, Search, ArrowLeft, User, Award, Gift, LogOut, History } from 'lucide-react';

// Mã hạng -> nhãn hiển thị/màu, dùng khi loyalty-service chưa trả đủ field "color" (an toàn cho UI).
const TIER_FALLBACK = {
  BRONZE: { label: 'Thành viên Đồng', color: '#B08D57' },
  SILVER: { label: 'Thành viên Bạc', color: '#94A3B8' },
  GOLD: { label: 'Thành viên Vàng', color: '#F59E0B' },
  DIAMOND: { label: 'Thành viên Kim Cương', color: '#22D3EE' },
};

const CustomerOrderApp = () => {
  // Đọc thẳng từ URL ngay lúc khởi tạo state (không đợi useEffect) — tránh 1 nhịp render "chưa có
  // bàn" bị chớp qua trước khi effect bên dưới kịp set lại, dù link có tableId hợp lệ.
  const [tableId, setTableId] = useState(() => new URLSearchParams(window.location.search).get('tableId') || '');
  const [tableName, setTableName] = useState(() => new URLSearchParams(window.location.search).get('tableName') || '');
  // Token do table-service cấp gắn với đúng bàn này (nhúng trong QR dưới dạng "tk", hoặc trả về kèm
  // lúc "đặt bàn ngay") — order-service dùng để xác thực POST /orders/public thực sự đến từ đúng bàn.
  const [tableToken, setTableToken] = useState(() => new URLSearchParams(window.location.search).get('tk') || '');
  
  const [categories, setCategories] = useState([]);
  const [foods, setFoods] = useState([]);
  const [cart, setCart] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeCategory, setActiveCategory] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null); // null, 'success', 'error'

  // NEW FEATURES: Search & Order Options
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFoodForOrder, setSelectedFoodForOrder] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderOptions, setOrderOptions] = useState({
    'Ít đá': false,
    'Ít ngọt': false,
    'Không cay': false,
    'Nhiều cay': false,
    'Không hành': false
  });
  const [orderManualNote, setOrderManualNote] = useState('');

  // ===== TÀI KHOẢN KHÁCH HÀNG (tích điểm / hạng thành viên) =====
  const [customer, setCustomer] = useState(null); // null = chưa đăng nhập (vẫn order được bình thường)
  // entryResolved = false -> hiện màn "cổng vào" toàn màn hình (Đăng nhập/Đăng ký/Khách/Bỏ qua),
  // CHƯA render thực đơn phía sau. true -> đã chọn xong (đăng nhập/khách/bỏ qua), cho vào xem menu.
  const [entryResolved, setEntryResolved] = useState(false);
  // Màn chào ngắn (~1.8s) hiện đúng 1 lần ngay sau khi qua cổng vào, trước khi vào menu thật.
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeShownRef = useRef(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'guest'
  const [authForm, setAuthForm] = useState({ phone: '', password: '', fullName: '', email: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  // Đăng ký giờ là 2 bước (xác nhận OTP qua email) — false: đang điền form, true: đang chờ nhập OTP.
  const [registerOtpStep, setRegisterOtpStep] = useState(false);
  const [registerOtp, setRegisterOtp] = useState('');

  // "Khách" (tài khoản tạm thời): chỉ cần tên + SĐT, không tích điểm/lên hạng, không gọi
  // loyalty-service — chỉ lưu ở localStorage máy khách kèm mốc hết hạn 24h, tự hết tác dụng sau đó
  // (không cần job dọn dẹp phía server vì không có gì được tạo ở server cả).
  const GUEST_STORAGE_KEY = 'customerGuestProfile';
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestPhoneInput, setGuestPhoneInput] = useState('');

  // ===== ĐẶT BÀN TRƯỚC (chỉ dùng khi vào từ nút "Khách" mà không có tableId trên URL) =====
  // resStep: 'intro' (2 lựa chọn) -> 'now' (chọn bàn trống ngay) | 'later' (đặt theo ngày/giờ thật) -> 'success' (chỉ cho 'later')
  const [resStep, setResStep] = useState('intro');
  const [resPartySize, setResPartySize] = useState('2');
  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('');
  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resAvailable, setResAvailable] = useState(null); // null = chưa tìm, [] = tìm rồi nhưng hết bàn
  const [resSelectedTableId, setResSelectedTableId] = useState('');
  const [resLoading, setResLoading] = useState(false);
  const [resError, setResError] = useState('');
  const [resConfirmed, setResConfirmed] = useState(null);

  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    // Read table info from URL
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('tableId');
    const tname = params.get('tableName');
    const ttoken = params.get('tk');

    if (tid) setTableId(tid);
    if (tname) setTableName(tname);
    if (ttoken) setTableToken(ttoken);

    // Đến từ nút "Guest" ở màn chọn chung (App.jsx) -> mở thẳng modal ở tab Khách, không bắt phải
    // tự bấm nút "Đăng nhập" trên header trước.
    if (params.get('entry') === 'guest') {
      setAuthMode('guest');
      setShowAuthModal(true);
    }

    fetchMenu();

    // Khôi phục phiên đăng nhập của khách nếu trình duyệt còn lưu token (localStorage riêng
    // với token nhân viên — xem services/api.js). Token hết hạn/không hợp lệ thì âm thầm bỏ qua,
    // không chặn khách xem menu.
    let hasSavedIdentity = false;
    if (localStorage.getItem('customerToken')) {
      hasSavedIdentity = true;
      apiService.loyalty.me()
        .then(res => setCustomer(res.data || res))
        .catch(() => localStorage.removeItem('customerToken'));
    }

    // Khôi phục tên+SĐT "khách tạm" nếu còn hạn (< 24h kể từ lúc tạo) — hết hạn thì âm thầm xoá.
    try {
      const rawGuest = localStorage.getItem(GUEST_STORAGE_KEY);
      if (rawGuest) {
        const parsedGuest = JSON.parse(rawGuest);
        if (parsedGuest?.name && parsedGuest?.expiresAt && Date.now() < parsedGuest.expiresAt) {
          setGuestName(parsedGuest.name);
          setGuestPhone(parsedGuest.phone || '');
          hasSavedIdentity = true;
        } else {
          localStorage.removeItem(GUEST_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    }

    // Đã có tài khoản/khách tạm còn hạn từ trước, hoặc trước đó đã chủ động bấm "Tiếp tục không cần
    // tài khoản" trong cùng phiên trình duyệt này -> khỏi bắt qua lại màn cổng vào mỗi lần load trang.
    let skippedBefore = false;
    try { skippedBefore = sessionStorage.getItem('customerEntrySkipped') === '1'; } catch {}
    if (hasSavedIdentity || skippedBefore) setEntryResolved(true);
  }, []);

  // Hiện màn chào ngay khi vừa qua cổng vào — chỉ 1 lần cho tới khi rời trang (đổi tài khoản/đăng
  // xuất giữa chừng không hiện lại, tránh làm phiền khách đang thao tác dở).
  useEffect(() => {
    if (entryResolved && !welcomeShownRef.current) {
      welcomeShownRef.current = true;
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [entryResolved]);

  const getWelcomeGreeting = () => {
    const place = tableName ? `tại Bàn ${tableName}` : '';
    if (customer) return { title: `Chào mừng, ${customer.fullName || customer.phone}! 👋`, subtitle: `Chúc bạn ngon miệng ${place}`.trim() };
    if (guestName) return { title: `Chào ${guestName}! 👋`, subtitle: `Chúc bạn ngon miệng ${place}`.trim() };
    return { title: 'Chào mừng quý khách! 👋', subtitle: `Chúc bạn ngon miệng ${place}`.trim() };
  };

  const handleGuestContinue = () => {
    const name = guestNameInput.trim();
    const phone = guestPhoneInput.trim();
    if (!name || !phone) {
      setAuthError('Vui lòng nhập đủ tên và số điện thoại.');
      return;
    }
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ name, phone, expiresAt }));
    setGuestName(name);
    setGuestPhone(phone);
    setGuestNameInput('');
    setGuestPhoneInput('');
    setAuthError('');
    setShowAuthModal(false);
    setEntryResolved(true);
  };

  const handleClearGuest = () => {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    setGuestName('');
    setGuestPhone('');
  };

  // Định dạng "2026-08-22T19:30:00" theo GIỜ ĐỊA PHƯƠNG (không dùng toISOString() vì nó quy về UTC) —
  // khớp với LocalDateTime mà backend table-service mong đợi (@DateTimeFormat ISO.DATE_TIME).
  const toLocalIso = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const getReservationTargetIso = () => (
    resStep === 'now' ? toLocalIso(new Date()) : `${resDate}T${resTime}:00`
  );

  const handleResBack = () => {
    setResStep('intro');
    setResAvailable(null);
    setResSelectedTableId('');
    setResError('');
  };

  const handleFindAvailableTables = async () => {
    setResError('');
    const partySize = parseInt(resPartySize, 10);
    if (!partySize || partySize <= 0) { setResError('Vui lòng nhập số lượng khách hợp lệ.'); return; }
    if (!resName.trim() || !resPhone.trim()) { setResError('Vui lòng nhập đủ tên và số điện thoại.'); return; }
    if (resStep === 'later' && (!resDate || !resTime)) { setResError('Vui lòng chọn ngày và giờ muốn đặt bàn.'); return; }

    setResLoading(true);
    try {
      const reservedAtIso = getReservationTargetIso();
      const res = await apiService.dashboard.getAvailableTablesForReservation(reservedAtIso, partySize);
      setResAvailable(res.data || res || []);
      setResSelectedTableId('');
    } catch (err) {
      setResError('Không tải được danh sách bàn trống: ' + err.message);
    } finally {
      setResLoading(false);
    }
  };

  const handleConfirmReservation = async () => {
    if (!resSelectedTableId) { setResError('Vui lòng chọn 1 bàn.'); return; }
    setResError('');
    setResLoading(true);
    try {
      const partySize = parseInt(resPartySize, 10);
      const reservedAtIso = getReservationTargetIso();
      const name = resName.trim();
      const phone = resPhone.trim();
      const payload = {
        tableId: resSelectedTableId,
        customerName: name,
        customerPhone: phone,
        partySize,
        reservedAt: reservedAtIso,
      };
      const res = await apiService.dashboard.createReservation(payload);
      const reservation = res.data || res;

      if (resStep === 'now') {
        // Đặt bàn trống NGAY -> vào thẳng thực đơn, không cần qua bước "Khách" riêng nữa.
        const chosenTable = (resAvailable || []).find(t => t.id === resSelectedTableId);
        setTableId(resSelectedTableId);
        setTableName(chosenTable ? String(chosenTable.tableNumber) : String(reservation?.tableNumber || ''));
        // table-service cấp kèm token cho đúng bàn này ngay trong response đặt bàn — dùng luôn, khỏi
        // cần khách quét QR mới có được token (giống hệt cơ chế mã QR in sẵn).
        if (reservation?.qrToken) setTableToken(reservation.qrToken);
        setGuestName(name);
        setGuestPhone(phone);
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ name, phone, expiresAt }));
        setEntryResolved(true);
      } else {
        // Đặt trước theo ngày/giờ thật -> chỉ hiện màn xác nhận, KHÔNG cho vào thực đơn (khách chưa
        // có mặt tại quán để order).
        setResConfirmed(reservation);
        setResStep('success');
      }
    } catch (err) {
      setResError('Đặt bàn thất bại: ' + err.message);
    } finally {
      setResLoading(false);
    }
  };

  // "Tiếp tục không cần tài khoản" ở màn cổng vào — cho xem/đặt món ẩn danh như trước giờ, chỉ nhớ
  // lựa chọn này trong phiên trình duyệt hiện tại để không hỏi lại mỗi lần load lại trang.
  const handleSkipEntry = () => {
    try { sessionStorage.setItem('customerEntrySkipped', '1'); } catch {}
    setEntryResolved(true);
    setShowAuthModal(false);
    setAuthError('');
  };

  // Đăng nhập: 1 bước như cũ. Đăng ký: bước 1 — validate + gửi OTP, CHƯA có token/tài khoản, phải
  // qua handleRegisterVerifyOtp bên dưới mới thực sự tạo tài khoản (xem CustomerService.register).
  const handleAuthSubmit = async () => {
    setAuthError('');
    if (!authForm.phone.trim() || !authForm.password.trim()) {
      setAuthError('Vui lòng nhập đủ số điện thoại và mật khẩu.');
      return;
    }
    if (authMode === 'register' && (!authForm.fullName.trim() || !authForm.email.trim())) {
      setAuthError('Vui lòng nhập đủ họ tên và email (để nhận mã OTP).');
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const res = await apiService.loyalty.register({
          phone: authForm.phone.trim(),
          password: authForm.password,
          fullName: authForm.fullName.trim(),
          email: authForm.email.trim(),
        });
        const data = res.data || res;
        if (data.status !== 'REQUIRE_OTP') throw new Error('Không nhận được phản hồi hợp lệ từ server.');
        setRegisterOtpStep(true);
      } else {
        const res = await apiService.loyalty.login({ phone: authForm.phone.trim(), password: authForm.password });
        const data = res.data || res;
        if (data.token) localStorage.setItem('customerToken', data.token);
        setCustomer(data.customer || data);
        setShowAuthModal(false);
        setAuthForm({ phone: '', password: '', fullName: '', email: '' });
        setEntryResolved(true);
      }
    } catch (err) {
      setAuthError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterVerifyOtp = async () => {
    setAuthError('');
    if (!registerOtp.trim()) {
      setAuthError('Vui lòng nhập mã OTP.');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await apiService.loyalty.registerVerifyOtp(authForm.phone.trim(), registerOtp.trim());
      const data = res.data || res;
      if (!data.token) throw new Error('Xác nhận OTP thất bại.');
      localStorage.setItem('customerToken', data.token);
      setCustomer(data.customer || data);
      setShowAuthModal(false);
      setAuthForm({ phone: '', password: '', fullName: '', email: '' });
      setRegisterOtpStep(false);
      setRegisterOtp('');
      setEntryResolved(true);
    } catch (err) {
      setAuthError(err.message || 'Xác nhận OTP thất bại.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customerToken');
    setCustomer(null);
    setShowAccountPanel(false);
  };

  const openAccountPanel = async () => {
    setShowAccountPanel(true);
    setAccountLoading(true);
    try {
      const [meRes, historyRes, rewardsRes, tiersRes] = await Promise.allSettled([
        apiService.loyalty.me(),
        apiService.loyalty.pointsHistory(),
        apiService.loyalty.getRewards(),
        apiService.loyalty.getTiers(),
      ]);
      if (meRes.status === 'fulfilled') setCustomer(meRes.value.data || meRes.value);
      setPointsHistory(historyRes.status === 'fulfilled' ? (historyRes.value.data || historyRes.value || []) : []);
      setRewards(rewardsRes.status === 'fulfilled' ? (rewardsRes.value.data || rewardsRes.value || []) : []);
      setTiers(tiersRes.status === 'fulfilled' ? (tiersRes.value.data || tiersRes.value || []) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleRedeemReward = async (rewardId) => {
    try {
      await apiService.loyalty.redeemReward(rewardId);
      alert('Đổi thưởng thành công! Mã voucher đã được thêm vào tài khoản của bạn.');
      openAccountPanel(); // tải lại điểm + lịch sử mới nhất
    } catch (err) {
      alert('Không đổi được thưởng: ' + err.message);
    }
  };

  // Nội dung 3 tab Đăng nhập / Đăng ký / Khách — dùng chung cho cả màn cổng vào toàn màn hình (chưa
  // xác định danh tính) lẫn bottom-sheet đổi tài khoản (khi đã vào menu rồi, bấm nút góc trên).
  const renderAuthTabs = () => (
    <>
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '12px', marginBottom: '18px' }}>
        {[
          { key: 'login', label: 'Đăng nhập' },
          { key: 'register', label: 'Đăng ký' },
          { key: 'guest', label: 'Khách' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setAuthMode(tab.key); setAuthError(''); setRegisterOtpStep(false); }}
            style={{
              flex: 1, padding: '10px 8px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700',
              backgroundColor: authMode === tab.key ? '#11117F' : 'transparent',
              color: authMode === tab.key ? '#FFF' : '#64748B',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {authMode !== 'guest' ? (
        authMode === 'register' && registerOtpStep ? (
          // --- ĐĂNG KÝ BƯỚC 2: xác nhận OTP đã gửi về email ---
          <>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
              Mã OTP xác nhận đăng ký đã được gửi về email <strong>{authForm.email}</strong>. Nhập mã để hoàn tất tạo tài khoản.
            </p>
            <input
              type="text" placeholder="______" maxLength={6}
              value={registerOtp}
              onChange={e => setRegisterOtp(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: '800', boxSizing: 'border-box' }}
            />

            {authError && <p style={{ color: '#EF4444', fontSize: '13px', marginTop: '12px' }}>{authError}</p>}

            <button
              onClick={handleRegisterVerifyOtp}
              disabled={authLoading}
              style={{ width: '100%', marginTop: '20px', padding: '16px', backgroundColor: '#11117F', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700' }}
            >
              {authLoading ? 'Đang xác nhận...' : 'Xác nhận OTP'}
            </button>
            <button
              onClick={() => { setRegisterOtpStep(false); setAuthError(''); }}
              style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'none', border: 'none', color: '#64748B', fontSize: '14px', cursor: 'pointer' }}
            >
              ← Quay lại
            </button>
          </>
        ) : (
        <>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
            {authMode === 'register'
              ? 'Đăng ký để tích điểm và lên hạng thành viên mỗi lần thanh toán — cần xác nhận OTP qua email.'
              : 'Có tài khoản để tích điểm và lên hạng thành viên mỗi lần thanh toán.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {authMode === 'register' && (
              <input
                type="text" placeholder="Họ và tên"
                value={authForm.fullName}
                onChange={e => setAuthForm({ ...authForm, fullName: e.target.value })}
                style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }}
              />
            )}
            <input
              type="tel" placeholder="Số điện thoại"
              value={authForm.phone}
              onChange={e => setAuthForm({ ...authForm, phone: e.target.value })}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }}
            />
            {authMode === 'register' && (
              <input
                type="email" placeholder="Email (để nhận mã OTP)"
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }}
              />
            )}
            <input
              type="password" placeholder="Mật khẩu"
              value={authForm.password}
              onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }}
            />
          </div>

          {authError && <p style={{ color: '#EF4444', fontSize: '13px', marginTop: '12px' }}>{authError}</p>}

          <button
            onClick={handleAuthSubmit}
            disabled={authLoading}
            style={{ width: '100%', marginTop: '20px', padding: '16px', backgroundColor: '#11117F', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700' }}
          >
            {authLoading ? 'Đang xử lý...' : (authMode === 'login' ? 'Đăng nhập' : 'Đăng ký')}
          </button>
        </>
        )
      ) : (
        <>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B' }}>
            Dùng tạm để đặt món — chỉ cần tên và số điện thoại, không cần mật khẩu. Không tích điểm hay lên hạng thành viên, và thông tin này sẽ tự xoá khỏi máy sau 24 giờ.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="text" placeholder="Tên của bạn"
              value={guestNameInput}
              onChange={e => setGuestNameInput(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }}
            />
            <input
              type="tel" placeholder="Số điện thoại"
              value={guestPhoneInput}
              onChange={e => setGuestPhoneInput(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' }}
            />
          </div>

          {authError && <p style={{ color: '#EF4444', fontSize: '13px', marginTop: '12px' }}>{authError}</p>}

          <button
            onClick={handleGuestContinue}
            style={{ width: '100%', marginTop: '20px', padding: '16px', backgroundColor: '#11117F', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700' }}
          >
            Tiếp tục với tên khách
          </button>

          {guestName && (
            <button
              onClick={handleClearGuest}
              style={{ width: '100%', marginTop: '10px', padding: '12px', background: 'none', border: 'none', color: '#EF4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              Xoá tài khoản khách hiện tại ({guestName} - {guestPhone})
            </button>
          )}
        </>
      )}
    </>
  );

  const fetchMenu = async () => {
    try {
      const [catsRes, foodsRes] = await Promise.all([
        apiService.catalog.getCategories(),
        apiService.catalog.getItems() // Không truyền includeProposals -> backend chỉ trả món đang ACTIVE (đã tắt bán/chờ duyệt sẽ không hiện ở đây)
      ]);
      setCategories(catsRes.data || []);
      setFoods(foodsRes.data || []);
      
      if (catsRes.data && catsRes.data.length > 0) {
        setActiveCategory(catsRes.data[0].id);
      }
    } catch (err) {
      setError('Lỗi khi tải thực đơn. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOrderModal = (food) => {
    setSelectedFoodForOrder(food);
    setOrderQuantity(1);
    setOrderOptions({
      'Ít đá': false,
      'Ít ngọt': false,
      'Không cay': false,
      'Nhiều cay': false,
      'Không hành': false
    });
    setOrderManualNote('');
  };

  const confirmAddToCart = () => {
    if (!selectedFoodForOrder) return;
    
    const selectedOptions = Object.keys(orderOptions).filter(opt => orderOptions[opt]);
    const finalNote = [
      ...selectedOptions, 
      orderManualNote.trim()
    ].filter(Boolean).join(', ');

    setCart(prev => {
      // Find if exact same item with exact same note exists
      const existing = prev.find(item => item.menuItemId === selectedFoodForOrder.id && item.note === finalNote);
      if (existing) {
        return prev.map(item => 
          (item.menuItemId === selectedFoodForOrder.id && item.note === finalNote)
            ? { ...item, quantity: item.quantity + orderQuantity } 
            : item
        );
      }
      return [...prev, {
        cartItemId: Math.random().toString(36).substr(2, 9), // Unique ID for cart item
        menuItemId: selectedFoodForOrder.id,
        foodName: selectedFoodForOrder.foodName,
        unitPrice: selectedFoodForOrder.price,
        quantity: orderQuantity,
        note: finalNote,
        image: selectedFoodForOrder.imageUrl
      }];
    });
    
    setSelectedFoodForOrder(null);
  };

  const updateCartItemQuantity = (cartItemId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.cartItemId === cartItemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const items = cart.map(item => ({
        menuItemId: item.menuItemId,
        foodName: item.foodName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        note: item.note
      }));

      // ✅ Trừ kho NGAY tại thời điểm món thực sự vào đơn (bấm "Đặt món" ở giỏ hàng), validate đủ
      // số lượng khách yêu cầu — nếu kho không đủ (VD: gọi 5 suất nhưng kho chỉ còn 3) thì chặn
      // luôn tại đây, không cho tạo/thêm vào đơn. Đồng bộ với luồng nhân viên (App.jsx/handleSubmitOrder).
      const deductItems = items.map(it => ({ menuItemId: it.menuItemId, quantity: it.quantity }));
      try {
        await apiService.catalog.deductStock(deductItems);
      } catch (e) {
        alert('Không đủ nguyên liệu trong kho: ' + e.message);
        setLoading(false);
        return;
      }

      // Từ đây kho đã bị trừ — nếu bước thêm món/tạo đơn bên dưới thất bại giữa chừng thì phải hoàn
      // lại phần vừa trừ (finally), tránh lệch số liệu kho cho món chưa thực sự vào đơn nào.
      let deductedPendingCompensation = true;
      try {
        // Nếu bàn này đã có đơn đang mở (khách gọi thêm món trong cùng lượt ăn), cộng dồn vào đơn cũ
        // thay vì tạo đơn mới — tránh 1 bàn bị tách thành nhiều đơn song song, dễ nhầm lẫn khi tính tiền.
        // Cách làm: lưu orderId vừa tạo vào sessionStorage của máy khách; lần gọi thêm sau sẽ kiểm tra
        // lại đơn đó còn đang mở không (PENDING/CONFIRMED/ORDERING) trước khi cộng vào. Nếu đơn đã
        // COMPLETED/CANCELLED, hoặc không kiểm tra được (vd. cần đăng nhập), thì tự tạo đơn mới như cũ —
        // không có gì bị hỏng thêm so với hành vi hiện tại.
        const storageKey = tableId ? `activeOrderId_table_${tableId}` : null;
        const cachedOrderId = storageKey ? sessionStorage.getItem(storageKey) : null;
        let reuseOrderId = null;

        if (cachedOrderId) {
          try {
            // Dùng endpoint public (không JWT) — endpoint thường /orders/{id} yêu cầu đăng nhập nhân
            // viên nên trước đây khách ẩn danh luôn bị 403 ở bước kiểm tra này, khiến "gọi thêm món"
            // không bao giờ cộng dồn được vào đơn cũ mà cứ tạo đơn mới mỗi lần.
            const check = await apiService.order.getPublicById(cachedOrderId, tableToken);
            const order = check?.data;
            if (order && ['PENDING', 'CONFIRMED', 'ORDERING'].includes(order.status)) {
              reuseOrderId = cachedOrderId;
            }
          } catch (checkErr) {
            reuseOrderId = null; // không kiểm tra được -> coi như không dùng lại, tạo đơn mới bên dưới
          }
        }

        if (reuseOrderId) {
          for (const item of items) {
            await apiService.order.addItemPublic(reuseOrderId, tableToken, item);
          }
        } else {
          const payload = {
            tableId,
            tableToken,
            // Đến đây tableId chắc chắn có giá trị (đã chặn ở gate "Không tìm thấy bàn" phía trên) —
            // tableName chỉ có thể thiếu nếu link QR quên tham số tableName, vẫn còn tableId để hiển thị.
            tableNumber: tableName || `Bàn ${tableId}`,
            // Khách dùng "tài khoản khách" tạm thời (không có customerId, không tích điểm) thì đính kèm
            // tên vào note để nhân viên/bếp biết đơn này của ai — customerId vẫn null như order ẩn danh.
            note: guestName ? `Khách: ${guestName} - ${guestPhone}` : 'Order từ mã QR',
            items,
            // Gắn khách đã đăng nhập vào đơn để loyalty-service cộng điểm đúng người lúc thanh toán.
            // null nếu khách không đăng nhập — order vẫn tạo được bình thường như trước giờ.
            customerId: customer?.id || null,
          };
          const res = await apiService.order.createPublic(payload);
          const newOrderId = res?.data?.id;
          if (storageKey && newOrderId) sessionStorage.setItem(storageKey, newOrderId);
        }

        deductedPendingCompensation = false;

        setOrderStatus('success');
        setCart([]);
        setShowCart(false);
      } finally {
        if (deductedPendingCompensation) {
          try { await apiService.catalog.refundStock(deductItems); } catch (_) { /* best-effort */ }
        }
      }
    } catch (err) {
      console.error(err);
      alert('Đã xảy ra lỗi khi đặt món: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Quán KHÔNG có hình thức "Mang đi" — mọi đơn đều phải gắn với 1 bàn thật. Trước đây thiếu
  // tableId/tableName trên URL thì âm thầm coi là đơn mang đi, khiến đơn của khách (đúng ra đang
  // ngồi ở 1 bàn) bị ghi sai thành "Mang đi" nếu link không mang theo thông tin bàn. Giờ chặn hẳn
  // tại đây — ưu tiên cao hơn cả màn cổng vào (!entryResolved) bên dưới, vì không có bàn thì dù
  // đăng nhập/chọn Khách xong cũng không có gì để gắn đơn vào.
  if (!tableId) {
    // Vào từ nút "Khách" (App.jsx -> /customer?entry=guest) thay vì quét QR thật -> cho phép tự
    // chọn bàn/đặt bàn trước thay vì chặn hẳn. Quét nhầm 1 link cụt không có tableId (không qua nút
    // Khách) thì vẫn bị chặn như cũ, vì không có ngữ cảnh gì để biết khách có thật sự ở quán không.
    const isGuestEntry = new URLSearchParams(window.location.search).get('entry') === 'guest';

    const resInputStyle = { width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', fontSize: '15px', boxSizing: 'border-box' };
    const resPrimaryBtnStyle = { width: '100%', padding: '16px', backgroundColor: '#11117F', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' };
    const resOutlineBtnStyle = { width: '100%', padding: '16px', backgroundColor: '#FFF', color: '#11117F', border: '2px solid #11117F', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' };

    if (isGuestEntry && (resStep === 'now' || resStep === 'later')) {
      return (
        <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', fontFamily: '"Inter", sans-serif' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <button onClick={handleResBack} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '14px', cursor: 'pointer', padding: 0, marginBottom: '16px' }}>← Quay lại</button>
            <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '800', color: '#11117F' }}>
              {resStep === 'now' ? '🍽️ Chọn bàn trống' : '📅 Đặt bàn trước'}
            </h1>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#64748B' }}>
              {resStep === 'now'
                ? 'Nhập thông tin để xem những bàn còn trống ngay bây giờ.'
                : 'Chọn ngày giờ bạn muốn đến — bàn sẽ được giữ cho bạn, chưa cần có mặt tại quán.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="text" placeholder="Tên của bạn" value={resName} onChange={e => setResName(e.target.value)} style={resInputStyle} />
              <input type="tel" placeholder="Số điện thoại" value={resPhone} onChange={e => setResPhone(e.target.value)} style={resInputStyle} />
              <input type="number" min="1" placeholder="Số lượng khách" value={resPartySize} onChange={e => setResPartySize(e.target.value)} style={resInputStyle} />
              {resStep === 'later' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="date" value={resDate} onChange={e => setResDate(e.target.value)} style={{ ...resInputStyle, flex: 1 }} />
                  <input type="time" value={resTime} onChange={e => setResTime(e.target.value)} style={{ ...resInputStyle, flex: 1 }} />
                </div>
              )}
            </div>

            {resError && <p style={{ color: '#EF4444', fontSize: '13px', marginTop: '14px' }}>{resError}</p>}

            <button onClick={handleFindAvailableTables} disabled={resLoading} style={{ ...resPrimaryBtnStyle, marginTop: '20px' }}>
              {resLoading ? 'Đang tìm...' : 'Tìm bàn trống'}
            </button>

            {resAvailable !== null && (
              resAvailable.length === 0 ? (
                <p style={{ marginTop: '20px', fontSize: '14px', color: '#64748B', textAlign: 'center' }}>
                  Hết bàn trống vào khung giờ này, vui lòng chọn giờ khác.
                </p>
              ) : (
                <>
                  <p style={{ margin: '24px 0 10px', fontSize: '13px', fontWeight: '700', color: '#11117F' }}>Chọn 1 bàn:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {resAvailable.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setResSelectedTableId(t.id)}
                        style={{
                          padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                          border: `2px solid ${resSelectedTableId === t.id ? '#11117F' : '#CBD5E1'}`,
                          backgroundColor: resSelectedTableId === t.id ? '#11117F' : '#FFF',
                          color: resSelectedTableId === t.id ? '#FFF' : '#11117F',
                        }}
                      >
                        Bàn {t.tableNumber} · {t.capacity} khách
                      </button>
                    ))}
                  </div>
                  <button onClick={handleConfirmReservation} disabled={resLoading || !resSelectedTableId} style={{ ...resPrimaryBtnStyle, marginTop: '20px' }}>
                    {resLoading ? 'Đang xử lý...' : (resStep === 'now' ? 'Xác nhận và vào thực đơn' : 'Xác nhận đặt bàn')}
                  </button>
                </>
              )
            )}
          </div>
        </div>
      );
    }

    if (isGuestEntry && resStep === 'success') {
      return (
        <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', fontFamily: '"Inter", sans-serif' }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>✅</div>
          <h1 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: '800', color: '#11117F' }}>Đã đặt bàn thành công!</h1>
          <div style={{ backgroundColor: '#FFF', borderRadius: '16px', padding: '20px 24px', margin: '0 0 28px', textAlign: 'left', width: '100%', maxWidth: '340px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: '0 0 8px', fontSize: '15px' }}><strong>Bàn:</strong> {resConfirmed?.tableNumber ?? '—'}</p>
            <p style={{ margin: '0 0 8px', fontSize: '15px' }}><strong>Thời gian:</strong> {resDate} lúc {resTime}</p>
            <p style={{ margin: '0 0 8px', fontSize: '15px' }}><strong>Số khách:</strong> {resPartySize}</p>
            <p style={{ margin: 0, fontSize: '15px' }}><strong>Tên:</strong> {resName}</p>
          </div>
          <p style={{ margin: '0 0 28px', fontSize: '14px', color: '#64748B', maxWidth: '340px', lineHeight: 1.6 }}>
            Vui lòng quét mã QR tại bàn khi đến quán để bắt đầu gọi món.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', backgroundColor: '#11117F', color: '#FFF', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
          >
            Xong
          </button>
        </div>
      );
    }

    return (
      <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', fontFamily: '"Inter", sans-serif' }}>
        <div style={{ fontSize: '56px', marginBottom: '20px' }}>🔒</div>
        <h1 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: '800', color: '#11117F' }}>Không tìm thấy bàn</h1>
        <p style={{ margin: '0 0 28px', fontSize: '15px', color: '#64748B', maxWidth: '360px', lineHeight: 1.6 }}>
          Nhà hàng không có hình thức mang đi — vui lòng quét mã QR gắn tại bàn bạn đang ngồi để bắt đầu đặt món. Link này không gắn với bàn nào cả.
        </p>

        {isGuestEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px', marginBottom: '20px' }}>
            <button onClick={() => { setResStep('now'); setResError(''); }} style={resPrimaryBtnStyle}>🍽️ Tôi đang ở nhà hàng, chọn bàn trống</button>
            <button onClick={() => { setResStep('later'); setResError(''); }} style={resOutlineBtnStyle}>📅 Đặt bàn trước theo giờ</button>
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', backgroundColor: isGuestEntry ? 'transparent' : '#11117F', color: isGuestEntry ? '#64748B' : '#FFF', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
        >
          {isGuestEntry ? 'Tôi có mã QR, thử lại' : 'Thử lại'}
        </button>
      </div>
    );
  }

  // Cổng vào toàn màn hình: chưa đăng nhập / chưa chọn Khách / chưa bấm "Tiếp tục không cần tài khoản"
  // thì dừng ở đây — không render thực đơn phía sau nữa, tránh tình trạng thấy mờ mờ món ăn qua modal.
  if (!entryResolved) {
    return (
      <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Inter", sans-serif' }}>
        <div style={{ backgroundColor: '#11117F', padding: '32px 20px', color: 'white', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>NHÀ HÀNG FOOD</h1>
          {tableName ? (
            <p style={{ margin: '8px 0 0 0', opacity: 0.85, fontSize: '14px' }}>Bàn {tableName} — vui lòng chọn cách vào thực đơn</p>
          ) : (
            <p style={{ margin: '8px 0 0 0', opacity: 0.85, fontSize: '14px' }}>Chào mừng quý khách</p>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', width: '100%', maxWidth: '420px', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: '800', color: '#1E293B' }}>Tài khoản</h3>
            {renderAuthTabs()}
            <button
              onClick={handleSkipEntry}
              style={{ width: '100%', marginTop: '4px', padding: '12px', background: 'none', border: 'none', color: '#94A3B8', fontSize: '13px', cursor: 'pointer' }}
            >
              Tiếp tục không cần tài khoản
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Màn chào ngắn ngay sau khi qua cổng vào, trước khi hiện menu thật — tự ẩn sau ~1.8s (xem effect ở trên).
  if (showWelcome) {
    const greeting = getWelcomeGreeting();
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'linear-gradient(135deg, #11117F 0%, #1E3A8A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center', padding: '24px', fontFamily: '"Inter", sans-serif' }}>
        <style>{`@keyframes welcomeFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div style={{ animation: 'welcomeFadeIn 0.4s ease' }}>
          <p style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.8, fontWeight: '700', letterSpacing: '1px' }}>NHÀ HÀNG FOOD</p>
          <h1 style={{ margin: '0 0 10px', fontSize: '26px', fontWeight: '800' }}>{greeting.title}</h1>
          <p style={{ margin: 0, fontSize: '15px', opacity: 0.85 }}>{greeting.subtitle}</p>
        </div>
      </div>
    );
  }

  if (loading && foods.length === 0) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Đang tải thực đơn...</div>;
  }

  if (orderStatus === 'success') {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <CheckCircle size={64} color="#10B981" style={{ margin: '0 auto 20px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '10px' }}>Đặt món thành công!</h2>
        <p style={{ color: '#64748B', marginBottom: '30px' }}>Bếp đã nhận order của bạn. Vui lòng chờ trong giây lát.</p>
        <button 
          onClick={() => setOrderStatus(null)}
          style={{ width: '100%', padding: '16px', backgroundColor: '#11117F', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700' }}
        >
          Tiếp tục xem Menu
        </button>
      </div>
    );
  }

  // Filter logic: apply search query first, then active category if no search query
  let activeFoods = foods;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    activeFoods = foods.filter(f => f.foodName.toLowerCase().includes(q));
  } else {
    activeFoods = foods.filter(f => f.categoryId === activeCategory);
  }

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', paddingBottom: '80px', fontFamily: '"Inter", sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#11117F', padding: '20px', color: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>NHÀ HÀNG FOOD</h1>
            {tableName ? (
              <p style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: '14px' }}>Bạn đang ngồi tại: <strong>Bàn {tableName}</strong></p>
            ) : (
              <p style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: '14px' }}>Chào mừng quý khách</p>
            )}
          </div>

          {customer ? (
            <button onClick={openAccountPanel} style={{
              display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: '20px', padding: '8px 14px', color: 'white', cursor: 'pointer', flexShrink: 0
            }}>
              <Award size={16} color={(TIER_FALLBACK[customer.tierRank] || {}).color || '#FFD700'} />
              <span style={{ fontSize: '13px', fontWeight: '700' }}>{customer.fullName || customer.phone}</span>
            </button>
          ) : guestName ? (
            <button onClick={() => setShowAuthModal(true)} title="Tài khoản khách tạm thời (24h) — bấm để đăng nhập/đăng ký tài khoản thật" style={{
              display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: '20px', padding: '8px 14px', color: 'white', cursor: 'pointer', flexShrink: 0
            }}>
              <User size={16} />
              <span style={{ fontSize: '13px', fontWeight: '700' }}>Khách: {guestName}</span>
            </button>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: '20px', padding: '8px 14px', color: 'white', cursor: 'pointer', flexShrink: 0
            }}>
              <User size={16} />
              <span style={{ fontSize: '13px', fontWeight: '700' }}>Đăng nhập</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '16px', backgroundColor: 'white', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: '12px', padding: '10px 16px' }}>
          <Search size={20} color="#94A3B8" />
          <input 
            type="text" 
            placeholder="Tìm kiếm món ăn..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', marginLeft: '10px', fontSize: '15px', color: '#1E293B' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94A3B8' }}><X size={16}/></button>
          )}
        </div>
      </div>

      {/* Categories (only show when not searching) */}
      {!searchQuery.trim() && (
        <div style={{ display: 'flex', overflowX: 'auto', padding: '16px', gap: '10px', backgroundColor: 'white', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: '70px', zIndex: 9 }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: activeCategory === cat.id ? '#11117F' : '#F1F5F9',
                color: activeCategory === cat.id ? 'white' : '#64748B',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {cat.name || cat.categoryName}
            </button>
          ))}
        </div>
      )}

      {/* Menu Items */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeFoods.map(food => {
          // Calculate total quantity of this food in cart (across all notes)
          const totalInCart = cart.filter(c => c.menuItemId === food.id).reduce((sum, c) => sum + c.quantity, 0);
          
          return (
            <div key={food.id} style={{ display: 'flex', backgroundColor: 'white', borderRadius: '16px', padding: '12px', gap: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} onClick={() => handleOpenOrderModal(food)}>
              {food.imageUrl ? (
                <img src={food.imageUrl.startsWith('http') ? food.imageUrl : `http://${window.location.hostname}:8081${food.imageUrl}`} alt={food.foodName} style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '90px', height: '90px', borderRadius: '12px', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>No Img</div>
              )}
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1E293B' }}>{food.foodName}</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '800', color: '#11117F' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(food.price)}
                  </p>
                </div>
                
                <div style={{ alignSelf: 'flex-end' }}>
                  {totalInCart > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#11117F', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                      Đã chọn ({totalInCart})
                    </div>
                  ) : (
                    <button 
                      style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: '#F1F5F9', color: '#11117F', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    >
                      <Plus size={16} /> Thêm
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {activeFoods.length === 0 && (
          <p style={{ textAlign: 'center', color: '#64748B', marginTop: '20px' }}>Không tìm thấy món ăn.</p>
        )}
      </div>

      {/* Floating Cart Bar */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', backgroundColor: '#11117F', color: 'white', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 25px rgba(17, 17, 127, 0.3)', cursor: 'pointer', zIndex: 100 }} onClick={() => setShowCart(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <ShoppingCart size={24} />
              <span style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#EF4444', color: 'white', fontSize: '12px', fontWeight: '800', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Tổng cộng</p>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(getTotal())}</p>
            </div>
          </div>
          <span style={{ fontWeight: '700', fontSize: '14px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '12px' }}>Xem giỏ hàng</span>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ backgroundColor: 'white', height: '85vh', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1E293B' }}>Giỏ hàng của bạn</h2>
              <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', color: '#64748B' }}><X size={24}/></button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {cart.map(item => (
                <div key={item.cartItemId} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  {item.image ? (
                    <img src={item.image.startsWith('http') ? item.image : `http://${window.location.hostname}:8081${item.image}`} alt={item.foodName} style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '60px', height: '60px', borderRadius: '12px', backgroundColor: '#E2E8F0' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>{item.foodName}</h3>
                    <p style={{ margin: '4px 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#11117F' }}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.unitPrice)}
                    </p>
                    {item.note && (
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748B', fontStyle: 'italic', backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px' }}>Ghi chú: {item.note}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '20px', width: 'fit-content' }}>
                      <button onClick={() => updateCartItemQuantity(item.cartItemId, -1)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}><Minus size={16} /></button>
                      <span style={{ fontWeight: '700', fontSize: '14px', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                      <button onClick={() => updateCartItemQuantity(item.cartItemId, 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: '#11117F', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} color="white" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ fontSize: '16px', color: '#64748B', fontWeight: '600' }}>Tổng cộng</span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: '#11117F' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(getTotal())}</span>
              </div>
              <button 
                onClick={submitOrder}
                disabled={loading}
                style={{ width: '100%', padding: '16px', backgroundColor: '#11117F', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                {loading ? 'Đang xử lý...' : 'Xác nhận đặt món'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Options Popup Modal */}
      {selectedFoodForOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#FFF', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', paddingBottom: '40px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1E293B' }}>{selectedFoodForOrder.foodName}</h3>
              <button onClick={() => setSelectedFoodForOrder(null)} style={{ background: 'transparent', border: 'none', color: '#64748B' }}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#475569' }}>Giá:</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: '#10B981' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedFoodForOrder.price)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#475569' }}>Số lượng:</span>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #CBD5E1', borderRadius: '12px', overflow: 'hidden' }}>
                <button type="button" onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))} style={{ width: '45px', height: '40px', border: 'none', background: '#F8FAFC', cursor: 'pointer', fontSize: '18px', fontWeight: '600' }}>-</button>
                <span style={{ width: '50px', textAlign: 'center', fontSize: '16px', fontWeight: '700' }}>{orderQuantity}</span>
                <button type="button" onClick={() => setOrderQuantity(orderQuantity + 1)} style={{ width: '45px', height: '40px', border: 'none', background: '#F8FAFC', cursor: 'pointer', fontSize: '18px', fontWeight: '600' }}>+</button>
              </div>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <span style={{ display: 'block', fontSize: '16px', fontWeight: '700', color: '#1E293B', marginBottom: '12px' }}>Tuỳ chọn thêm (chọn nhiều)</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {Object.keys(orderOptions).map(opt => (
                  <label key={opt} style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px', 
                    padding: '10px 16px', borderRadius: '20px', 
                    border: orderOptions[opt] ? '2px solid #11117F' : '1px solid #E2E8F0',
                    backgroundColor: orderOptions[opt] ? '#EFF6FF' : '#FFF',
                    color: orderOptions[opt] ? '#11117F' : '#64748B',
                    fontWeight: orderOptions[opt] ? '700' : '500'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={orderOptions[opt]} 
                      onChange={e => setOrderOptions({...orderOptions, [opt]: e.target.checked})} 
                      style={{ display: 'none' }} 
                    /> {opt}
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <span style={{ display: 'block', fontSize: '16px', fontWeight: '700', color: '#1E293B', marginBottom: '12px' }}>Ghi chú riêng cho đầu bếp</span>
              <textarea 
                value={orderManualNote}
                onChange={e => setOrderManualNote(e.target.value)}
                placeholder="Ví dụ: không lấy hành phi, cho nhiều nước dùng..."
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', resize: 'none', fontSize: '15px' }}
                rows={3}
              />
            </div>
            
            <button 
              onClick={confirmAddToCart}
              style={{ width: '100%', padding: '16px', backgroundColor: '#11117F', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              Thêm vào giỏ hàng - {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedFoodForOrder.price * orderQuantity)}
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal — dùng SAU KHI đã vào menu rồi (entryResolved), để khách nâng cấp từ tài khoản
          khách tạm lên tài khoản thật, hoặc đăng nhập/đăng ký thêm. Màn cổng vào ban đầu nằm riêng
          ở early-return phía trên, không dùng chung modal này để tránh vừa thấy món ăn vừa thấy form. */}
      {entryResolved && showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#FFF', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', paddingBottom: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1E293B' }}>Tài khoản</h3>
              <button onClick={() => { setShowAuthModal(false); setAuthError(''); }} style={{ background: 'transparent', border: 'none', color: '#64748B' }}><X size={24} /></button>
            </div>
            {renderAuthTabs()}
          </div>
        </div>
      )}

      {/* Account Panel — Tài khoản của tôi: điểm, hạng, lịch sử, đổi thưởng */}
      {showAccountPanel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ backgroundColor: '#F8FAFC', height: '90vh', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', backgroundColor: 'white', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1E293B' }}>Tài khoản của tôi</h2>
              <button onClick={() => setShowAccountPanel(false)} style={{ background: 'none', border: 'none', color: '#64748B' }}><X size={24} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {accountLoading ? (
                <p style={{ textAlign: 'center', color: '#64748B', padding: '40px 0' }}>Đang tải thông tin tài khoản...</p>
              ) : (
                <>
                  {/* Thẻ điểm + hạng */}
                  <div style={{
                    borderRadius: '20px', padding: '20px', color: 'white',
                    background: `linear-gradient(135deg, ${(TIER_FALLBACK[customer?.tierRank] || {}).color || '#11117F'}, #11117F)`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', opacity: 0.85 }}>{customer?.fullName || customer?.phone}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Award size={18} />
                          {(TIER_FALLBACK[customer?.tierRank] || {}).label || customer?.tierName || 'Thành viên'}
                        </p>
                      </div>
                      <button onClick={handleLogout} title="Đăng xuất" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px', padding: '8px', color: 'white', cursor: 'pointer', display: 'flex' }}>
                        <LogOut size={16} />
                      </button>
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Điểm hiện có</p>
                        <p style={{ margin: '2px 0 0', fontSize: '26px', fontWeight: '900' }}>{customer?.currentPoints ?? 0}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Tổng chi tiêu</p>
                        <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: '700' }}>
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(customer?.totalSpent || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Danh mục đổi thưởng */}
                  <div>
                    <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Gift size={18} /> Đổi điểm lấy ưu đãi
                    </h3>
                    {rewards.length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#94A3B8' }}>Hiện chưa có ưu đãi nào để đổi.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {rewards.map(r => {
                          const notEnough = (customer?.currentPoints ?? 0) < r.pointsCost;
                          return (
                            <div key={r.id} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                              <div>
                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1E293B' }}>{r.name}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>{r.pointsCost} điểm</p>
                              </div>
                              <button
                                onClick={() => handleRedeemReward(r.id)}
                                disabled={notEnough}
                                style={{
                                  padding: '8px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '700',
                                  backgroundColor: notEnough ? '#F1F5F9' : '#11117F', color: notEnough ? '#94A3B8' : 'white',
                                  cursor: notEnough ? 'not-allowed' : 'pointer', flexShrink: 0
                                }}
                              >
                                Đổi ngay
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Lịch sử điểm */}
                  <div>
                    <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <History size={18} /> Lịch sử điểm
                    </h3>
                    {pointsHistory.length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#94A3B8' }}>Chưa có giao dịch điểm nào.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {pointsHistory.map(tx => (
                          <div key={tx.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>{tx.note || tx.type}</p>
                              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94A3B8' }}>{tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : ''}</p>
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: tx.points >= 0 ? '#10B981' : '#EF4444' }}>
                              {tx.points >= 0 ? '+' : ''}{tx.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerOrderApp;
