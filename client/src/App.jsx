import React from 'react';
import AdminDashboard from './pages/AdminDashboard';
import GuestOrder from './pages/GuestOrder';

function App() {
  const params = new URLSearchParams(window.location.search);
  const secureRoomId = params.get('room');

  if (secureRoomId) {
    return <GuestOrder secureRoomId={secureRoomId} />;
  }

  return <AdminDashboard />;
}

export default App;
