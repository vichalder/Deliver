const mqtt = require('mqtt');
const { pool } = require('./db');

const MQTT_BROKER = 'mqtt://test.mosquitto.org:1883';
const MQTT_TOPICS = [
    'DTU/walter/newdevices/+',  // + is wildcard for MAC address
    'DTU/walter/devices/+'
];

class MQTTClient {
    constructor() {
        this.client = null;
    }

    connect() {
        this.client = mqtt.connect(MQTT_BROKER);

        this.client.on('connect', () => {
            console.log('Connected to MQTT broker');
            // Subscribe to all topics
            MQTT_TOPICS.forEach(topic => {
                this.client.subscribe(topic, (err) => {
                    if (!err) {
                        console.log(`Subscribed to ${topic}`);
                    }
                });
            });
        });

        this.client.on('message', async (topic, message) => {
            try {
                console.log('Received message on topic:', topic);
                console.log('Raw message:', message.toString());
                
                const topicParts = topic.split('/');
                const messageType = topicParts[2]; // 'newdevices' or 'devices'
                const mac = topicParts[3];
                
                if (messageType === 'newdevices') {
                    await this.handleNewDevice(mac);
                } else if (messageType === 'devices') {
                    await this.handleDeviceUpdate(message);
                }
            } catch (err) {
                console.error('Error processing MQTT message:', err);
                console.error(err.stack);
            }
        });

        this.client.on('error', (err) => {
            console.error('MQTT client error:', err);
        });
    }

    async handleNewDevice(mac) {
        try {
            console.log('Handling new device registration:', mac);
            
            // Check if device already exists
            const [devices] = await pool.query(
                'SELECT id FROM devices WHERE name = ?',
                [mac]
            );

            if (devices.length === 0) {
                // Create new device if it doesn't exist
                await pool.query(
                    'INSERT INTO devices (name, type, status, last_seen) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                    [mac, 'walter', 'active']
                );
                console.log(`New device registered: ${mac}`);
            } else {
                // Update last_seen for existing device
                await pool.query(
                    'UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE name = ?',
                    [mac]
                );
                console.log(`Updated last_seen for existing device: ${mac}`);
            }
        } catch (err) {
            console.error('Error handling new device:', err);
            console.error(err.stack);
            throw err;
        }
    }

    async handleDeviceUpdate(message) {
        try {
            const messageStr = message.toString();
            console.log('Received message:', messageStr);
            
            // Check if this is a hello message
            if (messageStr.startsWith('Hello, I am ')) {
                const mac = messageStr.slice(11); // Extract MAC after "Hello, I am "
                console.log(`Received hello message from device ${mac}`);
                await this.updateDeviceLastSeen(mac);
                return;
            }

            // Handle regular JSON updates
            const data = JSON.parse(messageStr);
            console.log('Parsed device update:', data);
            
            // Skip updates with high confidence (indicating poor fix)
            if (data.Confidence > 100) {
                console.log(`Skipping update for ${data.MAC_adr} due to high confidence: ${data.Confidence}`);
                return;
            }

            console.log(`Processing update for device ${data.MAC_adr}`);
            console.log(`Position: ${data.Latitude}, ${data.Longitude}`);

            // First ensure the device exists
            const [devices] = await pool.query(
                'SELECT id FROM devices WHERE name = ?',
                [data.MAC_adr]
            );

            if (devices.length === 0) {
                console.log(`Creating new device for ${data.MAC_adr}`);
                // Create the device if it doesn't exist
                await pool.query(
                    'INSERT INTO devices (name, type, status, last_latitude, last_longitude, last_seen) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [data.MAC_adr, 'walter', 'active', data.Latitude, data.Longitude]
                );
            } else {
                console.log(`Updating existing device ${data.MAC_adr}`);
                // Update existing device's last known position
                await pool.query(
                    `UPDATE devices 
                     SET last_latitude = ?, last_longitude = ?, last_seen = CURRENT_TIMESTAMP 
                     WHERE name = ?`,
                    [data.Latitude, data.Longitude, data.MAC_adr]
                );
            }

            // Get the device ID (it will exist now)
            const [deviceResult] = await pool.query(
                'SELECT id FROM devices WHERE name = ?',
                [data.MAC_adr]
            );

            // Add to device history
            await pool.query(
                `INSERT INTO device_history (device_id, latitude, longitude) 
                 VALUES (?, ?, ?)`,
                [deviceResult[0].id, data.Latitude, data.Longitude]
            );
            console.log(`Position history updated for device: ${data.MAC_adr}`);
        } catch (err) {
            console.error('Error handling device update:', err);
            console.error('Message that caused error:', message.toString());
            console.error(err.stack);
            throw err;
        }
    }

    async updateDeviceLastSeen(mac) {
        try {
            // Check if device exists
            const [devices] = await pool.query(
                'SELECT id FROM devices WHERE name = ?',
                [mac]
            );

            if (devices.length === 0) {
                console.log(`Creating new device for hello message: ${mac}`);
                // Create the device if it doesn't exist
                await pool.query(
                    'INSERT INTO devices (name, type, status, last_seen) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                    [mac, 'walter', 'active']
                );
            } else {
                console.log(`Updating last_seen for device: ${mac}`);
                // Update only the last_seen timestamp
                await pool.query(
                    'UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE name = ?',
                    [mac]
                );
            }
        } catch (err) {
            console.error('Error updating device last_seen:', err);
            console.error(err.stack);
            throw err;
        }
    }

    disconnect() {
        if (this.client) {
            this.client.end();
        }
    }
}

module.exports = new MQTTClient();
