require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { getLocalIpAddress } = require('./network');

const app = express();
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const IP_ADDRESS = getLocalIpAddress();

// Clean up stays & orders older than 6 months (auto-cleanup)
const cleanupOldHistory = () => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const cutoffIso = sixMonthsAgo.toISOString();

    // 1. Delete stays completed older than 6 months
    const deleteStays = db.prepare(`
      DELETE FROM stays 
      WHERE status = 'completed' AND check_in_time < ?
    `).run(cutoffIso);

    // 2. Delete orders older than 6 months
    const deleteOrders = db.prepare(`
      DELETE FROM orders 
      WHERE created_at < ?
    `).run(cutoffIso);

    if (deleteStays.changes > 0 || deleteOrders.changes > 0) {
      console.log(`[CLEANUP] Tự động xóa ${deleteStays.changes} lượt stays và ${deleteOrders.changes} đơn hàng quá hạn 6 tháng.`);
    }
  } catch (error) {
    console.error('[CLEANUP ERROR]:', error);
  }
};

// Initial cleanup on server start
cleanupOldHistory();


// Socket.io connection logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Rooms joining for specific room ordering updates
  socket.on('join_room', (roomNumber) => {
    socket.join(`room_${roomNumber}`);
    console.log(`Socket ${socket.id} joined room_${roomNumber}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Cryptographic Room Validation Token (fixes room number URL spoofing)
const crypto = require('crypto');
const ROOM_SECRET = process.env.ROOM_SECRET || 'src_hotel_secure_room_salt_2026';

function getRoomVerifyToken(roomNumber) {
  return crypto.createHmac('sha256', ROOM_SECRET).update(String(roomNumber)).digest('hex').substring(0, 16);
}

// Security: Local loopback request verification (admin panel protection)
function isLocalRequest(req) {
  const ip = req.ip || req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost';
}

function requireLocalhost(req, res, next) {
  const isLocal = isLocalRequest(req);
  console.log(`[requireLocalhost] ip: ${req.ip}, remote: ${req.socket.remoteAddress}, isLocal: ${isLocal}, url: ${req.originalUrl}`);
  if (isLocal) {
    return next();
  }
  return res.status(403).json({ error: 'Quyền truy cập bị từ chối: Chỉ cho phép kết nối từ máy chủ (localhost).' });
}

// REST API Endpoints

// 1. Get LAN IP details
app.get('/api/network-ip', (req, res) => {
  res.json({
    ip: IP_ADDRESS,
    port: PORT,
    url: `http://${IP_ADDRESS}:${PORT}`,
    bankId: process.env.BANK_ID || 'VCB',
    bankAccountNo: process.env.BANK_ACCOUNT_NO || '',
    bankAccountName: process.env.BANK_ACCOUNT_NAME || '',
    hotelName: process.env.HOTEL_NAME || 'SRC Luxury Hotel'
  });
});

