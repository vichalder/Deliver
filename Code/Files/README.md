# GNSS Device Tracker

This project is a full-stack application for tracking GNSS-enabled devices. It includes a backend server, frontend web application, and device code for ESP32.

## Quick Start

The easiest way to start the application is using the provided batch file:

1. Complete the setup instructions below for both backend and frontend (installing dependencies, setting up the database, etc.)
2. Run the `start_asset_tracker.bat` file by double-clicking it
3. The batch file will automatically start both the backend and frontend servers
4. Access the application in your web browser at http://localhost:3000

## Project Structure

```
asset_tracker_v2/
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── db.js
│   │   └── routes/
│   │       ├── devices.js
│   │       └── geofences.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── device_code/
│   ├── esp32/
│   │   └── esp32_gnss.ino
├── SQL/
│   └── db_schema.sql
├── start_asset_tracker.bat
└── README.md
```

## Setup Instructions

### Backend Setup

1. Navigate to the `backend` directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Install MariaDB Server:
   - Download from: https://mariadb.org/download/
   - During installation:
     - Set root password
     - Enable networking/remote access if you want to connect remotely
     - Complete the installation wizard

4. Create a `.env` file in the `backend` directory:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=asset_tracker
   PORT=3000
   ```

5. Set up the database:
   - Open MySQL Workbench
   - Create a new connection:
     * Hostname: localhost
     * Port: 3306 (default)
     * Username: root
     * Password: (password you set during MariaDB installation)
   - Create a new database named 'asset_tracker'
   - Run the SQL commands in `SQL/db_schema.sql` to create tables
   - (Optional) Run the SQL commands in `SQL/mock_data.sql` to populate tables with test data:
     * 5 devices (trucks, trackers, containers) around Oslo
     * 24 hours of movement history
     * 4 geofences covering key areas
     * Sample geofence alerts

6. Start the server:
   ```
   npm start
   ```
   
   Note: Instead of manually starting the backend and frontend servers separately, you can use the `start_asset_tracker.bat` file in the root directory to start both servers simultaneously.

### Frontend Setup

1. Navigate to the `frontend` directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

### Database Setup

The project uses MariaDB, which is a free and open-source fork of MySQL that provides full MySQL compatibility.

1. Local Setup:
   - Follow the MariaDB installation steps in the Backend Setup section above
   - Use MySQL Workbench to manage your database
   - The database will be accessible at localhost:3306

2. Remote Setup (Optional):
   - Install MariaDB on your server
   - Configure MariaDB to accept remote connections:
     * Edit my.cnf/my.ini (usually in /etc/mysql/)
     * Set bind-address = 0.0.0.0
   - Create a remote user:
     ```sql
     CREATE USER 'username'@'%' IDENTIFIED BY 'password';
     GRANT ALL PRIVILEGES ON asset_tracker.* TO 'username'@'%';
     FLUSH PRIVILEGES;
     ```
   - Open port 3306 on your firewall
   - Update DB_HOST in .env to your server's IP address

### Device Setup

#### ESP32

1. Open the `device_code/esp32/esp32_gnss.ino` file in the Arduino IDE.
2. Install the required libraries:
   - TinyGPS++
   - TinyGSM
   - ArduinoJson
3. Update the following in the code:
   - APN settings for your cellular provider
   - `server` variable with your backend server's IP address or domain
   - `port` variable with your backend server's port (default is 3000)
   - `deviceId` variable with a unique ID for this device
4. Flash the code to your ESP32 device.

## Features

- Real-time device tracking
- Historical data visualization
- Geofencing capabilities
- Geofence alert configuration
- Support for both ESP32 and Cortex-M4 based GNSS devices

## Geofencing

The application supports geofencing:
- Create circular geofences by drawing on the map
- Edit existing geofences
- Delete geofences
- View all current geofences

## Geofence Alerts

The application now supports configurable geofence alerts:
- Configure alerts for specific devices and geofences
- Set up alerts for when a device enters an "entering" geofence or exits an "exiting" geofence
- Manage alert configurations through the Alert Configuration page

To use the geofence alert feature:
1. Navigate to the Alert Configuration page using the navbar
2. Select a device from the dropdown list
3. Select a geofence from the dropdown list
4. The system will automatically check if the selected device's last known position triggers an alert for the selected geofence
5. If an alert is triggered, it will be displayed on the page

Note: The current implementation checks for alerts based on the device's last known position. For real-time alerts, you would need to implement a more sophisticated system that continuously monitors device positions and triggers alerts as they occur.

## Note

This project is a basic implementation and may require additional security measures and optimizations for production use. Always follow best practices for security when deploying web applications and IoT devices.
