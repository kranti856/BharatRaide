import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DriverLocationPayload {
  rideId: string;
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKmph?: number;
  distanceRemainingKm?: number;
  etaMinutes?: number;
  timestamp: number;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'], // Allow WebSocket + Polling fallback for iFrame sandbox
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // In-memory registry for active ride GPS coordinates
  const activeRideLocations = new Map<string, DriverLocationPayload>();

  // REST API Endpoints for testing & polling fallback
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'BharatRaide Live GPS Dispatcher',
      activeTrackingRides: activeRideLocations.size,
      time: new Date().toISOString(),
    });
  });

  // Get current live location for a ride
  app.get('/api/ride/:rideId/location', (req, res) => {
    const { rideId } = req.params;
    const location = activeRideLocations.get(rideId);
    if (location) {
      res.json({ success: true, location });
    } else {
      res.json({ success: false, message: 'No live tracking data found for ride ' + rideId });
    }
  });

  // Post live GPS update from driver (HTTP REST Fallback)
  app.post('/api/ride/:rideId/location', (req, res) => {
    const { rideId } = req.params;
    const { driverId, lat, lng, heading = 0, speedKmph = 32, distanceRemainingKm, etaMinutes } = req.body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ success: false, error: 'Invalid coordinates' });
      return;
    }

    const payload: DriverLocationPayload = {
      rideId,
      driverId: driverId || 'unknown_driver',
      lat,
      lng,
      heading,
      speedKmph,
      distanceRemainingKm,
      etaMinutes,
      timestamp: Date.now(),
    };

    activeRideLocations.set(rideId, payload);

    // Broadcast through Socket.io to all room subscribers and globally
    io.to(rideId).emit('driver_location_updated', payload);
    io.emit('global_driver_location', payload);

    res.json({ success: true, location: payload });
  });

  // Socket.io real-time connection handler
  io.on('connection', (socket) => {
    // Client joins a specific ride room (Customer or Driver)
    socket.on('join_ride', (rideId: string) => {
      if (!rideId) return;
      socket.join(rideId);

      // Immediately send latest cached position if available
      const latest = activeRideLocations.get(rideId);
      if (latest) {
        socket.emit('driver_location_updated', latest);
      }
    });

    // Driver streams updated GPS coordinates every 3-5 seconds
    socket.on('update_driver_location', (data: Partial<DriverLocationPayload>) => {
      if (!data || !data.rideId || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
        return;
      }

      const payload: DriverLocationPayload = {
        rideId: data.rideId,
        driverId: data.driverId || 'driver',
        lat: data.lat,
        lng: data.lng,
        heading: data.heading || 0,
        speedKmph: data.speedKmph || 30,
        distanceRemainingKm: data.distanceRemainingKm,
        etaMinutes: data.etaMinutes,
        timestamp: Date.now(),
      };

      activeRideLocations.set(data.rideId, payload);

      // Emit to all customers/drivers subscribed to this ride
      io.to(data.rideId).emit('driver_location_updated', payload);
      // Also broadcast globally so active driver map updates seamlessly
      socket.broadcast.emit('global_driver_location', payload);
    });

    // Ride completion or cancellation: clear live tracking
    socket.on('ride_ended', (rideId: string) => {
      if (rideId) {
        activeRideLocations.delete(rideId);
        io.to(rideId).emit('ride_ended', { rideId });
      }
    });

    socket.on('leave_ride', (rideId: string) => {
      if (rideId) socket.leave(rideId);
    });
  });

  // Vite development middleware or production static files
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[BharatRaide Backend] Server running on http://0.0.0.0:${PORT} with Socket.io Live Tracking.`);
  });
}

startServer().catch((err) => {
  console.error('[BharatRaide Server Error]:', err);
  process.exit(1);
});
