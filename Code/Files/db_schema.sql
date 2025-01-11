-- Create database with proper encoding
CREATE DATABASE IF NOT EXISTS asset_tracker
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE asset_tracker;

-- Enable strict mode and proper timezone
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  last_latitude DECIMAL(10, 8),
  last_longitude DECIMAL(11, 8),
  last_seen DATETIME
) ENGINE=InnoDB AUTO_INCREMENT=1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS device_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id INT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB AUTO_INCREMENT=1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS geofences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  center_lat DECIMAL(10, 8) NOT NULL,
  center_lng DECIMAL(11, 8) NOT NULL,
  radius DECIMAL(10, 2) NOT NULL,
  type ENUM('entering', 'exiting') NOT NULL DEFAULT 'exiting'
) ENGINE=InnoDB AUTO_INCREMENT=1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS geofence_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  geofence_id INT NOT NULL,
  device_id INT NOT NULL,
  alert_type ENUM('enter', 'exit') NOT NULL,
  FOREIGN KEY (geofence_id) REFERENCES geofences(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB AUTO_INCREMENT=1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
