require('dotenv').config();
const express = require('express');
const cors = require('cors');
const deviceRoutes = require('./routes/devices');
const geofenceRoutes = require('./routes/geofences');
const db = require('./db');
const mqttClient = require('./mqtt-client');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/devices', deviceRoutes);
app.use('/api/geofences', geofenceRoutes);

app.get('/', (req, res) => {
  res.send('GNSS Device Tracker API');
});

async function startServer() {
  try {
    console.log('Starting server...');
    console.log('Environment variables:');
    console.log(`DB_HOST: ${process.env.DB_HOST}`);
    console.log(`DB_USER: ${process.env.DB_USER}`);
    console.log(`DB_NAME: ${process.env.DB_NAME}`);
    console.log(`PORT: ${process.env.PORT}`);

    await db.connect();
    console.log('Connected to database');
    app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    
    // Connect to MQTT broker after server is running
    mqttClient.connect();
    console.log('MQTT client initialized');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
process.exit(1);
  } finally {
    // Ensure MQTT client is disconnected on server shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down server...');
      mqttClient.disconnect();
      process.exit(0);
    });
  }
}

startServer();
