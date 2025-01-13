USE asset_tracker;

CREATE TABLE IF NOT EXISTS device_geofences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id INT NOT NULL,
  geofence_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (geofence_id) REFERENCES geofences(id),
  UNIQUE KEY unique_device_geofence (device_id)
) ENGINE=InnoDB AUTO_INCREMENT=1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
