const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const addresses = interfaces[interfaceName];
    for (const address of addresses) {
      // Find IPv4 address that is not internal (loopback)
      // Check both Node.js family format (which can be 'IPv4' or number 4 in newer versions)
      const isIPv4 = address.family === 'IPv4' || address.family === 4;
      if (isIPv4 && !address.internal) {
        // Return the first suitable local network address
        if (
          address.address.startsWith('192.168.') || 
          address.address.startsWith('10.') || 
          address.address.startsWith('172.')
        ) {
          return address.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

module.exports = { getLocalIpAddress };
