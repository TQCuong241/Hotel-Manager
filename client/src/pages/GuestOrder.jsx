import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Coffee, 
  CookingPot, 
  HandWaving, 
  ShoppingCart, 
  Notebook, 
  CheckCircle, 
  Clock, 
  ArrowLeft, 
  Plus, 
  Minus,
  Warning
} from '@phosphor-icons/react';

// Get current server base URL (handles running on different IP addresses)
const getBaseUrl = () => {
  const { protocol, hostname } = window.location;
  // If running in Vite dev mode, default to backend port 5000
  const port = window.location.port === '5173' ? '5000' : window.location.port;
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
};

const BASE_URL = getBaseUrl();

function AnimatedOrderButton({ onClick, submitting }) {
  const [btnState, setBtnState] = useState('idle'); // idle, compress, animating, success
  const [showConfetti, setShowConfetti] = useState(false);

  const handlePress = () => {
    if (btnState !== 'idle') return;
    setBtnState('compress');
    
    // Animate compress -> active animation
    setTimeout(() => {
      setBtnState('animating');
      setShowConfetti(false);
      
      // Trigger actual order network submission
      onClick();

      // Trigger landing feedback (confetti dust) when box hits truck bed at 600ms
      setTimeout(() => {
        setShowConfetti(true);
      }, 600);

      // Finish delivery drive cycle at 2200ms
      setTimeout(() => {
        setBtnState('success');
      }, 2200);

    }, 120); // 120ms press feeling
  };

  useEffect(() => {
    if (btnState === 'success') {
      const timer = setTimeout(() => {
        setBtnState('idle');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [btnState]);

  return (
    <div className="w-full relative overflow-hidden select-none">
      {btnState === 'idle' && (
        <button
          onClick={handlePress}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-500/20 transform hover:scale-[1.03] transition-all duration-200 active:scale-[0.92] flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle size={18} weight="bold" />
          <span>Xác nhận Đặt món</span>
        </button>
      )}

      {btnState === 'compress' && (
        <button
          className="w-full py-4 bg-emerald-600/90 text-white font-bold rounded-xl transform scale-[0.92] transition-all duration-100 flex items-center justify-center gap-2"
        >
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Đang xử lý...</span>
        </button>
      )}

      {btnState === 'animating' && (
        <div className="w-full h-14 bg-zinc-100 dark:bg-zinc-800 rounded-xl relative overflow-hidden flex items-center justify-center border border-zinc-200/50 shadow-inner">
          {/* Road lane line */}
          <div className="absolute inset-x-0 h-[1.5px] border-t border-dashed border-zinc-300 dark:border-zinc-700 top-[38px] z-0"></div>

          {/* Animation Stage */}
          <div className="absolute inset-0 flex items-center z-10">
            {/* Delivery Cart */}
            <div className="absolute left-1/2 top-[8px] -translate-x-1/2 animate-cart-drive flex flex-col items-center">
              <div className="relative animate-cart-bounce flex flex-col items-center">
                
                {/* Nested Falling Package */}
                <div className="absolute top-[6px] z-20">
                  <div className="animate-parcel-fall relative">
                    {/* Cute box */}
                    <div className="w-[18px] h-[16px] bg-amber-700/80 border border-amber-800 rounded-sm relative flex flex-col items-center shadow-md">
                      {/* Packing tape */}
                      <div className="w-[4px] h-full bg-amber-900/60"></div>
                    </div>

                    {/* Impact Confetti Particles */}
                    {showConfetti && (
                      <div className="absolute -inset-2 pointer-events-none">
                        <span className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-full animate-particle-1 left-2.5 top-2"></span>
                        <span className="absolute w-1 h-1 bg-emerald-400 rounded-full animate-particle-2 left-2.5 top-2"></span>
                        <span className="absolute w-1.5 h-1.5 bg-red-400 rounded-full animate-particle-3 left-2.5 top-2"></span>
                        <span className="absolute w-1 h-1 bg-blue-400 rounded-full animate-particle-4 left-2.5 top-2"></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cute Shopping Cart Icon */}
                <div className="w-[36px] h-[24px] flex items-center justify-center relative z-10">
                  {/* Landing Shadow inside the cart basket */}
                  <div className="absolute w-[18px] h-[2px] bg-black/20 bottom-1 rounded-full animate-shadow-scale"></div>
                  
                  <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 2.5h3l2.5 10.5h10.5l1.8-7.5H6" />
                  </svg>
                </div>

                {/* Wheels */}
                <div className="flex justify-between w-[28px] px-1 mt-[-2px] relative z-10">
                  <div className="w-[8px] h-[8px] bg-zinc-900 rounded-full border border-white dark:border-zinc-800 flex items-center justify-center animate-wheel-spin shadow-sm">
                    <div className="w-[2.5px] h-[2.5px] bg-zinc-400 rounded-full"></div>
                  </div>
                  <div className="w-[8px] h-[8px] bg-zinc-900 rounded-full border border-white dark:border-zinc-800 flex items-center justify-center animate-wheel-spin shadow-sm">
                    <div className="w-[2.5px] h-[2.5px] bg-zinc-400 rounded-full"></div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {btnState === 'success' && (
        <button
          className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transform scale-100 transition-all duration-300 animate-ripple"
        >
          {/* Animated checkmark svg */}
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path className="animate-checkmark-draw" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-bold">Đã Đặt Món! ✅</span>
        </button>
      )}
    </div>
  );
}

export default function GuestOrder({ secureRoomId }) {
  const [roomNumber, setRoomNumber] = useState('');
  const [roomToken, setRoomToken] = useState('');
  const [loadingRoom, setLoadingRoom] = useState(true);

  const [hotelName, setHotelName] = useState('SRC Luxury Hotel');

  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState({}); // { itemId: { quantity, notes, item } }
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [socket, setSocket] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Custom styled alert modal state
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'success', message: '' });
  const triggerAlert = (message, type = 'success') => setAlertModal({ isOpen: true, message, type });

  // 1. Fetch Room details by secureRoomId on mount
  useEffect(() => {
    const getRoomDetails = async () => {
      try {
        setLoadingRoom(true);
        // Fetch network ip details for hotelName branding
        try {
          const configRes = await fetch(`${BASE_URL}/api/network-ip`);
          if (configRes.ok) {
            const configData = await configRes.json();
            if (configData.hotelName) {
              setHotelName(configData.hotelName);
            }
          }
        } catch (e) {
          console.warn('Failed to fetch config:', e);
        }

        const res = await fetch(`${BASE_URL}/api/rooms/by-secure-id/${secureRoomId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Mã phòng không hợp lệ hoặc đã hết hạn.');
        }
        const data = await res.json();
        setRoomNumber(data.number);
        setRoomToken(data.token);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingRoom(false);
      }
    };
    if (secureRoomId) {
      getRoomDetails();
    }
  }, [secureRoomId]);

  // 2. Fetch Menu and Setup Socket when roomNumber is resolved
  useEffect(() => {
    if (!roomNumber) return;

    fetchMenu();
    fetchActiveOrders();

    // Setup Socket
    const newSocket = io(BASE_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', roomNumber);
    });

    newSocket.on('room_order_updated', (updatedOrder) => {
      setActiveOrders(prev => {
        const index = prev.findIndex(o => o.id === updatedOrder.id);
        if (index > -1) {
          const newOrders = [...prev];
          newOrders[index] = updatedOrder;
          return newOrders;
        } else {
          return [updatedOrder, ...prev];
        }
      });
    });

    newSocket.on('order_updated', (updatedOrder) => {
      // General backup in case room joining has delays
      if (String(updatedOrder.room_number) === String(roomNumber)) {
        setActiveOrders(prev => {
          const index = prev.findIndex(o => o.id === updatedOrder.id);
          if (index > -1) {
            const newOrders = [...prev];
            newOrders[index] = updatedOrder;
            return newOrders;
          }
          return prev;
        });
      }
    });

    return () => {
      newSocket.close();
    };
  }, [roomNumber]);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/api/menu`);
      if (!res.ok) throw new Error('Không thể tải thực đơn. Vui lòng thử lại.');
      const data = await res.json();
      setMenuItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveOrders = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/orders`);
      if (res.ok) {
        const data = await res.json();
        // Filter only active orders for this specific room
        const roomOrders = data.filter(order => 
          String(order.room_number) === String(roomNumber) && 
          order.status !== 'completed' && 
          order.status !== 'cancelled'
        );
        setActiveOrders(roomOrders);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  };

  // Cart operations
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          quantity: existing ? existing.quantity + 1 : 1,
          notes: existing ? existing.notes : '',
          item
        }
      };
    });
  };

  const updateQuantity = (itemId, delta) => {
    setCart(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, quantity: newQty }
      };
    });
  };

  const updateNotes = (itemId, notes) => {
    setCart(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      return {
        ...prev,
        [itemId]: { ...existing, notes }
      };
    });
  };

  const getCartCount = () => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  };

  const getCartTotal = () => {
    return Object.values(cart).reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);
  };

  const submitOrder = async () => {
    if (Object.keys(cart).length === 0) return;
    setSubmitting(true);
    try {
      const orderItems = Object.entries(cart).map(([itemId, entry]) => ({
        menu_item_id: parseInt(itemId),
        quantity: entry.quantity,
        notes: entry.notes
      }));

      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_number: roomNumber,
          token: roomToken,
          items: orderItems
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gửi đơn hàng thất bại.');
      }

      // Delay modal opening to let the gorgeous button microinteraction complete first
      setTimeout(() => {
        setCart({});
        setIsCartOpen(false);
        fetchActiveOrders();
        triggerAlert('Đơn hàng của bạn đã được gửi tới lễ tân!', 'success');
      }, 2200);
    } catch (err) {
      setTimeout(() => {
        triggerAlert(err.message, 'error');
      }, 2200);
    } finally {
      setSubmitting(false);
    }
  };

  // Request Service (Quick actions)
  const requestQuickService = async (serviceName) => {
    if (!window.confirm(`Bạn muốn yêu cầu ${serviceName} đến phòng ${roomNumber}?`)) return;
    try {
      // Find the service item in menu
      const serviceItem = menuItems.find(item => item.name.toLowerCase().includes(serviceName.toLowerCase()) || (item.category === 'service' && item.name.includes(serviceName)));
      
      let itemId;
      if (serviceItem) {
        itemId = serviceItem.id;
      } else {
        // Fallback or create customized service order if not found in db
        triggerAlert('Dịch vụ này hiện tại không có sẵn. Vui lòng liên hệ trực tiếp lễ tân.', 'error');
        return;
      }

      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_number: roomNumber,
          token: roomToken,
          items: [{ menu_item_id: itemId, quantity: 1, notes: 'Yêu cầu nhanh' }]
        })
      });

      if (res.ok) {
        fetchActiveOrders();
        triggerAlert('Yêu cầu dịch vụ đã được gửi! Lễ tân sẽ hỗ trợ bạn ngay.', 'success');
      } else {
        throw new Error('Không thể gửi yêu cầu.');
      }
    } catch (err) {
      setTimeout(() => {
        triggerAlert(err.message, 'error');
      }, 2000);
    }
  };


  const filteredMenu = menuItems.filter(item => {
    if (category === 'all') return true;
    return item.category === category;
  });

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Đợi xác nhận';
      case 'confirmed': return 'Đang chuẩn bị';
      case 'completed': return 'Đã giao';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-zinc-100 text-zinc-800';
    }
  };

  if (loadingRoom || loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-50 text-zinc-500">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium">Đang tải thông tin và thực đơn...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-50 p-6 text-center">
        <Warning size={48} className="text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Đã xảy ra lỗi</h2>
        <p className="text-zinc-600 mb-6 max-w-sm">{error}</p>
        <button 
          onClick={fetchMenu}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition active:scale-98"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-50 text-zinc-900 pb-28 font-sans max-w-md mx-auto shadow-xl relative border-x border-zinc-200 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-zinc-100 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <span className="brand-rainbow-title block mb-0.5">{hotelName}</span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Phòng {roomNumber}</h1>
        </div>
        
        {/* Active orders count badge */}
        <button 
          onClick={() => {
            const ordersSection = document.getElementById('active-orders');
            if (ordersSection) {
              ordersSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-full text-xs font-semibold text-zinc-700 transition active:scale-95"
        >
          <Clock size={14} className="text-zinc-500" />
          <span>Lịch sử ({activeOrders.length})</span>
        </button>
      </header>

      {/* Hero Banner */}
      <div className="bg-zinc-900 text-white px-6 py-8 flex flex-col justify-end min-h-[120px] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80')] bg-cover bg-center opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent"></div>
        <div className="relative z-1">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Chào mừng Quý khách</p>
          <p className="text-sm text-zinc-300">Quét mã gọi món, giao hàng trực tiếp tận phòng hoàn toàn miễn phí.</p>
        </div>
      </div>

      {/* Quick Services */}
      <section className="px-6 py-6 bg-white border-b border-zinc-100">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Dịch vụ yêu cầu nhanh</h2>
        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={() => requestQuickService('Giặt ủi')}
            className="flex flex-col items-center justify-center p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-200/50 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-2">
              <CookingPot size={20} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-700">Dịch vụ dọn phòng</span>
          </button>
          <button 
            onClick={() => requestQuickService('Thêm gối')}
            className="flex flex-col items-center justify-center p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-200/50 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-2">
              <Coffee size={20} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-700">Thêm gối/nệm</span>
          </button>
          <button 
            onClick={() => {
              if (window.confirm('Bạn muốn gửi yêu cầu nhân viên hỗ trợ trực tiếp đến phòng?')) {
                requestQuickService('Giặt ủi'); // Can route to custom alert in real deployment
              }
            }}
            className="flex flex-col items-center justify-center p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-200/50 transition active:scale-95"
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-2">
              <HandWaving size={20} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-700">Gọi nhân viên</span>
          </button>
        </div>
      </section>

      {/* Menu Categories */}
      <div className="sticky top-[69px] bg-white border-b border-zinc-100 z-10 flex gap-2 px-6 py-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setCategory('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            category === 'all' 
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20' 
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setCategory('food')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            category === 'food' 
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20' 
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Đồ ăn
        </button>
        <button
          onClick={() => setCategory('drink')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            category === 'drink' 
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20' 
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Đồ uống
        </button>
        <button
          onClick={() => setCategory('service')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            category === 'service' 
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20' 
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          }`}
        >
          Dịch vụ khác
        </button>
      </div>

      {/* Menu Items List */}
      <section className="px-6 py-6 flex-grow">
        {filteredMenu.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-sm">
            Hiện tại chưa có món ăn nào trong danh mục này.
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredMenu.map(item => (
              <div 
                key={item.id} 
                className={`flex gap-4 p-3 bg-white rounded-xl border border-zinc-200/50 shadow-sm transition ${
                  !item.is_available ? 'opacity-65' : ''
                }`}
              >
                {item.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.name}
                    className="w-20 h-20 rounded-lg object-cover bg-zinc-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 flex-shrink-0">
                    <CookingPot size={28} />
                  </div>
                )}

                <div className="flex flex-col justify-between flex-grow min-w-0">
                  <div>
                    <h3 className="font-bold text-zinc-900 leading-tight truncate">{item.name}</h3>
                    <p className="text-[10px] text-zinc-400 capitalize mt-0.5">
                      {item.category === 'food' ? 'Đồ ăn' : item.category === 'drink' ? 'Thức uống' : 'Dịch vụ'}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-sm text-zinc-900">
                      {item.price.toLocaleString('vi-VN')} đ
                    </span>
                    
                    {item.is_available ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg transition active:scale-90"
                      >
                        <Plus size={16} weight="bold" />
                      </button>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-400 rounded-md font-medium">
                        Hết hàng
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Orders Tracker */}
      {activeOrders.length > 0 && (
        <section id="active-orders" className="bg-white border-t border-zinc-200 px-6 py-6 scroll-mt-20">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Đơn hàng đang xử lý ({activeOrders.length})</h2>
          <div className="grid gap-4">
            {activeOrders.map(order => (
              <div key={order.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-2">
                  <div>
                    <span className="text-xs font-bold text-zinc-800">Đơn hàng #{order.id}</span>
                    <span className="text-[10px] text-zinc-400 block">
                      {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>

                <div className="text-xs text-zinc-600 mb-2">
                  {order.items?.map(item => (
                    <div key={item.id} className="flex justify-between py-0.5">
                      <span>{item.name} <span className="text-[10px] text-zinc-400">x{item.quantity}</span></span>
                      <span>{(item.price * item.quantity).toLocaleString('vi-VN')} đ</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between border-t border-zinc-200/50 pt-2 text-xs font-bold text-zinc-900">
                  <span>Tổng tiền</span>
                  <span>{order.total_price.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cart Quick Footer trigger */}
      {getCartCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-zinc-200 px-6 py-4 shadow-xl z-20 flex gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 relative">
              <ShoppingCart size={24} />
              <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white">
                {getCartCount()}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-400">Tạm tính</p>
              <p className="font-bold text-zinc-900 text-base">{getCartTotal().toLocaleString('vi-VN')} đ</p>
            </div>
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition active:scale-95"
          >
            Xem giỏ hàng
          </button>
        </div>
      )}

      {/* Cart Sheet Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] animate-slide-up">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 text-zinc-500 hover:bg-zinc-100 rounded-lg transition"
                >
                  <ArrowLeft size={20} />
                </button>
                <h3 className="font-bold text-lg text-zinc-900">Chi tiết giỏ hàng</h3>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
                {getCartCount()} món
              </span>
            </div>

            <div className="overflow-y-auto flex-grow pr-1 mb-6 space-y-4">
              {Object.entries(cart).map(([itemId, entry]) => (
                <div key={itemId} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/50 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 leading-tight">{entry.item.name}</h4>
                      <p className="text-xs font-semibold text-zinc-500 mt-1">
                        {entry.item.price.toLocaleString('vi-VN')} đ
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 bg-white border border-zinc-200 px-2.5 py-1 rounded-lg">
                      <button 
                        onClick={() => updateQuantity(itemId, -1)}
                        className="text-zinc-500 hover:text-zinc-900 transition"
                      >
                        <Minus size={12} weight="bold" />
                      </button>
                      <span className="text-xs font-bold text-zinc-800 min-w-[12px] text-center">{entry.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(itemId, 1)}
                        className="text-zinc-500 hover:text-zinc-900 transition"
                      >
                        <Plus size={12} weight="bold" />
                      </button>
                    </div>
                  </div>

                  {/* Note field */}
                  <div className="flex items-center gap-1.5 bg-white border border-zinc-200/50 rounded-lg px-2 py-1">
                    <Notebook size={14} className="text-zinc-400" />
                    <input 
                      type="text" 
                      placeholder="Ghi chú món ăn... (ví dụ: ít ngọt)" 
                      value={entry.notes}
                      onChange={(e) => updateNotes(itemId, e.target.value)}
                      className="text-xs text-zinc-700 w-full focus:outline-none placeholder-zinc-300"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-100 pt-4 mt-auto">
              <div className="flex justify-between text-zinc-900 mb-4">
                <span className="font-medium text-sm">Tổng cộng</span>
                <span className="font-bold text-lg text-zinc-900">
                  {getCartTotal().toLocaleString('vi-VN')} đ
                </span>
              </div>

              <AnimatedOrderButton
                onClick={submitOrder}
                submitting={submitting}
              />
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT MODAL */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl text-center space-y-4 transform scale-100 transition-all duration-200">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${
              alertModal.type === 'success' 
                ? 'bg-emerald-100 text-emerald-600' 
                : 'bg-rose-100 text-rose-600'
            }`}>
              {alertModal.type === 'success' ? (
                <CheckCircle size={32} weight="fill" />
              ) : (
                <Warning size={32} weight="fill" />
              )}
            </div>
            
            <div className="space-y-1">
              <h3 className="font-bold text-zinc-950 text-base">
                {alertModal.type === 'success' ? 'Thành công!' : 'Thông báo'}
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                {alertModal.message}
              </p>
            </div>

            <button
              onClick={() => setAlertModal({ isOpen: false, type: 'success', message: '' })}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer"
            >
              Đồng ý
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