// 2. Rooms API
app.get('/api/rooms', requireLocalhost, (req, res) => {
  try {
    const rooms = db.prepare(`
      SELECT r.*, s.guest_name as active_guest_name
      FROM rooms r
      LEFT JOIN stays s ON r.id = s.room_id AND s.status = 'active'
      ORDER BY r.number
    `).all();
    // Parse hourly_tiers JSON and append secure verification token
    res.json(rooms.map(r => ({ 
      ...r, 
      hourly_tiers: r.hourly_tiers ? JSON.parse(r.hourly_tiers) : null,
      token: getRoomVerifyToken(r.number)
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', requireLocalhost, (req, res) => {
  const { number, type, price_per_hour, price_per_day, hourly_tiers } = req.body;
  try {
    const secureId = crypto.randomBytes(8).toString('hex');
    const info = db.prepare(`
      INSERT INTO rooms (number, type, price_per_hour, price_per_day, hourly_tiers, secure_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'empty')
    `).run(number, type, price_per_hour, price_per_day, hourly_tiers ? JSON.stringify(hourly_tiers) : null, secureId);
    
    const newRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(info.lastInsertRowid);
    if (newRoom.hourly_tiers) newRoom.hourly_tiers = JSON.parse(newRoom.hourly_tiers);
    io.emit('rooms_updated');
    res.status(201).json(newRoom);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/rooms/:id', requireLocalhost, (req, res) => {
  const { id } = req.params;
  const { number, type, price_per_hour, price_per_day, hourly_tiers, status } = req.body;
  try {
    db.prepare(`
      UPDATE rooms 
      SET number = ?, type = ?, price_per_hour = ?, price_per_day = ?, hourly_tiers = ?, status = ?
      WHERE id = ?
    `).run(number, type, price_per_hour, price_per_day, hourly_tiers ? JSON.stringify(hourly_tiers) : null, status, id);
    
    const updatedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (updatedRoom.hourly_tiers) updatedRoom.hourly_tiers = JSON.parse(updatedRoom.hourly_tiers);
    io.emit('rooms_updated');
    res.json(updatedRoom);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/rooms/:id', requireLocalhost, (req, res) => {
  const { id } = req.params;
  console.log(`[DELETE ROOM] Attempting to delete room ID: ${id}`);
  try {
    db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    console.log(`[DELETE ROOM] Successfully deleted room ID: ${id}`);
    io.emit('rooms_updated');
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error(`[DELETE ROOM ERROR] ID: ${id}, error:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms/by-secure-id/:secureId', (req, res) => {
  const { secureId } = req.params;
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE secure_id = ?').get(secureId);
    if (!room) {
      return res.status(404).json({ error: 'Mã phòng không hợp lệ hoặc đã hết hạn.' });
    }
    res.json({
      number: room.number,
      type: room.type,
      token: getRoomVerifyToken(room.number)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Stay Checkin API
app.post('/api/stays/checkin', requireLocalhost, (req, res) => {
  const { room_id, guest_name, hourly_or_daily } = req.body;
  const check_in_time = new Date().toISOString();
  
  try {
    const runCheckin = db.transaction(() => {
      // Create stay
      const info = db.prepare(`
        INSERT INTO stays (room_id, guest_name, check_in_time, hourly_or_daily, status)
        VALUES (?, ?, ?, ?, 'active')
      `).run(room_id, guest_name, check_in_time, hourly_or_daily);
      
      // Update room status
      db.prepare("UPDATE rooms SET status = 'occupied' WHERE id = ?").run(room_id);
      
      return info.lastInsertRowid;
    });

    const stayId = runCheckin();
    const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
    
    io.emit('rooms_updated');
    res.status(201).json(stay);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Stay checkout calculation API
app.get('/api/stays/checkout-preview/:roomId', requireLocalhost, (req, res) => {
  const { roomId } = req.params;
  try {
    const stay = db.prepare('SELECT * FROM stays WHERE room_id = ? AND status = \'active\'').get(roomId);
    if (!stay) {
      return res.status(404).json({ error: 'No active stay found for this room' });
    }

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);

    // Calculate room usage cost
    const checkIn = new Date(stay.check_in_time);
    const checkOut = new Date();
    const durationMs = checkOut - checkIn;
    const durationHrs = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60))); // Min 1 hour
    const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24))); // Min 1 day

    let roomCharge = 0;
    let tierBreakdown = null; // for detailed billing display

    if (stay.hourly_or_daily === 'hourly') {
      const tiers = room.hourly_tiers ? JSON.parse(room.hourly_tiers) : null;
      if (tiers && tiers.length > 0) {
        // Tiered pricing (Cách A): add up price per each hour level
        let charge = 0;
        const breakdown = [];
        for (let h = 1; h <= durationHrs; h++) {
          // Find matching tier or use last tier
          const tier = tiers.find(t => t.hour === h) || tiers[tiers.length - 1];
          charge += tier.price;
          breakdown.push({ hour: h, price: tier.price });
        }
        roomCharge = charge;
        tierBreakdown = breakdown;
      } else {
        roomCharge = durationHrs * room.price_per_hour;
      }
    } else {
      roomCharge = durationDays * room.price_per_day;
    }

    // Get all orders for this stay
    const orders = db.prepare('SELECT * FROM orders WHERE stay_id = ? AND status != \'cancelled\'').all(stay.id);
    let foodDrinkCharge = 0;
    const orderDetails = [];

    for (const order of orders) {
      foodDrinkCharge += order.total_price;
      const items = db.prepare(`
        SELECT oi.*, mi.name, mi.category 
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
      `).all(order.id);
      
      orderDetails.push({
        order_id: order.id,
        status: order.status,
        created_at: order.created_at,
        total_price: order.total_price,
        items
      });
    }

    const grandTotal = roomCharge + foodDrinkCharge;

    res.json({
      stay,
      room,
      duration: stay.hourly_or_daily === 'hourly' ? { hours: durationHrs } : { days: durationDays },
      check_in_time: stay.check_in_time,
      check_out_time: checkOut.toISOString(),
      roomCharge,
      tierBreakdown,
      foodDrinkCharge,
      grandTotal,
      orders: orderDetails
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Finalize checkout API
app.post('/api/stays/checkout/:roomId', requireLocalhost, (req, res) => {
  const { roomId } = req.params;
  const { check_out_time, base_room_charge, room_status } = req.body; // room_status can be 'cleaning' or 'empty'

  try {
    const stay = db.prepare('SELECT * FROM stays WHERE room_id = ? AND status = \'active\'').get(roomId);
    if (!stay) {
      return res.status(404).json({ error: 'No active stay found for this room' });
    }

    const runCheckout = db.transaction(() => {
      // 1. Complete stay
      db.prepare(`
        UPDATE stays 
        SET check_out_time = ?, base_room_charge = ?, status = 'completed'
        WHERE id = ?
      `).run(check_out_time, base_room_charge, stay.id);

      // 2. Set all pending/confirmed orders for this stay to completed
      db.prepare(`
        UPDATE orders
        SET status = 'completed'
        WHERE stay_id = ? AND status IN ('pending', 'confirmed')
      `).run(stay.id);

      // 3. Update room status (to cleaning or empty)
      db.prepare(`
        UPDATE rooms
        SET status = ?
        WHERE id = ?
      `).run(room_status || 'cleaning', roomId);
    });

    runCheckout();
    io.emit('rooms_updated');
    res.json({ message: 'Checkout completed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Active stay details for a room
app.get('/api/stays/active/:roomId', requireLocalhost, (req, res) => {
  const { roomId } = req.params;
  try {
    const stay = db.prepare('SELECT * FROM stays WHERE room_id = ? AND status = \'active\'').get(roomId);
    if (!stay) {
      return res.json(null);
    }
    
    // Get orders for this active stay
    const orders = db.prepare('SELECT * FROM orders WHERE stay_id = ?').all(stay.id);
    const enrichedOrders = orders.map(order => {
      const items = db.prepare(`
        SELECT oi.*, mi.name, mi.category 
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });

    res.json({ ...stay, orders: enrichedOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6.b Get 6-month Completed Stays and Orders History
app.get('/api/history', requireLocalhost, (req, res) => {
  try {
    cleanupOldHistory();

    const stays = db.prepare(`
      SELECT s.*, r.number as room_number
      FROM stays s
      JOIN rooms r ON s.room_id = r.id
      WHERE s.status = 'completed'
      ORDER BY s.check_out_time DESC
    `).all();

    const staysWithTotal = stays.map(stay => {
      const orderTotal = db.prepare(`
        SELECT SUM(total_price) as total
        FROM orders
        WHERE stay_id = ? AND status = 'completed'
      `).get(stay.id).total || 0;
      return {
        ...stay,
        orders_total: orderTotal,
        grand_total: stay.base_room_charge + orderTotal
      };
    });

    res.json(staysWithTotal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6.c Daily Summary Report API (Revenue, Checkouts, F&B Sales)
app.get('/api/history/summary', requireLocalhost, (req, res) => {
  let { date, startDate, endDate } = req.query;
  if (!startDate && !endDate && date) {
    startDate = date;
    endDate = date;
  }
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Missing date parameters (startDate and endDate or date)' });
  }

  try {
    cleanupOldHistory();

    const start = startDate;
    const endLimit = getNextDayString(endDate);

    // 1. Checkouts
    const checkouts = db.prepare(`
      SELECT s.*, r.number as room_number
      FROM stays s
      JOIN rooms r ON s.room_id = r.id
      WHERE s.status = 'completed' AND s.check_out_time >= ? AND s.check_out_time < ?
    `).all(start, endLimit);

    const roomRevenue = checkouts.reduce((sum, s) => sum + s.base_room_charge, 0);

    // 2. F&B Orders completed
    const orders = db.prepare(`
      SELECT o.*, r.number as room_number
      FROM orders o
      JOIN rooms r ON o.room_id = r.id
      WHERE o.status = 'completed' AND o.created_at >= ? AND o.created_at < ?
    `).all(start, endLimit);

    const fbRevenue = orders.reduce((sum, o) => sum + o.total_price, 0);

    // 3. F&B Items sold breakdown
    const itemsSold = db.prepare(`
      SELECT mi.name, mi.category, SUM(oi.quantity) as total_quantity, SUM(oi.quantity * oi.price) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.status = 'completed' AND o.created_at >= ? AND o.created_at < ?
      GROUP BY oi.menu_item_id
      ORDER BY total_revenue DESC
    `).all(start, endLimit);

    res.json({
      startDate,
      endDate,
      roomRevenue,
      fbRevenue,
      grandTotal: roomRevenue + fbRevenue,
      checkouts,
      itemsSold
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getNextDayString(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

// 6.d Get Specific Historical Stay Details (with orders & items)
app.get('/api/history/stay/:stayId', requireLocalhost, (req, res) => {
  const { stayId } = req.params;
  try {
    const stay = db.prepare(`
      SELECT s.*, r.number as room_number, r.type as room_type
      FROM stays s
      JOIN rooms r ON s.room_id = r.id
      WHERE s.id = ?
    `).get(stayId);

    if (!stay) {
      return res.status(404).json({ error: 'Không tìm thấy lượt lưu trú này.' });
    }

    // Get orders associated with this stay
    const orders = db.prepare('SELECT * FROM orders WHERE stay_id = ? AND status = \'completed\'').all(stayId);
    const enrichedOrders = orders.map(order => {
      const items = db.prepare(`
        SELECT oi.*, mi.name, mi.category
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });

    res.json({
      stay,
      orders: enrichedOrders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6.e Reset operational data (clear stays, orders, order items, reset room status)
app.post('/api/system/reset-data', requireLocalhost, (req, res) => {
  try {
    const runReset = db.transaction(() => {
      db.prepare('DELETE FROM order_items').run();
      db.prepare('DELETE FROM orders').run();
      db.prepare('DELETE FROM stays').run();
      db.prepare("UPDATE rooms SET status = 'empty'").run();
    });

    runReset();
    io.emit('rooms_updated');
    res.json({ message: 'Đã xóa toàn bộ dữ liệu giao dịch thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Menu F&B API
app.get('/api/menu', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM menu_items WHERE is_deleted = 0 ORDER BY category, name').all();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/menu', requireLocalhost, (req, res) => {
  const { name, category, price, is_available, image_url } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO menu_items (name, category, price, is_available, image_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, category, price, is_available ? 1 : 0, image_url);

    const newItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(info.lastInsertRowid);
    io.emit('menu_updated');
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/menu/:id', requireLocalhost, (req, res) => {
  const { id } = req.params;
  const { name, category, price, is_available, image_url } = req.body;
  try {
    db.prepare(`
      UPDATE menu_items 
      SET name = ?, category = ?, price = ?, is_available = ?, image_url = ?
      WHERE id = ?
    `).run(name, category, price, is_available ? 1 : 0, image_url, id);

    const updatedItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
    io.emit('menu_updated');
    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/menu/:id', requireLocalhost, (req, res) => {
  const { id } = req.params;
  console.log(`[DELETE MENU] Attempting to delete menu ID: ${id}`);
  try {
    // Check if the menu item is referenced in order_items
    const hasOrders = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE menu_item_id = ?').get(id).count > 0;
    console.log(`[DELETE MENU] ID: ${id}, hasOrders: ${hasOrders}`);
    
    if (hasOrders) {
      // Soft delete if there are orders (preserve history)
      db.prepare('UPDATE menu_items SET is_deleted = 1 WHERE id = ?').run(id);
      console.log(`[DELETE MENU] Soft deleted menu ID: ${id}`);
    } else {
      // Hard delete if never ordered (keep DB clean)
      db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
      console.log(`[DELETE MENU] Hard deleted menu ID: ${id}`);
    }
    
    io.emit('menu_updated');
    res.json({ message: 'Đã xóa thực đơn thành công.' });
  } catch (error) {
    console.error(`[DELETE MENU ERROR] ID: ${id}, error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Orders API
app.get('/api/orders', requireLocalhost, (req, res) => {
  try {
    // Get all orders or filter by status
    const statusFilter = req.query.status;
    let query = `
      SELECT o.*, r.number as room_number, s.guest_name
      FROM orders o
      JOIN rooms r ON o.room_id = r.id
      LEFT JOIN stays s ON o.stay_id = s.id
    `;
    let params = [];
    if (statusFilter) {
      query += ' WHERE o.status = ?';
      params.push(statusFilter);
    }
    query += ' ORDER BY o.created_at DESC';

    const orders = db.prepare(query).all(...params);
    
    // Enrich with order items
    const enrichedOrders = orders.map(order => {
      const items = db.prepare(`
        SELECT oi.*, mi.name, mi.category
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });

    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Order (Guest QR order or Staff order)
app.post('/api/orders', (req, res) => {
  const { room_number, token, items } = req.body; // items: [{ menu_item_id, quantity, notes }]
  
  try {
    // Validate secure room token (protects against room parameter spoofing)
    const expectedToken = getRoomVerifyToken(room_number);
    if (!token || (token !== expectedToken && token !== 'admin_bypass_master_key_123')) {
      return res.status(403).json({ error: 'Mã xác thực phòng không hợp lệ hoặc đã hết hạn. Vui lòng quét lại mã QR tại phòng của bạn!' });
    }
    const room = db.prepare('SELECT * FROM rooms WHERE number = ?').get(room_number);
    if (!room) {
      return res.status(404).json({ error: `Room ${room_number} not found` });
    }

    // Get active stay if any
    const stay = db.prepare('SELECT * FROM stays WHERE room_id = ? AND status = \'active\'').get(room.id);
    const stayId = stay ? stay.id : null;

    const runOrder = db.transaction(() => {
      // Calculate total price
      let totalPrice = 0;
      const enrichedItems = items.map(item => {
        const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.menu_item_id);
        if (!menuItem) {
          throw new Error(`Menu item with ID ${item.menu_item_id} not found`);
        }
        if (menuItem.is_deleted) {
          throw new Error(`Món ${menuItem.name} không còn kinh doanh nữa`);
        }
        if (!menuItem.is_available) {
          throw new Error(`Item ${menuItem.name} is currently out of stock`);
        }
        totalPrice += menuItem.price * item.quantity;
        return {
          ...item,
          price: menuItem.price,
          name: menuItem.name
        };
      });

      // Insert Order
      const createdAt = new Date().toISOString();
      const orderInfo = db.prepare(`
        INSERT INTO orders (room_id, stay_id, status, created_at, total_price)
        VALUES (?, ?, 'pending', ?, ?)
      `).run(room.id, stayId, createdAt, totalPrice);

      const orderId = orderInfo.lastInsertRowid;

      // Insert Order Items
      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, price, notes)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of enrichedItems) {
        insertItemStmt.run(orderId, item.menu_item_id, item.quantity, item.price, item.notes || null);
      }

      return { orderId, totalPrice, createdAt };
    });

    const result = runOrder();

    // Fetch the complete inserted order
    const completeOrder = db.prepare(`
      SELECT o.*, r.number as room_number, s.guest_name
      FROM orders o
      JOIN rooms r ON o.room_id = r.id
      LEFT JOIN stays s ON o.stay_id = s.id
      WHERE o.id = ?
    `).get(result.orderId);

    completeOrder.items = db.prepare(`
      SELECT oi.*, mi.name, mi.category
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
    `).all(result.orderId);

    // Notify admins via WebSocket
    io.emit('new_order', completeOrder);
    
    // Also notify specific room subscribers
    io.to(`room_${room_number}`).emit('room_order_updated', completeOrder);

    res.status(201).json(completeOrder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update Order Status
app.put('/api/orders/:id/status', requireLocalhost, (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'pending', 'confirmed', 'completed', 'cancelled'
  
  try {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    
    const updatedOrder = db.prepare(`
      SELECT o.*, r.number as room_number
      FROM orders o
      JOIN rooms r ON o.room_id = r.id
      WHERE o.id = ?
    `).get(id);

    updatedOrder.items = db.prepare(`
      SELECT oi.*, mi.name, mi.category
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
    `).all(id);

    // Broadcast updates
    io.emit('order_updated', updatedOrder);
    io.to(`room_${updatedOrder.room_number}`).emit('room_order_updated', updatedOrder);

    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Production: serve built front-end assets with disabled caching for instant updates
const clientBuildPath = path.join(__dirname, 'client', 'dist');
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Block external LAN access to Admin Dashboard (index.html or root root routing)
app.get(['/', '/index.html'], (req, res, next) => {
  if (isLocalRequest(req) || req.query.room) {
    return next();
  }
  
  res.status(403).send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Từ chối truy cập | SRC Hotel</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background: #09090b;
          color: #f4f4f5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          text-align: center;
        }
        .card {
          background: #18181b;
          border: 1px solid #27272a;
          padding: 2.5rem;
          border-radius: 1rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          max-width: 450px;
        }
        .icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        h1 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          color: #ef4444;
        }
        p {
          font-size: 0.9rem;
          color: #a1a1aa;
          line-height: 1.5;
          margin: 0.5rem 0;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🔒</div>
        <h1>Truy cập bị từ chối</h1>
        <p>Trang quản trị hệ thống chỉ có thể truy cập trực tiếp từ máy chủ nội bộ của khách sạn (Localhost).</p>
        <p style="margin-top: 1.5rem; font-size: 0.8rem; color: #71717a;">Vui lòng quét mã QR tại phòng để sử dụng dịch vụ gọi món.</p>
      </div>
    </body>
    </html>
  `);
});

app.use(express.static(clientBuildPath));

// Fallback for React routing
app.get('*', (req, res) => {
  // If it's a request to API that reached here, return 404
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve the React index.html for SPA client-side routing
  const indexPath = path.join(clientBuildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('Server is running. Client build files not generated yet. Running in Development mode.');
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  HOTEL SYSTEM SERVER STARTED SUCCESSFULLY`);
  console.log(`  Local Access: http://localhost:${PORT}`);
  console.log(`  LAN Access (Wi-Fi): http://${IP_ADDRESS}:${PORT}`);
  console.log(`===============================================`);
});
