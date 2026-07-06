import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Bed, 
  ListChecks, 
  FramerLogo, 
  Gear, 
  Plus, 
  Trash, 
  Check, 
  X, 
  Hourglass, 
  User, 
  CurrencyDollar, 
  Phone, 
  ArrowClockwise,
  CheckSquare,
  QrCode,
  Pizza,
  Receipt,
  Warning,
  Eye,
  Spinner,
  Sun,
  Moon,
  Calendar,
  TrendUp,
  Sparkle,
  Broom,
  Tag,
  ShieldCheck,
  DoorOpen,
  Users
} from '@phosphor-icons/react';

// Get current server base URL (handles running on different IP addresses)
const getBaseUrl = () => {
  const { protocol, hostname } = window.location;
  // If running in Vite dev mode, default to backend port 5000
  const port = window.location.port === '5173' ? '5000' : window.location.port;
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
};

const BASE_URL = getBaseUrl();

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('rooms');
  const [rooms, setRooms] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [networkIp, setNetworkIp] = useState({ ip: '127.0.0.1', port: '5000', url: 'http://localhost:5000', bankId: 'VCB', bankAccountNo: '', bankAccountName: '', hotelName: 'SRC Luxury Hotel' });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Theme states
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // History & Report states
  const [history, setHistory] = useState([]);
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [startDate, setStartDate] = useState(getTodayString);
  const [endDate, setEndDate] = useState(getTodayString);
  const [dailySummary, setDailySummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');



  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Modals & Actions state
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinForm, setCheckinForm] = useState({ guestName: '', hourlyOrDaily: 'daily' });
  
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutPreview, setCheckoutPreview] = useState(null);
  const [checkoutRoomStatus, setCheckoutRoomStatus] = useState('cleaning');

  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomForm, setNewRoomForm] = useState({ number: '', type: 'Phòng Đơn Tiêu Chuẩn', pricePerHour: 30000, pricePerDay: 250000, hourlyTiers: [] });

  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [newMenuForm, setNewMenuForm] = useState({ name: '', category: 'food', price: 50000, isAvailable: true, imageUrl: '' });

  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, type: '', item: null });

  const [activeStayDetails, setActiveStayDetails] = useState(null);
  const [socket, setSocket] = useState(null);

  // History detailed viewing modal states
  const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);
  const [selectedHistoryStay, setSelectedHistoryStay] = useState(null);
  const [loadingHistoryDetail, setLoadingHistoryDetail] = useState(false);


  // Play browser beep on new order
  const playBeep = () => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, context.currentTime); // A5 note
      gain.gain.setValueAtTime(0.15, context.currentTime);
      osc.start();
      osc.stop(context.currentTime + 0.15);
      
      // Double beep
      setTimeout(() => {
        const context2 = new (window.AudioContext || window.webkitAudioContext)();
        const osc2 = context2.createOscillator();
        const gain2 = context2.createGain();
        osc2.connect(gain2);
        gain2.connect(context2.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.5, context2.currentTime); // C6 note
        gain2.gain.setValueAtTime(0.15, context2.currentTime);
        osc2.start();
        osc2.stop(context2.currentTime + 0.18);
      }, 200);
    } catch (e) {
      console.warn('Audio context blocked or failed:', e);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Setup Socket
    const newSocket = io(BASE_URL);
    setSocket(newSocket);

    newSocket.on('new_order', (newOrder) => {
      playBeep();
      setOrders(prev => [newOrder, ...prev]);
    });

    newSocket.on('order_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    newSocket.on('rooms_updated', () => {
      fetchRooms();
    });

    newSocket.on('menu_updated', () => {
      fetchMenu();
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Trigger daily summary fetch when selected date range changes
  useEffect(() => {
    fetchDailySummary(startDate, endDate);
  }, [startDate, endDate]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchRooms(),
        fetchMenu(),
        fetchOrders(),
        fetchNetworkIp(),
        fetchHistory(),
        fetchDailySummary(startDate, endDate)
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    const res = await fetch(`${BASE_URL}/api/rooms`);
    if (res.ok) setRooms(await res.json());
  };

  const fetchMenu = async () => {
    const res = await fetch(`${BASE_URL}/api/menu`);
    if (res.ok) setMenuItems(await res.json());
  };

  const fetchOrders = async () => {
    const res = await fetch(`${BASE_URL}/api/orders`);
    if (res.ok) setOrders(await res.json());
  };

  const fetchNetworkIp = async () => {
    const res = await fetch(`${BASE_URL}/api/network-ip`);
    if (res.ok) setNetworkIp(await res.json());
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/history`);
      if (res.ok) setHistory(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDailySummary = async (start = startDate, end = endDate) => {
    try {
      setLoadingSummary(true);
      const res = await fetch(`${BASE_URL}/api/history/summary?startDate=${start}&endDate=${end}`);
      if (res.ok) setDailySummary(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSummary(false);
    }
  };


  // Checkin handlers
  const handleOpenCheckin = (room) => {
    setSelectedRoom(room);
    setCheckinForm({ guestName: '', hourlyOrDaily: 'daily' });
    setShowCheckinModal(true);
  };

  const submitCheckin = async () => {
    if (!checkinForm.guestName.trim()) {
      alert('Vui lòng nhập tên khách hàng.');
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/stays/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: selectedRoom.id,
          guest_name: checkinForm.guestName,
          hourly_or_daily: checkinForm.hourlyOrDaily
        })
      });

      if (res.ok) {
        setShowCheckinModal(false);
        fetchRooms();
      } else {
        alert('Check-in thất bại.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Checkout handlers
  const handleOpenCheckout = async (room) => {
    setSelectedRoom(room);
    try {
      const res = await fetch(`${BASE_URL}/api/stays/checkout-preview/${room.id}`);
      if (res.ok) {
        const preview = await res.json();
        setCheckoutPreview(preview);
        setCheckoutRoomStatus('cleaning');
        setShowCheckoutModal(true);
      } else {
        alert('Không tìm thấy thông tin lượt lưu trú của phòng này.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const submitCheckout = async () => {
    if (!checkoutPreview) return;
    try {
      const res = await fetch(`${BASE_URL}/api/stays/checkout/${selectedRoom.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_out_time: checkoutPreview.check_out_time,
          base_room_charge: checkoutPreview.roomCharge,
          room_status: 'cleaning'
        })
      });

      if (res.ok) {
        setShowCheckoutModal(false);
        setCheckoutPreview(null);
        setSelectedRoom(null);
        fetchRooms();
        fetchOrders();
        fetchHistory();
        fetchDailySummary(startDate, endDate);
      } else {
        alert('Checkout thất bại.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // View stay details
  const viewActiveStay = async (room) => {
    setSelectedRoom(room);
    const res = await fetch(`${BASE_URL}/api/stays/active/${room.id}`);
    if (res.ok) {
      const details = await res.json();
      setActiveStayDetails(details);
    }
  };

  // Order status actions
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchOrders();
        fetchDailySummary(startDate, endDate);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Room status quick toggles
  const setRoomStatus = async (roomId, newStatus) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    try {
      await fetch(`${BASE_URL}/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...room,
          status: newStatus
        })
      });
      fetchRooms();
    } catch (e) {
      console.error(e);
    }
  };

  // Room setup
  const addRoom = async () => {
    if (!newRoomForm.number.trim()) return;
    try {
      const res = await fetch(`${BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: newRoomForm.number,
          type: newRoomForm.type,
          price_per_hour: parseInt(newRoomForm.pricePerHour),
          price_per_day: parseInt(newRoomForm.pricePerDay),
          hourly_tiers: newRoomForm.hourlyTiers.length > 0 ? newRoomForm.hourlyTiers : null
        })
      });
      if (res.ok) {
        setShowAddRoomModal(false);
        setNewRoomForm({ number: '', type: 'Phòng Đơn Tiêu Chuẩn', pricePerHour: 30000, pricePerDay: 250000, hourlyTiers: [] });
        fetchRooms();
      } else {
        const d = await res.json();
        alert(d.error || 'Thêm phòng thất bại');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteRoom = (room) => {
    if (room.status === 'occupied') {
      alert('Không thể xóa phòng đang có khách! Vui lòng thực hiện Checkout trước.');
      return;
    }
    setDeleteConfirm({ show: true, type: 'room', item: room });
  };

  // Menu setup
  const addMenuItem = async () => {
    if (!newMenuForm.name.trim()) return;
    try {
      const res = await fetch(`${BASE_URL}/api/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMenuForm.name,
          category: newMenuForm.category,
          price: parseInt(newMenuForm.price),
          is_available: newMenuForm.isAvailable,
          image_url: newMenuForm.imageUrl
        })
      });
      if (res.ok) {
        setShowAddMenuModal(false);
        setNewMenuForm({ name: '', category: 'food', price: 50000, isAvailable: true, imageUrl: '' });
        fetchMenu();
      } else {
        const d = await res.json();
        alert(d.error || 'Thêm món thất bại');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMenuItem = (id) => {
    const item = menuItems.find(mi => mi.id === id);
    if (!item) return;
    setDeleteConfirm({ show: true, type: 'menu', item: item });
  };

  const executeDelete = async () => {
    const { type, item } = deleteConfirm;
    if (!item) return;
    
    setDeleteConfirm({ show: false, type: '', item: null });
    
    if (type === 'menu') {
      try {
        const res = await fetch(`${BASE_URL}/api/menu/${item.id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          fetchMenu();
        } else {
          const errorData = await res.json();
          alert(`Không thể xóa món: ${errorData.error || 'Lỗi không xác định'}`);
        }
      } catch (e) {
        console.error(e);
        alert(`Đã xảy ra lỗi kết nối khi xóa món: ${e.message}`);
      }
    } else if (type === 'room') {
      try {
        const res = await fetch(`${BASE_URL}/api/rooms/${item.id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          fetchRooms();
        } else {
          const errorData = await res.json();
          alert(`Không thể xóa phòng: ${errorData.error || 'Lỗi không xác định'}`);
        }
      } catch (e) {
        console.error(e);
        alert(`Đã xảy ra lỗi kết nối khi xóa phòng: ${e.message}`);
      }
    }
  };

  const toggleMenuAvailable = async (item) => {
    try {
      await fetch(`${BASE_URL}/api/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          is_available: item.is_available ? 0 : 1
        })
      });
      fetchMenu();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetAllData = async () => {
    if (!window.confirm('CẢNH BÁO: Hành động này sẽ XÓA SẠCH toàn bộ dữ liệu giao dịch lưu trú, đơn hàng dịch vụ và đưa toàn bộ phòng về trạng thái trống.\n\nBạn có chắc chắn muốn reset không?')) return;
    if (!window.confirm('XÁC NHẬN LẦN CUỐI: Dữ liệu bị xóa sẽ KHÔNG THỂ KHÔI PHỤC.\n\nBạn vẫn muốn tiếp tục xóa?')) return;

    try {
      const res = await fetch(`${BASE_URL}/api/system/reset-data`, {
        method: 'POST'
      });
      if (res.ok) {
        alert('Reset toàn bộ dữ liệu thành công!');
        fetchRooms();
        fetchHistory();
        fetchDailySummary(startDate, endDate);
        setSelectedRoom(null);
        setActiveStayDetails(null);
      } else {
        const d = await res.json();
        alert(d.error || 'Reset thất bại');
      }
    } catch (e) {
      console.error(e);
      alert('Không kết nối được tới server');
    }
  };

  const handleOpenHistoryDetail = async (stayId) => {
    setLoadingHistoryDetail(true);
    setShowHistoryDetailModal(true);
    setSelectedHistoryStay(null);
    try {
      const res = await fetch(`${BASE_URL}/api/history/stay/${stayId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedHistoryStay(data);
      } else {
        alert('Không tải được chi tiết lịch sử này');
        setShowHistoryDetailModal(false);
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối tới máy chủ');
      setShowHistoryDetailModal(false);
    } finally {
      setLoadingHistoryDetail(false);
    }
  };

  const handlePrintReceipt = (stayData) => {
    const { stay, orders } = stayData;
    const w = window.open();

    const isHourly = stay.hourly_or_daily === 'hourly';
    const checkIn = new Date(stay.check_in_time);
    const checkOut = new Date(stay.check_out_time);
    const diffMs = checkOut - checkIn;
    const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const ordersTotal = orders.reduce((sum, o) => sum + o.total_price, 0);
    const grandTotal = stay.base_room_charge + ordersTotal;

    let ordersHtml = '';
    if (orders.length > 0) {
      ordersHtml = `
        <div style="font-weight:bold;margin-top:10px;font-size:11px;color:#888;text-transform:uppercase;">Dịch vụ F&B sử dụng</div>
      `;
      orders.forEach(o => {
        if (o.items) {
          o.items.forEach(it => {
            ordersHtml += `
              <div style="display:flex;justify-content:between;padding-left:10px;font-size:11px;color:#444;">
                <span>- ${it.name} x${it.quantity}</span>
                <span style="margin-left:auto;font-family:monospace;">${(it.price * it.quantity).toLocaleString()}đ</span>
              </div>
            `;
          });
        }
      });
      ordersHtml += `
        <div style="display:flex;justify-content:between;padding-top:5px;font-weight:bold;border-top:1px dashed #eee;">
          <span>Tổng tiền dịch vụ:</span>
          <span style="margin-left:auto;font-family:monospace;">${ordersTotal.toLocaleString()}đ</span>
        </div>
      `;
    }

    const durationText = isHourly ? `${hours} giờ` : `${days} ngày`;

    w.document.write(`
      <div style="text-align:center;font-family:sans-serif;padding:30px;max-width:400px;margin:auto;border:1px solid #ddd;border-radius:10px;">
        <h2 style="margin:0 0 5px 0;font-size:22px;letter-spacing:-0.5px;">\${(networkIp.hotelName || 'SRC LUXURY HOTEL').toUpperCase()}</h2>
        <p style="color:#666;font-size:11px;margin:0 0 20px 0;">Đơn Vị Quản Lý Phòng Nghỉ & Dịch Vụ</p>
        
        <div style="border-bottom:1px dashed #ccc;padding-bottom:10px;margin-bottom:15px;text-align:left;font-size:12px;line-height:1.6;">
          <strong>Khách hàng:</strong> \${stay.guest_name}<br/>
          <strong>Số phòng:</strong> Phòng \${stay.room_number}<br/>
          <strong>Hình thức:</strong> \${isHourly ? 'Theo giờ' : 'Theo ngày'}<br/>
          <strong>Thời điểm vào:</strong> \${checkIn.toLocaleString('vi-VN')}<br/>
          <strong>Thời điểm ra:</strong> \${checkOut.toLocaleString('vi-VN')}
        </div>

        <div style="text-align:left;font-size:12px;line-height:1.8;margin-bottom:15px;">
          <div style="font-weight:bold;margin-bottom:5px;border-bottom:1px solid #eee;font-size:11px;color:#888;text-transform:uppercase;">Chi tiết hóa đơn</div>
          
          <div style="display:flex;justify-content:between;">
            <span>Tiền phòng (\${durationText}):</span>
            <span style="margin-left:auto;font-family:monospace;font-weight:bold;">\${stay.base_room_charge.toLocaleString()}đ</span>
          </div>

          \${ordersHtml}
        </div>

        <div style="border-top:2px solid #333;padding-top:10px;margin-top:20px;text-align:right;">
          <span style="font-size:12px;font-weight:bold;">TỔNG THỰC THU:</span><br/>
          <span style="font-size:24px;font-weight:bold;font-family:monospace;color:#10b981;">\${grandTotal.toLocaleString()}đ</span>
        </div>

        <div style="margin-top:40px;font-size:11px;color:#999;font-style:italic;">
          Cảm ơn quý khách đã tin tưởng và lựa chọn \${networkIp.hotelName || 'SRC Luxury Hotel'}!<br/>
          Hẹn gặp lại quý khách!
        </div>
        <script>window.print();</script>
      </div>
    `);
    w.document.close();
  };

  // Helper formatting and labels
  const getRoomStatusLabel = (status) => {
    switch (status) {
      case 'empty': return 'Phòng Trống';
      case 'occupied': return 'Đang Có Khách';
      case 'cleaning': return 'Đang Dọn';
      case 'booked': return 'Đã Đặt Trước';
      default: return status;
    }
  };

  const getRoomStatusColor = (status) => {
    const isLight = theme === 'light';
    if (isLight) {
      switch (status) {
        case 'empty': return 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 shadow-sm';
        case 'occupied': return 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-950 border-l-2 border-l-emerald-500 shadow-sm';
        case 'cleaning': return 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-950 border-l-2 border-l-amber-500 shadow-sm';
        case 'booked': return 'bg-white border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-950 border-l-2 border-l-blue-500 shadow-sm';
        default: return 'bg-white border-zinc-200 text-zinc-800';
      }
    }
    switch (status) {
      case 'empty': return 'bg-zinc-900/30 border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800 text-zinc-400';
      case 'occupied': return 'bg-zinc-900/30 border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800 text-white border-l-2 border-l-emerald-500';
      case 'cleaning': return 'bg-zinc-900/30 border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800 text-white border-l-2 border-l-amber-500';
      case 'booked': return 'bg-zinc-900/30 border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800 text-white border-l-2 border-l-blue-500';
      default: return 'bg-zinc-900/30 border-zinc-900 text-zinc-300';
    }
  };


  const activeOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-bg-app text-text-sub transition-colors duration-200">
        <Spinner size={36} className="animate-spin text-emerald-500 mb-4" />
        <p className="font-mono text-xs uppercase tracking-widest text-text-sub">Đang khởi tạo hệ thống quản trị...</p>
      </div>
    );
  }


  return (
    <div className="h-screen bg-bg-app text-text-main font-sans flex flex-col antialiased transition-colors duration-200 overflow-hidden">
      {/* ── TOP NAVBAR ───────────────────────────────────────────────── */}
      <header className="border-b border-border-subtle bg-bg-app sticky top-0 px-6 py-0 flex items-stretch justify-between z-10 h-14">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-zinc-950 font-black text-xs shadow-lg shadow-emerald-500/30">
            H
          </div>
          <div>
            <span className="brand-rainbow-title block" style={{ fontSize: '18px', '--stroke-width': '2px' }}>{networkIp.hotelName || 'SRC Hotel'}</span>
          </div>
        </div>

        {/* Center: Occupancy bar */}
        <div className="hidden md:flex items-center gap-4 px-6">
          {rooms.length > 0 && (() => {
            const occupied = rooms.filter(r => r.status === 'occupied').length;
            const pct = Math.round((occupied / rooms.length) * 100);
            return (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-text-sub uppercase tracking-widest font-mono">Công suất phòng</p>
                  <p className="text-sm font-bold text-text-main">{pct}%</p>
                </div>
                <div className="w-32 h-1.5 bg-zinc-800/20 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-text-sub uppercase tracking-widest font-mono">Có khách</p>
                  <p className="text-sm font-bold text-emerald-500">{occupied}/{rooms.length}</p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right: clock + theme + refresh */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-base font-mono font-bold text-text-main tracking-tight leading-none">
              {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-[10px] font-mono text-text-sub leading-none mt-0.5">
              {currentTime.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })}
            </p>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-zinc-500/10 rounded-lg text-text-sub hover:text-text-main transition-colors duration-150 active:scale-95"
            title={theme === 'light' ? 'Chuyển sang giao diện Tối' : 'Chuyển sang giao diện Sáng'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <button
            onClick={fetchInitialData}
            className="p-2 hover:bg-zinc-500/10 rounded-lg text-text-sub hover:text-text-main transition-colors duration-150 active:scale-95"
            title="Đồng bộ lại"
          >
            <ArrowClockwise size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
        <aside className="w-56 border-r border-border-subtle flex flex-col flex-shrink-0 bg-bg-side transition-colors duration-200">


          {/* Nav items */}
          <nav className="p-3 flex flex-col gap-0.5 flex-1">
            <p className="px-3 pt-1 pb-2 text-[9px] font-bold text-text-sub uppercase tracking-[0.18em] font-mono">Điều hướng</p>

            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold
                transition-[background-color,color] duration-[240ms] [transition-timing-function:cubic-bezier(.645,.045,.355,1)] ${
                activeTab === 'rooms'
                  ? 'bg-emerald-500/10 text-emerald-500 border-l-2 border-emerald-500 font-bold'
                  : 'text-text-sub hover:text-text-main hover:bg-zinc-500/10'
              }`}
            >
              <Bed size={15} />
              <span>Sơ Đồ Phòng</span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${
                activeTab === 'rooms' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-500/10 text-text-sub'
              }`}>{rooms.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('room-manage')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold
                transition-[background-color,color] duration-[240ms] [transition-timing-function:cubic-bezier(.645,.045,.355,1)] ${
                activeTab === 'room-manage'
                  ? 'bg-emerald-500/10 text-emerald-500 border-l-2 border-emerald-500 font-bold'
                  : 'text-text-sub hover:text-text-main hover:bg-zinc-500/10'
              }`}
            >
              <Gear size={15} />
              <span>Quản Lý Phòng</span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${
                activeTab === 'room-manage' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-500/10 text-text-sub'
              }`}>{rooms.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold
                transition-[background-color,color] duration-[240ms] [transition-timing-function:cubic-bezier(.645,.045,.355,1)] ${
                activeTab === 'orders'
                  ? 'bg-emerald-500/10 text-emerald-500 border-l-2 border-emerald-500 font-bold'
                  : 'text-text-sub hover:text-text-main hover:bg-zinc-500/10'
              }`}
            >
              <ListChecks size={15} />
              <span>Đơn Đặt Món</span>
              {activeOrdersCount > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 bg-emerald-500 text-zinc-950 rounded-full animate-pulse">
                  {activeOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('menu')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold
                transition-[background-color,color] duration-[240ms] [transition-timing-function:cubic-bezier(.645,.045,.355,1)] ${
                activeTab === 'menu'
                  ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500 font-bold'
                  : 'text-text-sub hover:text-text-main hover:bg-zinc-500/10'
              }`}
            >
              <Pizza size={15} />
              <span>Thực Đơn (F&B)</span>
              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${
                activeTab === 'menu' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-500/10 text-text-sub'
              }`}>{menuItems.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('qr')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold
                transition-[background-color,color] duration-[240ms] [transition-timing-function:cubic-bezier(.645,.045,.355,1)] ${
                activeTab === 'qr'
                  ? 'bg-emerald-500/10 text-emerald-500 border-l-2 border-emerald-500 font-bold'
                  : 'text-text-sub hover:text-text-main hover:bg-zinc-500/10'
              }`}
            >
              <QrCode size={15} />
              <span>Mã QR Phòng</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold
                transition-[background-color,color] duration-[240ms] [transition-timing-function:cubic-bezier(.645,.045,.355,1)] ${
                activeTab === 'history'
                  ? 'bg-emerald-500/10 text-emerald-500 border-l-2 border-emerald-500 font-bold'
                  : 'text-text-sub hover:text-text-main hover:bg-zinc-500/10'
              }`}
            >
              <TrendUp size={15} />
              <span>Doanh Thu & Lịch Sử</span>
            </button>
          </nav>

          {/* Bottom: Status legend */}
          <div className="p-3 border-t border-border-subtle space-y-1.5">
            <p className="text-[9px] font-bold text-text-sub uppercase tracking-[0.18em] font-mono px-1 mb-2">Trạng thái</p>
            {[
              { color: theme === 'light' ? 'bg-zinc-400' : 'bg-zinc-500', label: 'Phòng trống', count: rooms.filter(r => r.status === 'empty').length },
              { color: 'bg-emerald-500', label: 'Có khách', count: rooms.filter(r => r.status === 'occupied').length },
              { color: 'bg-amber-400', label: 'Đang dọn', count: rooms.filter(r => r.status === 'cleaning').length },
            ].map(({ color, label, count }) => (
              <div key={label} className="flex items-center gap-2 px-1">
                <div className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0`} />
                <span className="text-[10px] text-text-sub flex-1">{label}</span>
                <span className="text-[10px] font-mono font-bold text-text-main">{count}</span>
              </div>
            ))}
          </div>
        </aside>


        {/* Content Area */}
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl">
          
          {/* TAB 1: ROOMS GRID */}
          {activeTab === 'rooms' && (
            <div className="animate-tab-in space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-text-main">Sơ Đồ Phòng Khách Sạn</h2>
                  <p className="text-xs text-text-sub mt-1">Bấm vào từng phòng để check-in, xem chi tiết hoặc thực hiện thanh toán checkout.</p>
                </div>
                <button 
                  onClick={() => setShowAddRoomModal(true)}
                  className="flex items-center gap-1.5 bg-bg-card hover:bg-zinc-500/10 border border-border-subtle text-text-main px-4 py-2 rounded-lg text-xs font-semibold transition active:scale-95 shadow-sm"
                >
                  <Plus size={14} />
                  Thêm Phòng
                </button>
              </div>

              {/* ── Stat Metrics — asymmetric layout with icons ── */}
              <div className="grid grid-cols-12 gap-3">
                {/* Total rooms */}
                <div className="col-span-3 bg-bg-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:shadow transition-shadow">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-mono text-text-sub uppercase tracking-widest font-semibold">Tổng phòng</p>
                    <div className="p-1.5 rounded-lg bg-zinc-500/10 text-text-sub border border-border-subtle/50">
                      <DoorOpen size={16} />
                    </div>
                  </div>
                  <p className="text-5xl font-extrabold tracking-tighter text-text-main mt-2">{rooms.length}</p>
                  <p className="text-[10px] text-text-sub mt-1 font-semibold flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Đang hoạt động ổn định
                  </p>
                </div>

                {/* Occupied rooms */}
                <div className="col-span-3 bg-emerald-500/5 dark:bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-bold">Đang có khách</p>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <Users size={16} />
                    </div>
                  </div>
                  <p className="text-5xl font-extrabold tracking-tighter text-emerald-500 mt-2">
                    {rooms.filter(r => r.status === 'occupied').length}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {rooms.length > 0 ? Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100) : 0}% công suất
                  </p>
                </div>

                {/* Empty rooms */}
                <div className="col-span-3 bg-bg-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-mono text-text-sub uppercase tracking-widest font-semibold">Phòng trống</p>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500/80 border border-emerald-500/10">
                      <Sparkle size={16} />
                    </div>
                  </div>
                  <p className="text-5xl font-extrabold tracking-tighter text-text-main mt-2">
                    {rooms.filter(r => r.status === 'empty').length}
                  </p>
                  <p className="text-[10px] text-text-sub mt-1 font-semibold flex items-center gap-1">
                    <Check size={12} className="text-emerald-500" />
                    Sẵn sàng đón khách mới
                  </p>
                </div>

                {/* Cleaning rooms */}
                <div className="col-span-3 bg-amber-500/5 dark:bg-amber-500/8 border border-amber-500/20 rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow transition-shadow">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-mono text-amber-600 dark:text-amber-400 uppercase tracking-widest font-bold">Đang dọn dẹp</p>
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      <Broom size={16} />
                    </div>
                  </div>
                  <p className="text-5xl font-extrabold tracking-tighter text-amber-500 mt-2">
                    {rooms.filter(r => r.status === 'cleaning').length}
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 font-semibold flex items-center gap-1">
                    {rooms.filter(r => r.status === 'cleaning').length > 0 ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    ) : (
                      <Check size={12} className="text-amber-500" />
                    )}
                    Chờ xác nhận dọn xong
                  </p>
                </div>
              </div>

              {/* Rooms Map Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {rooms.map(room => {
                  const isOccupied = room.status === 'occupied';
                  const isCleaning = room.status === 'cleaning';
                  const isEmpty = room.status === 'empty';
                  
                  // Pick icon based on VIP/Suite type
                  const isVIP = room.type.toLowerCase().includes('vip') || room.type.toLowerCase().includes('suite');

                  return (
                    <div
                      key={room.id}
                      style={{ animationDelay: `${rooms.indexOf(room) * 40}ms` }}
                      className={`animate-item-in relative border rounded-2xl p-4 flex flex-col justify-between h-40 cursor-pointer
                        transition-all duration-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5
                        ${isEmpty ? 'bg-bg-card border-border-subtle hover:border-zinc-400 dark:hover:border-zinc-700' : ''}
                        ${isOccupied ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50 border-l-4 border-l-emerald-500' : ''}
                        ${isCleaning ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50 border-l-4 border-l-amber-500' : ''}
                      `}
                      onClick={() => {
                        if (isEmpty) handleOpenCheckin(room);
                        else viewActiveStay(room);
                      }}
                    >
                      {/* Top row */}
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-3xl font-extrabold font-mono tracking-tight text-text-main leading-none">
                            {room.number}
                          </span>
                          <span className="text-[9px] text-text-sub uppercase tracking-wider font-bold mt-1.5 flex items-center gap-1">
                            {isVIP ? (
                              <span className="text-amber-500 font-extrabold flex items-center gap-0.5">⭐ VIP</span>
                            ) : (
                              <span>Standard</span>
                            )}
                          </span>
                        </div>
                        
                        {/* Status Icon Indicator */}
                        <div className={`p-1.5 rounded-lg border ${
                          isEmpty ? 'bg-bg-app border-border-subtle text-text-sub' :
                          isOccupied ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                          'bg-amber-500/10 border-amber-500/20 text-amber-500'
                        }`}>
                          {isEmpty && <DoorOpen size={15} />}
                          {isOccupied && <Users size={15} />}
                          {isCleaning && <Broom size={15} className="animate-pulse" />}
                        </div>
                      </div>

                      {/* Middle: Active guest info if occupied */}
                      {isOccupied && room.active_guest_name ? (
                        <div className="my-1.5 py-1 px-2 bg-emerald-500/10 rounded-lg border border-emerald-500/10 flex items-center gap-1.5 overflow-hidden">
                          <User size={11} className="text-emerald-500 flex-shrink-0" />
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                            {room.active_guest_name}
                          </span>
                        </div>
                      ) : (
                        <div className="h-6" /> // spacer
                      )}

                      {/* Bottom row */}
                      <div className="border-t border-border-subtle/40 pt-2 mt-auto">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-text-sub font-medium flex items-center gap-1">
                            <Tag size={9} />
                            {room.price_per_day.toLocaleString('vi-VN')}đ
                          </span>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            isEmpty ? 'bg-zinc-500/10 text-text-sub' :
                            isOccupied ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                            'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}>
                            {isEmpty ? 'Trống' : isOccupied ? 'Có Khách' : 'Đang Dọn'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Stay Side Detail Drawer (Below room layout or on side) */}
              {selectedRoom && (selectedRoom.status === 'cleaning' || activeStayDetails) && (
                <div className="border border-border-subtle bg-bg-card rounded-2xl p-6 relative shadow-sm overflow-hidden transition-colors duration-200">
                  {/* Rainbow Top Border Accent */}
                  <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 via-green-400 via-blue-400 via-indigo-400 to-purple-400" />
                  
                  <button 
                    onClick={() => {
                      setActiveStayDetails(null);
                      setSelectedRoom(null);
                    }}
                    className="absolute top-5 right-5 text-text-sub hover:text-text-main transition active:scale-90"
                  >
                    <X size={18} />
                  </button>

                  <h3 className="text-base font-bold text-text-main mb-5 mt-1">
                    Thông tin Phòng {selectedRoom.number} ({getRoomStatusLabel(selectedRoom.status)})
                  </h3>

                  {selectedRoom.status === 'occupied' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <span className="text-[10px] font-mono text-text-sub uppercase block border-b border-border-subtle pb-1">Thông tin khách</span>
                        <p className="text-sm font-bold flex items-center gap-2 text-text-main"><User className="text-text-sub" size={16} /> {activeStayDetails.guest_name}</p>
                        <p className="text-xs text-text-sub">Vào phòng: <span className="font-semibold text-text-main">{new Date(activeStayDetails.check_in_time).toLocaleString('vi-VN')}</span></p>
                        <p className="text-xs text-text-sub">Hình thức: <span className="font-semibold text-text-main">{activeStayDetails.hourly_or_daily === 'hourly' ? 'Tính theo giờ' : 'Tính theo ngày'}</span></p>
                      </div>

                      <div className="space-y-3">
                        <span className="text-[10px] font-mono text-text-sub uppercase block border-b border-border-subtle pb-1">Dịch vụ & Gọi món qua QR</span>
                        {activeStayDetails.orders?.length === 0 ? (
                          <p className="text-xs text-text-sub italic">Chưa gọi đồ ăn/uống nào.</p>
                        ) : (
                          <div className="text-xs max-h-40 overflow-y-auto space-y-2 pr-1">
                            {activeStayDetails.orders.map(order => (
                              <div key={order.id} className="bg-bg-app/40 p-2.5 rounded-lg border border-border-subtle/80">
                                <div className="flex justify-between font-bold text-text-main">
                                  <span>Đơn #{order.id}</span>
                                  <span className="text-emerald-500 font-mono font-bold">{order.total_price.toLocaleString()}đ</span>
                                </div>
                                <div className="text-[10px] text-text-sub mt-1.5 space-y-0.5 font-medium">
                                  {order.items?.map(it => (
                                    <div key={it.id} className="flex justify-between">
                                      <span>- {it.name}</span>
                                      <span className="font-semibold text-text-main">x{it.quantity}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-end gap-3">
                        <button
                          onClick={() => handleOpenCheckout(selectedRoom)}
                          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg shadow-md shadow-emerald-500/10 transition active:scale-95 text-center cursor-pointer"
                        >
                          Checkout & Tính Tiền
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedRoom.status === 'cleaning' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                      <p className="text-xs text-text-sub">Phòng đang dọn dẹp. Đã hoàn tất công việc dọn phòng?</p>
                      <button
                        onClick={() => {
                          setRoomStatus(selectedRoom.id, 'empty');
                          setActiveStayDetails(null);
                          setSelectedRoom(null);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95 shadow-md shadow-emerald-500/10 cursor-pointer"
                      >
                        Đã dọn xong (Sẵn sàng đón khách)
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 1.b: ROOM MANAGEMENT */}
          {activeTab === 'room-manage' && (
            <div className="animate-tab-in space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-text-main">Quản Lý Danh Sách Phòng</h2>
                  <p className="text-xs text-text-sub mt-1">Quản lý sơ đồ phòng, thiết lập giá phòng theo ngày, theo giờ, và cấu hình các bậc giá.</p>
                </div>
                <button 
                  onClick={() => setShowAddRoomModal(true)}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-4 py-2 rounded-lg text-xs transition active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  <Plus size={14} weight="bold" />
                  Thêm phòng mới
                </button>
              </div>

              <div className="border border-border-subtle rounded-xl overflow-hidden bg-bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-subtle bg-bg-app/40 text-text-sub uppercase font-mono text-[10px] tracking-wider">
                        <th className="p-4 font-semibold">Số phòng</th>
                        <th className="p-4 font-semibold">Loại phòng</th>
                        <th className="p-4 font-semibold">Giá theo ngày</th>
                        <th className="p-4 font-semibold">Giá theo giờ (Cơ bản)</th>
                        <th className="p-4 font-semibold">Bậc giá giờ</th>
                        <th className="p-4 font-semibold">Trạng thái hiện tại</th>
                        <th className="p-4 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/50 text-text-main">
                      {rooms.map(room => {
                        const isVIP = room.type.toLowerCase().includes('vip') || room.type.toLowerCase().includes('suite');
                        const tiers = room.hourly_tiers ? (typeof room.hourly_tiers === 'string' ? JSON.parse(room.hourly_tiers) : room.hourly_tiers) : null;
                        
                        return (
                          <tr key={room.id} className="hover:bg-zinc-500/5 transition">
                            <td className="p-4 font-bold font-mono text-sm text-text-main">
                              Phòng {room.number}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isVIP ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' : 'bg-zinc-500/10 text-text-sub border border-border-subtle/30'
                              }`}>
                                {room.type}
                              </span>
                            </td>
                            <td className="p-4 font-mono font-bold">
                              {room.price_per_day.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="p-4 font-mono">
                              {room.price_per_hour.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="p-4">
                              {tiers && tiers.length > 0 ? (
                                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/15 rounded text-[10px] font-semibold">
                                  {tiers.length} bậc giá
                                </span>
                              ) : (
                                <span className="text-text-sub italic">Mặc định</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                room.status === 'empty' ? 'bg-zinc-500/10 text-text-sub border border-border-subtle/20' :
                                room.status === 'occupied' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              }`}>
                                {room.status === 'empty' ? 'Trống' : room.status === 'occupied' ? 'Có khách' : 'Đang dọn'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => deleteRoom(room)}
                                className={`p-1.5 rounded-lg transition active:scale-90 cursor-pointer ${
                                  room.status === 'occupied' 
                                    ? 'text-zinc-600 cursor-not-allowed opacity-40' 
                                    : 'hover:bg-rose-500/10 text-text-sub hover:text-rose-500'
                                }`}
                                title={room.status === 'occupied' ? 'Không thể xóa phòng đang có khách' : 'Xóa phòng'}
                                disabled={room.status === 'occupied'}
                              >
                                <Trash size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORDER QUEUE */}
          {activeTab === 'orders' && (
            <div className="animate-tab-in space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-text-main">Yêu cầu & Gọi Món Thời Gian Thực</h2>
                <p className="text-xs text-text-sub mt-1">Đơn đặt từ phòng khách quét mã QR sẽ đổ trực tiếp về đây kèm âm thanh thông báo.</p>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-16 bg-bg-card border border-border-subtle rounded-xl text-text-sub text-sm">
                  Hiện chưa có đơn đặt món nào phát sinh.
                </div>
              ) : (
                <div className="grid gap-4">
                  {orders.map(order => (
                    <div 
                      key={order.id}
                      className={`p-5 bg-bg-card border rounded-xl flex flex-col md:flex-row gap-6 justify-between transition ${
                        order.status === 'pending' 
                          ? 'border-amber-500/50 bg-amber-500/5' 
                          : 'border-border-subtle'
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 bg-zinc-500/10 text-text-main font-bold rounded-lg text-xs font-mono">
                            Phòng {order.room_number}
                          </span>
                          <span className="text-xs text-text-sub font-mono">
                            Mã đơn: #{order.id} | {new Date(order.created_at).toLocaleString('vi-VN')}
                          </span>
                        </div>

                        {/* Order list items */}
                        <div className="mt-4 space-y-1 text-sm text-text-main">
                          {order.items?.map(item => (
                            <div key={item.id} className="flex justify-between max-w-md py-0.5 border-b border-border-subtle/30">
                              <span>
                                {item.name} <strong className="text-emerald-500 dark:text-emerald-400 text-xs font-bold">x{item.quantity}</strong>
                                {item.notes && <span className="text-amber-500 dark:text-amber-400 text-[10px] ml-2 block italic">({item.notes})</span>}
                              </span>
                              <span className="font-mono text-text-sub">
                                {(item.price * item.quantity).toLocaleString()}đ
                              </span>
                            </div>
                          ))}
                        </div>

                        {order.guest_name && (
                          <p className="text-xs text-text-sub italic mt-2">Khách lưu trú: {order.guest_name}</p>
                        )}
                      </div>

                      {/* Right actions and price */}
                      <div className="flex flex-col md:items-end justify-between gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-text-sub uppercase tracking-widest font-mono">Tổng đơn hàng</span>
                          <p className="text-xl font-bold text-text-main tracking-tight">{order.total_price.toLocaleString()} đ</p>
                        </div>

                        <div className="flex gap-2">
                          {order.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateOrderStatus(order.id, 'confirmed')}
                                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95 flex items-center gap-1.5 shadow-sm"
                              >
                                <Check size={14} weight="bold" /> Xác nhận đơn
                              </button>
                              <button
                                onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                className="px-3 py-2 bg-zinc-500/10 hover:bg-rose-500/10 text-rose-500 border border-border-subtle hover:border-rose-500/20 font-semibold text-xs rounded-lg transition active:scale-95"
                              >
                                Hủy
                              </button>
                            </>
                          )}


                          {order.status === 'confirmed' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'completed')}
                              className="px-3.5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-lg transition active:scale-95 flex items-center gap-1.5"
                            >
                              <CheckSquare size={14} /> Đã giao hàng
                            </button>
                          )}

                          {order.status === 'completed' && (
                            <span className="text-[10px] px-2.5 py-1 bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 font-bold rounded-lg uppercase tracking-wider">
                              Hoàn thành
                            </span>
                          )}

                          {order.status === 'cancelled' && (
                            <span className="text-[10px] px-2.5 py-1 bg-rose-950/20 border border-rose-900/40 text-rose-400 font-bold rounded-lg uppercase tracking-wider">
                              Đã hủy
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MENU MANAGEMENT */}
          {activeTab === 'menu' && (
            <div className="animate-tab-in space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-text-main">Quản Lý Danh Mục Thực Đơn</h2>
                  <p className="text-xs text-text-sub mt-1">Thiết lập danh sách món ăn, đồ uống, giá cả bán tại phòng.</p>
                </div>
                <button 
                  onClick={() => setShowAddMenuModal(true)}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-4 py-2 rounded-lg text-xs transition active:scale-95 shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  <Plus size={14} weight="bold" />
                  Thêm món mới
                </button>
              </div>

              <div className="border border-border-subtle rounded-xl overflow-hidden bg-bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-subtle bg-bg-app/40 text-text-sub uppercase font-mono text-[10px] tracking-wider">
                        <th className="p-4 font-semibold">Tên món</th>
                        <th className="p-4 font-semibold">Phân loại</th>
                        <th className="p-4 font-semibold">Đơn giá</th>
                        <th className="p-4 font-semibold">Trạng thái</th>
                        <th className="p-4 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/50 text-text-main">
                      {menuItems.map(item => (
                        <tr key={item.id} className="hover:bg-zinc-500/5 transition">
                          <td className="p-4 font-bold flex items-center gap-3">
                            {item.image_url && (
                              <img src={item.image_url} alt={item.name} className="w-8 h-8 rounded object-cover bg-bg-app border border-border-subtle" />
                            )}
                            <span>{item.name}</span>
                          </td>
                          <td className="p-4 text-text-sub">
                            {item.category === 'food' ? 'Đồ ăn' : item.category === 'drink' ? 'Đồ uống' : 'Dịch vụ'}
                          </td>
                          <td className="p-4 font-mono font-bold text-sm">
                            {item.price.toLocaleString()}đ
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => toggleMenuAvailable(item)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                                item.is_available 
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' 
                                  : 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400'
                              }`}
                            >
                              {item.is_available ? 'Còn hàng' : 'Hết hàng'}
                            </button>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => deleteMenuItem(item.id)}
                              className="p-1.5 hover:bg-rose-500/10 rounded-lg text-text-sub hover:text-rose-500 transition active:scale-90 cursor-pointer"
                              title="Xóa"
                            >
                              <Trash size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: QR GENERATOR */}
          {activeTab === 'qr' && (
            <div className="animate-tab-in space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-text-main">Danh Sách Mã QR Đặt Món Cho Từng Phòng</h2>
                <p className="text-xs text-text-sub mt-1">In hoặc dán mã này vào từng phòng. Khách hàng chỉ cần kết nối Wi-Fi khách sạn và quét mã để gọi món.</p>
              </div>

              <div className="bg-bg-card border border-border-subtle p-4 rounded-xl flex items-center gap-3 shadow-sm">
                <QrCode className="text-emerald-500" size={24} />
                <div className="text-xs text-text-sub">
                  <p>Địa chỉ mạng LAN hiện tại của máy chủ: <strong className="text-text-main font-mono">{networkIp.url}</strong></p>
                  <p className="mt-1">Địa chỉ QR mã hóa: <code className="text-emerald-600 dark:text-emerald-400 bg-bg-app border border-border-subtle px-1.5 py-0.5 rounded font-mono font-semibold">{networkIp.url}?room=X</code></p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {rooms.map(room => {
                  const targetUrl = `${networkIp.url}?room=${room.secure_id || ''}`;
                  return (
                    <div key={room.id} className="bg-bg-card border border-border-subtle p-5 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden group shadow-sm hover:shadow-md transition">
                      <div className="absolute top-3 left-3 text-[9px] font-mono text-text-sub uppercase tracking-wider font-bold">phòng</div>
                      <span className="text-2xl font-bold font-mono tracking-tight text-text-main mb-4 mt-2">{room.number}</span>
                      
                      {/* QR RENDER */}
                      <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-sm mb-4">
                        <QRCodeSVG value={targetUrl} size={130} />
                      </div>
                      
                      <div className="w-full space-y-1">
                        <p className="text-[10px] text-text-sub truncate leading-tight font-mono">{targetUrl}</p>
                        <p className="text-[10px] text-text-sub uppercase tracking-widest font-semibold mt-2">{room.type}</p>
                      </div>

                      <button
                        onClick={() => {
                          const w = window.open();
                          w.document.write(`
                            <div style="text-align:center;font-family:sans-serif;padding:60px;">
                              <h1>MÃ QR ĐẶT MÓN PHÒNG ${room.number}</h1>
                              <p style="color:#555;">\${networkIp.hotelName || 'SRC Luxury Hotel'} - Vui lòng kết nối Wi-Fi khách sạn để quét món</p>
                              <div style="margin:40px auto;width:250px;height:250px;border:1px solid #ccc;padding:20px;">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetUrl)}" />
                              </div>
                              <p style="font-size:12px;color:#aaa;font-family:monospace;">URL: ${targetUrl}</p>
                              <script>window.print();</script>
                            </div>
                          `);
                          w.document.close();
                        }}
                        className="mt-4 w-full py-1.5 bg-bg-app hover:bg-zinc-500/10 border border-border-subtle text-text-sub hover:text-text-main font-semibold text-xs rounded-lg transition active:scale-95 cursor-pointer"
                      >
                        In Mã QR này
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: REVENUE & HISTORY */}
          {activeTab === 'history' && (
            <div className="animate-tab-in space-y-8">
              {/* Header section with date picker */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-5">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-text-main">Doanh Thu & Lịch Sử Giao Dịch</h2>
                  <p className="text-xs text-text-sub mt-1">Báo cáo doanh thu chi tiết theo ngày và lưu trữ lịch sử lưu trú trong vòng 6 tháng.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap items-center gap-3 bg-bg-card border border-border-subtle p-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Calendar size={15} className="text-emerald-500" />
                      <span className="text-xs text-text-sub">Từ ngày:</span>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-bg-app border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-text-main focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-sub">Đến ngày:</span>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-bg-app border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-text-main focus:outline-none focus:border-emerald-500 font-mono font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {loadingSummary ? (
                <div className="flex flex-col items-center justify-center py-12 text-text-sub">
                  <Spinner size={24} className="animate-spin text-emerald-500 mb-2" />
                  <p className="text-[10px] uppercase tracking-wider font-mono">Đang tải báo cáo doanh thu...</p>
                </div>
              ) : dailySummary ? (
                <div className="space-y-6">
                  {/* Daily Metric Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-bg-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between">
                      <p className="text-[10px] font-mono text-text-sub uppercase tracking-widest">Tiền phòng thực thu</p>
                      <p className="text-3xl font-bold tracking-tight text-text-main mt-2">
                        {dailySummary.roomRevenue.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                      </p>
                      <p className="text-[9px] text-text-sub mt-1">từ {dailySummary.checkouts?.length || 0} lượt trả phòng</p>
                    </div>

                    <div className="bg-bg-card border border-border-subtle rounded-xl p-5 flex flex-col justify-between">
                      <p className="text-[10px] font-mono text-text-sub uppercase tracking-widest">Doanh thu dịch vụ (F&B)</p>
                      <p className="text-3xl font-bold tracking-tight text-text-main mt-2">
                        {dailySummary.fbRevenue.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                      </p>
                      <p className="text-[9px] text-text-sub mt-1">tổng các đơn F&B đã giao</p>
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 flex flex-col justify-between">
                      <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Tổng doanh thu</p>
                      <p className="text-3xl font-bold tracking-tight text-emerald-500 mt-2">
                        {dailySummary.grandTotal.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
                      </p>
                      <p className="text-[9px] text-emerald-700 dark:text-emerald-500 mt-1">tổng thực nhận</p>
                    </div>
                  </div>

                  {/* Asymmetric layout: Checkouts table vs F&B Sold list */}
                  <div className="grid grid-cols-12 gap-6">
                    {/* Left: Checked out guests */}
                    <div className="col-span-12 lg:col-span-7 bg-bg-card border border-border-subtle rounded-xl p-5 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                          <User size={15} className="text-emerald-500" />
                          Khách hàng trả phòng ({dailySummary.checkouts?.length || 0})
                        </h3>
                        <p className="text-[10px] text-text-sub mt-0.5">Danh sách các lượt lưu trú đã checkout trong khoảng thời gian này. Click tên để xem chi tiết.</p>
                      </div>

                      {dailySummary.checkouts?.length === 0 ? (
                        <div className="text-center py-8 text-text-sub text-xs bg-bg-app/20 border border-border-subtle rounded-lg">
                          Chưa có lượt trả phòng nào trong khoảng thời gian này.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-border-subtle text-text-sub font-mono text-[9px] uppercase tracking-wider">
                                <th className="pb-2 font-semibold">Khách hàng</th>
                                <th className="pb-2 font-semibold">Phòng</th>
                                <th className="pb-2 font-semibold">Hình thức</th>
                                <th className="pb-2 font-semibold text-right">Thực thu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle/40 text-text-main">
                              {dailySummary.checkouts.map(item => (
                                <tr 
                                  key={item.id} 
                                  onClick={() => handleOpenHistoryDetail(item.id)}
                                  className="hover:bg-zinc-500/5 cursor-pointer transition"
                                >
                                  <td className="py-2.5 font-bold text-emerald-500 hover:underline">{item.guest_name}</td>
                                  <td className="py-2.5 font-mono">{item.room_number}</td>
                                  <td className="py-2.5 text-text-sub">{item.hourly_or_daily === 'hourly' ? 'Theo giờ' : 'Theo ngày'}</td>
                                  <td className="py-2.5 text-right font-mono font-bold">{item.base_room_charge.toLocaleString()}đ</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Right: F&B items sold */}
                    <div className="col-span-12 lg:col-span-5 bg-bg-card border border-border-subtle rounded-xl p-5 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                          <Pizza size={15} className="text-emerald-500" />
                          Đồ ăn / Dịch vụ đã bán
                        </h3>
                        <p className="text-[10px] text-text-sub mt-0.5">Số lượng và doanh thu dịch vụ trong khoảng thời gian này.</p>
                      </div>

                      {dailySummary.itemsSold?.length === 0 ? (
                        <div className="text-center py-8 text-text-sub text-xs bg-bg-app/20 border border-border-subtle rounded-lg">
                          Chưa có món ăn hay dịch vụ nào được bán trong khoảng thời gian này.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dailySummary.itemsSold.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-bg-app/10 border border-border-subtle/50 rounded-lg text-xs hover:brightness-105 transition">
                              <div>
                                <p className="font-bold text-text-main truncate max-w-[200px]">{it.name}</p>
                                <p className="text-[9px] text-text-sub capitalize">
                                  {it.category === 'food' ? 'Đồ ăn' : it.category === 'drink' ? 'Đồ uống' : 'Dịch vụ'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono text-text-main font-bold">x{it.total_quantity}</p>
                                <p className="font-mono text-[10px] text-emerald-500 font-bold">{it.total_revenue.toLocaleString()}đ</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* 6-Month Full Historical list */}
              <div className="border-t border-border-subtle pt-6">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-text-main flex items-center gap-2">Lịch sử giao dịch 6 tháng qua</h3>
                  <p className="text-[10px] text-text-sub mt-0.5">Dữ liệu lượt ở đã hoàn thành được tự động dọn dẹp sau 6 tháng. Click dòng để xem chi tiết.</p>
                </div>

                {history.length === 0 ? (
                  <div className="text-center py-12 text-text-sub text-xs bg-bg-card border border-border-subtle rounded-xl">
                    Chưa có lượt giao dịch lịch sử lưu trữ nào.
                  </div>
                ) : (
                  <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border-subtle bg-bg-app/30 text-text-sub font-mono text-[9px] uppercase tracking-wider">
                            <th className="p-4 font-semibold">Khách hàng</th>
                            <th className="p-4 font-semibold">Phòng</th>
                            <th className="p-4 font-semibold">Thời gian ở</th>
                            <th className="p-4 font-semibold">Hình thức</th>
                            <th className="p-4 font-semibold text-right">Tiền phòng</th>
                            <th className="p-4 font-semibold text-right">Tiền F&B</th>
                            <th className="p-4 font-semibold text-right">Tổng cộng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/40 text-text-main">
                          {history.map(stay => (
                            <tr 
                              key={stay.id} 
                              onClick={() => handleOpenHistoryDetail(stay.id)}
                              className="hover:bg-zinc-500/5 cursor-pointer transition"
                            >
                              <td className="p-4 font-bold text-emerald-500 hover:underline">{stay.guest_name}</td>
                              <td className="p-4 font-mono font-bold">{stay.room_number}</td>
                              <td className="p-4 text-[10px] text-text-sub">
                                <div>Nhận: {new Date(stay.check_in_time).toLocaleString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="mt-0.5">Trả: {new Date(stay.check_out_time).toLocaleString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td className="p-4 text-text-sub capitalize">
                                {stay.hourly_or_daily === 'hourly' ? 'Theo giờ' : 'Theo ngày'}
                              </td>
                              <td className="p-4 text-right font-mono font-bold">{stay.base_room_charge.toLocaleString()}đ</td>
                              <td className="p-4 text-right font-mono text-text-sub">{stay.orders_total.toLocaleString()}đ</td>
                              <td className="p-4 text-right font-mono font-bold text-emerald-500">{stay.grand_total.toLocaleString()}đ</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

      </div>

      {/* CHECKIN MODAL */}
      {showCheckinModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/70 modal-backdrop flex items-center justify-center z-30 p-4">
          <div className="modal-panel bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Bed size={18} /> Check-in Phòng {selectedRoom.number}
              </h3>
              <button onClick={() => setShowCheckinModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Tên khách hàng</label>
                <input 
                  type="text"
                  placeholder="Nhập tên khách..."
                  value={checkinForm.guestName}
                  onChange={(e) => setCheckinForm({ ...checkinForm, guestName: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Hình thức tính giá phòng</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => setCheckinForm({ ...checkinForm, hourlyOrDaily: 'daily' })}
                    className={`py-2 rounded-lg text-xs font-semibold border transition ${
                      checkinForm.hourlyOrDaily === 'daily'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Theo ngày ({selectedRoom.price_per_day.toLocaleString()}đ)
                  </button>
                  <button
                    onClick={() => setCheckinForm({ ...checkinForm, hourlyOrDaily: 'hourly' })}
                    className={`py-2 rounded-lg text-xs font-semibold border transition ${
                      checkinForm.hourlyOrDaily === 'hourly'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Theo giờ ({selectedRoom.price_per_hour.toLocaleString()}đ)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2.5">
              <button 
                onClick={() => setShowCheckinModal(false)}
                className="px-4 py-2 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold rounded-lg transition active:scale-95"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={submitCheckin}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95"
              >
                Nhận phòng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT BILL MODAL */}
      {showCheckoutModal && selectedRoom && checkoutPreview && (
        <div className="fixed inset-0 bg-black/70 modal-backdrop flex items-center justify-center z-30 p-4 animate-fade-in">
          <div className="modal-panel bg-bg-card border border-border-subtle w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-5 transition-all duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                <Receipt size={18} className="text-emerald-500" />
                <span>Thanh Toán & Trả Phòng — Phòng {selectedRoom.number}</span>
              </h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-text-sub hover:text-text-main transition active:scale-90">
                <X size={18} />
              </button>
            </div>

            {/* Split Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto max-h-[70vh] pr-1">
              
              {/* Left Column: Bill details */}
              <div className="col-span-12 md:col-span-7 space-y-4">
                <h4 className="text-[10px] font-bold text-text-sub uppercase tracking-wider border-b border-border-subtle pb-1">Chi tiết hóa đơn</h4>
                
                {/* Stay summaries */}
                <div className="grid grid-cols-2 gap-4 bg-bg-app border border-border-subtle p-4 rounded-xl text-xs">
                  <div>
                    <span className="text-text-sub uppercase tracking-widest text-[9px] font-mono">Khách hàng</span>
                    <p className="font-bold text-sm text-text-main mt-0.5">{checkoutPreview.stay.guest_name}</p>
                  </div>
                  <div>
                    <span className="text-text-sub uppercase tracking-widest text-[9px] font-mono">Hình thức tính</span>
                    <p className="font-bold text-sm text-text-main mt-0.5">
                      {checkoutPreview.stay.hourly_or_daily === 'hourly' 
                        ? `Theo giờ (Đã dùng ${checkoutPreview.duration.hours}h)` 
                        : `Theo ngày (Đã dùng ${checkoutPreview.duration.days} ngày)`
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-text-sub uppercase tracking-widest text-[9px] font-mono">Thời điểm vào</span>
                    <p className="font-semibold text-text-main mt-0.5">{new Date(checkoutPreview.check_in_time).toLocaleString('vi-VN')}</p>
                  </div>
                  <div>
                    <span className="text-text-sub uppercase tracking-widest text-[9px] font-mono">Thời điểm ra</span>
                    <p className="font-semibold text-text-main mt-0.5">{new Date(checkoutPreview.check_out_time).toLocaleString('vi-VN')}</p>
                  </div>
                </div>

                {/* Items Breakdown list */}
                <div className="space-y-2.5 text-xs bg-bg-app/40 border border-border-subtle/60 p-4 rounded-xl">
                  {/* Room charge */}
                  {checkoutPreview.tierBreakdown ? (
                    <div className="space-y-1.5 border-b border-border-subtle/60 pb-3">
                      <div className="flex justify-between font-bold text-text-main pb-1">
                        <span>Tiền thuê phòng lũy kế ({checkoutPreview.duration.hours}h)</span>
                        <span className="font-mono">{checkoutPreview.roomCharge.toLocaleString()} đ</span>
                      </div>
                      {checkoutPreview.tierBreakdown.map((t, i) => (
                        <div key={i} className="flex justify-between text-[10px] text-text-sub pl-2">
                          <span>Giờ {t.hour}</span>
                          <span className="font-mono">{t.price.toLocaleString()} đ</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-between py-2 border-b border-border-subtle/60 text-text-main">
                      <span>Tiền thuê phòng ({checkoutPreview.stay.hourly_or_daily === 'hourly' ? `${checkoutPreview.duration.hours} giờ` : `${checkoutPreview.duration.days} ngày`})</span>
                      <span className="font-bold font-mono">{checkoutPreview.roomCharge.toLocaleString()} đ</span>
                    </div>
                  )}

                  {/* Orders billing */}
                  {checkoutPreview.foodDrinkCharge > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between font-bold text-text-main pb-1 border-b border-border-subtle/40">
                        <span>Dịch vụ & Gọi món (F&B)</span>
                        <span className="font-mono">{checkoutPreview.foodDrinkCharge.toLocaleString()} đ</span>
                      </div>
                      {checkoutPreview.orders.map(order => (
                        <div key={order.order_id} className="text-[10px] text-text-sub pl-2 space-y-0.5">
                          {order.items.map(it => (
                            <div key={it.id} className="flex justify-between py-0.5">
                              <span>- {it.name} x{it.quantity}</span>
                              <span>{(it.price * it.quantity).toLocaleString()}đ</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-text-sub italic py-1 text-center">Không phát sinh dịch vụ đồ ăn gọi tại phòng.</div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="flex justify-between items-center bg-bg-card border border-border-subtle p-4 rounded-xl font-bold text-text-main text-sm">
                  <span>TỔNG CẦN THANH TOÁN</span>
                  <span className="text-xl text-emerald-500 font-mono tracking-tight">{checkoutPreview.grandTotal.toLocaleString()} đ</span>
                </div>

                {/* Status Notice */}
                <div className="bg-amber-500/5 border border-amber-500/25 p-3 rounded-xl text-[11px] text-amber-500 flex items-center gap-2">
                  <Warning size={14} />
                  <span>Phòng sẽ chuyển sang trạng thái <strong>Chờ dọn dẹp</strong> sau khi checkout.</span>
                </div>
              </div>

              {/* Right Column: vietqr payment details */}
              <div className="col-span-12 md:col-span-5 flex flex-col justify-center items-center">
                {networkIp.bankAccountNo ? (
                  <div className="w-full bg-bg-app border border-border-subtle p-5 rounded-2xl flex flex-col items-center gap-4 text-center">
                    <span className="text-[10px] font-mono text-text-sub uppercase tracking-wider font-bold">Mã QR Thanh Toán (VietQR)</span>
                    
                    {/* VietQR Bigger Image */}
                    <div className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-md">
                      <img 
                        src={`https://img.vietqr.io/image/${networkIp.bankId}-${networkIp.bankAccountNo}-compact2.png?amount=${checkoutPreview.grandTotal}&addInfo=${encodeURIComponent(`Thanh toan phong ${selectedRoom.number}`)}&accountName=${encodeURIComponent(networkIp.bankAccountName)}`}
                        alt="VietQR Payment"
                        className="w-64 h-64 object-contain animate-fade-in"
                      />
                    </div>
                    
                    {/* Bank Info */}
                    <div className="text-xs text-text-sub font-mono space-y-1">
                      <p>Ngân hàng: <span className="text-text-main font-bold">{networkIp.bankId}</span></p>
                      <p>Số tài khoản: <span className="text-text-main font-semibold">{networkIp.bankAccountNo}</span></p>
                      <p>Chủ tài khoản: <span className="text-text-main uppercase font-semibold">{networkIp.bankAccountName}</span></p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-bg-app border border-border-subtle p-6 rounded-2xl flex flex-col items-center justify-center text-center text-text-sub">
                    <QrCode size={40} className="mb-2 opacity-50" />
                    <p className="text-xs">Chưa cấu hình tài khoản ngân hàng VietQR trong .env</p>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-border-subtle flex justify-end gap-2.5">
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 py-2 border border-border-subtle hover:bg-zinc-500/10 text-text-sub hover:text-text-main text-xs font-semibold rounded-lg transition active:scale-95"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={submitCheckout}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Xác nhận thanh toán & Trả phòng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY DETAIL VIEW MODAL */}
      {showHistoryDetailModal && (
        <div className="fixed inset-0 bg-black/70 modal-backdrop flex items-center justify-center z-30 p-4 animate-fade-in">
          <div className="modal-panel bg-bg-card border border-border-subtle w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-5 transition-all duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                <Receipt size={18} className="text-emerald-500" />
                <span>Chi Tiết Lịch Sử Giao Dịch</span>
              </h3>
              <button 
                onClick={() => setShowHistoryDetailModal(false)} 
                className="text-text-sub hover:text-text-main transition active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            {loadingHistoryDetail ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-sub">
                <Spinner size={24} className="animate-spin text-emerald-500 mb-2" />
                <p className="text-[10px] uppercase tracking-wider font-mono">Đang tải chi tiết lịch sử...</p>
              </div>
            ) : selectedHistoryStay ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto max-h-[65vh] pr-1">
                
                {/* Left Column: Guest & pricing details */}
                <div className="col-span-12 md:col-span-7 space-y-4">
                  {/* Guest and room timing */}
                  <div className="grid grid-cols-2 gap-4 bg-bg-app border border-border-subtle p-4 rounded-xl text-xs">
                    <div>
                      <span className="text-text-sub uppercase tracking-widest text-[9px] font-mono">Khách hàng</span>
                      <p className="font-bold text-sm text-text-main mt-0.5">{selectedHistoryStay.stay.guest_name}</p>
                    </div>
                    <div>
                      <span className="text-text-sub uppercase tracking-widest text-[9px] font-mono">Số phòng</span>
                      <p className="font-bold text-sm text-text-main mt-0.5">Phòng {selectedHistoryStay.stay.room_number}</p>
                    </div>
                    <div>
                      <span className="text-text-sub uppercase tracking-widest text-[9px] font-mono">Thời điểm vào</span>
                      <p className="font-semibold text-text-main mt-0.5">{new Date(selectedHistoryStay.stay.check_in_time).toLocaleString('vi-VN')}</p>
                    </div>
                    <div>
                      <span className="text-text-sub uppercase tracking-widest text-[9px] font-mono">Thời điểm ra</span>
                      <p className="font-semibold text-text-main mt-0.5">{new Date(selectedHistoryStay.stay.check_out_time).toLocaleString('vi-VN')}</p>
                    </div>
                  </div>

                  {/* Pricing break list */}
                  <div className="space-y-2.5 text-xs bg-bg-app/40 border border-border-subtle/60 p-4 rounded-xl">
                    <div className="flex justify-between py-1.5 border-b border-border-subtle/50 text-text-main">
                      <span>Tiền thuê phòng ({selectedHistoryStay.stay.hourly_or_daily === 'hourly' ? 'Theo giờ' : 'Theo ngày'})</span>
                      <span className="font-bold font-mono">{selectedHistoryStay.stay.base_room_charge.toLocaleString()} đ</span>
                    </div>

                    {selectedHistoryStay.orders?.length > 0 ? (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between font-bold text-text-main pb-1 border-b border-border-subtle/40">
                          <span>Dịch vụ & Gọi món (F&B)</span>
                          <span className="font-mono">
                            {selectedHistoryStay.orders.reduce((sum, o) => sum + o.total_price, 0).toLocaleString()} đ
                          </span>
                        </div>
                        {selectedHistoryStay.orders.map(order => (
                          <div key={order.id} className="text-[10px] text-text-sub pl-2 space-y-0.5">
                            {order.items?.map(it => (
                              <div key={it.id} className="flex justify-between py-0.5">
                                <span>- {it.name} x{it.quantity}</span>
                                <span>{(it.price * it.quantity).toLocaleString()}đ</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-text-sub italic py-1 text-center">Không phát sinh dịch vụ đồ ăn gọi tại phòng.</div>
                    )}
                  </div>
                </div>

                {/* Right Column: invoice total and print button */}
                <div className="col-span-12 md:col-span-5 flex flex-col justify-between bg-bg-app border border-border-subtle p-5 rounded-2xl gap-6">
                  <div className="space-y-4 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full">
                      <Check size={24} weight="bold" />
                    </div>
                    <div>
                      <h4 className="font-bold text-text-main text-sm">GIAO DỊCH HOÀN TẤT</h4>
                      <p className="text-[10px] text-text-sub mt-0.5">Đơn hàng đã được thanh toán đầy đủ</p>
                    </div>

                    {/* Total summary board */}
                    <div className="bg-bg-card border border-border-subtle p-4 rounded-xl space-y-1 mt-2 text-left">
                      <span className="text-[9px] text-text-sub uppercase tracking-wider block font-mono">Tổng thực thu</span>
                      <span className="text-2xl font-bold font-mono text-emerald-500 tracking-tight block">
                        {(selectedHistoryStay.stay.base_room_charge + selectedHistoryStay.orders.reduce((sum, o) => sum + o.total_price, 0)).toLocaleString()} đ
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePrintReceipt(selectedHistoryStay)}
                    className="w-full py-2.5 bg-bg-card hover:bg-zinc-500/10 border border-border-subtle text-text-main font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Receipt size={16} />
                    <span>In Hóa Đơn Lịch Sử</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="text-center py-8 text-text-sub text-xs">Không có dữ liệu chi tiết.</div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-border-subtle flex justify-end">
              <button
                onClick={() => setShowHistoryDetailModal(false)}
                className="px-5 py-2 bg-zinc-500/10 hover:bg-zinc-500/20 text-text-main font-bold text-xs rounded-lg transition active:scale-95 cursor-pointer"
              >
                Đóng lại
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD ROOM MODAL */}
      {showAddRoomModal && (
        <div className="fixed inset-0 bg-black/70 modal-backdrop flex items-center justify-center z-30 p-4">
          <div className="modal-panel bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-white">Thêm Phòng Khách Sạn Mới</h3>
              <button onClick={() => setShowAddRoomModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Số phòng</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: 105, VIP204"
                  value={newRoomForm.number}
                  onChange={(e) => setNewRoomForm({ ...newRoomForm, number: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-700"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Loại phòng</label>
                <select
                  value={newRoomForm.type}
                  onChange={(e) => setNewRoomForm({ ...newRoomForm, type: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Phòng Đơn Tiêu Chuẩn">Phòng Đơn Tiêu Chuẩn</option>
                  <option value="Phòng Đôi Tiêu Chuẩn">Phòng Đôi Tiêu Chuẩn</option>
                  <option value="Phòng Đôi Deluxe">Phòng Đôi Deluxe</option>
                  <option value="Phòng VIP Suite">Phòng VIP Suite</option>
                  <option value="Phòng Gia Đình">Phòng Gia Đình</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Giá theo giờ cơ bản (đ)</label>
                  <input 
                    type="number" 
                    value={newRoomForm.pricePerHour}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, pricePerHour: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Giá theo ngày (đ)</label>
                  <input 
                    type="number" 
                    value={newRoomForm.pricePerDay}
                    onChange={(e) => setNewRoomForm({ ...newRoomForm, pricePerDay: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Hourly Tiers Setup */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Bảng giá luĩ kế theo giờ (tùy chọn)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextHour = newRoomForm.hourlyTiers.length + 1;
                      setNewRoomForm(prev => ({
                        ...prev,
                        hourlyTiers: [...prev.hourlyTiers, { hour: nextHour, price: prev.pricePerHour }]
                      }));
                    }}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition"
                  >
                    <Plus size={10} /> Thêm giờ
                  </button>
                </div>

                {newRoomForm.hourlyTiers.length === 0 ? (
                  <p className="text-[10px] text-zinc-600 italic">Chưa cài giá lũy kế. Hệ thống sẽ nhân đều theo giá giờ cơ bản.</p>
                ) : (
                  <div className="space-y-2">
                    {newRoomForm.hourlyTiers.map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 font-mono w-16 flex-shrink-0">
                          {idx + 1 < newRoomForm.hourlyTiers.length ? `Giờ ${tier.hour}` : `Giờ ${tier.hour}+`}
                        </span>
                        <input
                          type="number"
                          value={tier.price}
                          onChange={(e) => {
                            const updated = [...newRoomForm.hourlyTiers];
                            updated[idx] = { ...updated[idx], price: parseInt(e.target.value) || 0 };
                            setNewRoomForm(prev => ({ ...prev, hourlyTiers: updated }));
                          }}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                          placeholder="Nhập giá..."
                        />
                        <span className="text-[10px] text-zinc-500">đ</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newRoomForm.hourlyTiers.filter((_, i) => i !== idx)
                              .map((t, i) => ({ ...t, hour: i + 1 }));
                            setNewRoomForm(prev => ({ ...prev, hourlyTiers: updated }));
                          }}
                          className="text-zinc-600 hover:text-rose-500 transition p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <p className="text-[10px] text-zinc-600 italic mt-1">
                      Giờ cuối cùng (+) sẽ áp dụng cho tất cả các giờ vượt quá mức này.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2.5">
              <button 
                onClick={() => setShowAddRoomModal(false)}
                className="px-4 py-2 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-lg transition active:scale-95"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={addRoom}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95"
              >
                Tạo phòng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MENU ITEM MODAL */}
      {showAddMenuModal && (
        <div className="fixed inset-0 bg-black/70 modal-backdrop flex items-center justify-center z-30 p-4">
          <div className="modal-panel bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-white">Thêm Món Mới Vào Thực Đơn</h3>
              <button onClick={() => setShowAddMenuModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Tên món</label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Phở bò đặc biệt, Nước chanh"
                  value={newMenuForm.name}
                  onChange={(e) => setNewMenuForm({ ...newMenuForm, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Phân loại</label>
                  <select
                    value={newMenuForm.category}
                    onChange={(e) => setNewMenuForm({ ...newMenuForm, category: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="food">Đồ ăn</option>
                    <option value="drink">Đồ uống</option>
                    <option value="service">Dịch vụ</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Đơn giá (đ)</label>
                  <input 
                    type="number" 
                    value={newMenuForm.price}
                    onChange={(e) => setNewMenuForm({ ...newMenuForm, price: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Ảnh URL minh họa (Tùy chọn)</label>
                <input 
                  type="text" 
                  placeholder="https://images.unsplash.com/..."
                  value={newMenuForm.imageUrl}
                  onChange={(e) => setNewMenuForm({ ...newMenuForm, imageUrl: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-750"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2.5">
              <button 
                onClick={() => setShowAddMenuModal(false)}
                className="px-4 py-2 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-lg transition active:scale-95"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={addMenuItem}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95"
              >
                Tạo món
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-bg-card border border-border-subtle rounded-2xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden animate-scale-in">
            {/* Red top border accent */}
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-rose-500" />
            
            <div className="flex gap-4">
              <div className="p-2 rounded-full bg-rose-500/10 text-rose-500 h-10 w-10 flex items-center justify-center flex-shrink-0">
                <Warning size={20} weight="bold" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-text-main">Xác nhận xóa bỏ</h3>
                <p className="text-xs text-text-sub leading-relaxed">
                  {deleteConfirm.type === 'menu' ? (
                    <>Bạn có chắc chắn muốn xóa món ăn <strong className="text-text-main font-bold">"{deleteConfirm.item?.name}"</strong> khỏi thực đơn? Hành động này sẽ ẩn món ăn khỏi thực đơn gọi món của khách.</>
                  ) : (
                    <>Bạn có chắc chắn muốn xóa <strong className="text-text-main font-bold">"Phòng {deleteConfirm.item?.number}"</strong>? Mọi dữ liệu về cấu hình và lượt ở của phòng sẽ bị ảnh hưởng.</>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button 
                onClick={() => setDeleteConfirm({ show: false, type: '', item: null })}
                className="px-4 py-2 bg-zinc-500/10 hover:bg-zinc-500/15 border border-border-subtle text-text-sub hover:text-text-main text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={executeDelete}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition active:scale-95 shadow-md shadow-rose-500/10 cursor-pointer"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
