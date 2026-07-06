const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'hotel.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    price_per_hour INTEGER NOT NULL,
    price_per_day INTEGER NOT NULL,
    hourly_tiers TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'empty' CHECK(status IN ('empty', 'occupied', 'cleaning', 'booked'))
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('food', 'drink', 'service')),
    price INTEGER NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0, 1)),
    image_url TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS stays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    guest_name TEXT NOT NULL,
    check_in_time TEXT NOT NULL,
    check_out_time TEXT,
    hourly_or_daily TEXT NOT NULL DEFAULT 'daily' CHECK(hourly_or_daily IN ('hourly', 'daily')),
    base_room_charge INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    stay_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    created_at TEXT NOT NULL,
    total_price INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY(stay_id) REFERENCES stays(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    price INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
  );
`);

// Migration: add hourly_tiers column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE rooms ADD COLUMN hourly_tiers TEXT DEFAULT NULL`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Migration: add secure_id column if it doesn't exist (for secure QR lookup)
try {
  db.exec(`ALTER TABLE rooms ADD COLUMN secure_id TEXT DEFAULT NULL`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_secure_id ON rooms(secure_id)`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Migration: add is_deleted column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE menu_items ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1))`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Auto-populate secure_id with permanent random hex keys for rooms that don't have one
try {
  const crypto = require('crypto');
  const roomsWithoutSecureId = db.prepare('SELECT id FROM rooms WHERE secure_id IS NULL').all();
  if (roomsWithoutSecureId.length > 0) {
    const updateSecureId = db.prepare('UPDATE rooms SET secure_id = ? WHERE id = ?');
    const populateTx = db.transaction((list) => {
      for (const room of list) {
        const secureId = crypto.randomBytes(8).toString('hex');
        updateSecureId.run(secureId, room.id);
      }
    });
    populateTx(roomsWithoutSecureId);
    console.log(`[DB MIGRATION] Đã cập nhật secure_id ngẫu nhiên cố định cho ${roomsWithoutSecureId.length} phòng.`);
  }
} catch (err) {
  console.error('[DB MIGRATION ERROR]: Failed to populate secure_id:', err);
}


// Insert seed data if tables are empty
const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
if (roomCount === 0) {
  const insertRoom = db.prepare(`
    INSERT INTO rooms (number, type, price_per_hour, price_per_day, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertRoom.run('101', 'Standard Single', 30000, 250000, 'empty');
  insertRoom.run('102', 'Standard Double', 45000, 350000, 'empty');
  insertRoom.run('103', 'Standard Double', 45000, 350000, 'empty');
  insertRoom.run('104', 'Deluxe Double', 60000, 450000, 'empty');
  insertRoom.run('201', 'VIP Suite', 100000, 800000, 'empty');
  insertRoom.run('202', 'VIP Suite', 100000, 800000, 'empty');
  console.log('Seed: Inserted rooms.');
}

const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get().count;
if (menuCount === 0) {
  const insertMenuItem = db.prepare(`
    INSERT INTO menu_items (name, category, price, is_available, image_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Food
  insertMenuItem.run('Cơm chiên hải sản', 'food', 75000, 1, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80');
  insertMenuItem.run('Phở bò đặc biệt', 'food', 65000, 1, 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=400&q=80');
  insertMenuItem.run('Mì xào bò', 'food', 55000, 1, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80');
  insertMenuItem.run('Bánh mì ốp la', 'food', 30000, 1, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=400&q=80');

  // Drinks
  insertMenuItem.run('Nước suối Aquafina', 'drink', 15000, 1, 'https://images.unsplash.com/photo-1608885898957-a599fb16ec8c?auto=format&fit=crop&w=400&q=80');
  insertMenuItem.run('Coca Cola', 'drink', 20000, 1, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80');
  insertMenuItem.run('Cà phê sữa đá', 'drink', 30000, 1, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=400&q=80');
  insertMenuItem.run('Nước ép cam', 'drink', 45000, 1, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=400&q=80');
  insertMenuItem.run('Bia Heineken', 'drink', 35000, 1, 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=400&q=80');

  // Services
  insertMenuItem.run('Giặt ủi (1kg)', 'service', 30000, 1, 'https://images.unsplash.com/photo-1545173168-9f1947eebd01?auto=format&fit=crop&w=400&q=80');
  insertMenuItem.run('Thêm gối & nệm phụ', 'service', 50000, 1, 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=400&q=80');
  console.log('Seed: Inserted menu items.');
}

module.exports = db;
