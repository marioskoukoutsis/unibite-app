-- Δημιουργία της βάσης
CREATE DATABASE IF NOT EXISTS unibite_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE unibite_db;

-- Πίνακας Χρηστών
CREATE TABLE users (
                       id INT AUTO_INCREMENT PRIMARY KEY,
                       name VARCHAR(100) NOT NULL,
                       email VARCHAR(100) NOT NULL UNIQUE,
                       role ENUM('student', 'admin') DEFAULT 'student',
                       credits INT DEFAULT 5,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Πίνακας Αγγελιών
CREATE TABLE listings (
                          id INT AUTO_INCREMENT PRIMARY KEY,
                          cook_id INT NOT NULL,
                          title VARCHAR(255) NOT NULL,
                          photo_url VARCHAR(255),
                          notes TEXT,
                          allergens JSON,
                          total_portions INT NOT NULL,
                          available_portions INT NOT NULL,
                          pickup_location VARCHAR(255) NOT NULL,
                          pickup_time DATETIME NOT NULL,
                          status ENUM('active', 'inactive', 'deleted') DEFAULT 'active',
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                          FOREIGN KEY (cook_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Πίνακας Αιτημάτων/Κρατήσεων
CREATE TABLE requests (
                          id INT AUTO_INCREMENT PRIMARY KEY,
                          listing_id INT NOT NULL,
                          consumer_id INT NOT NULL,
                          status ENUM('pending', 'approved', 'rejected', 'picked_up', 'no_show') DEFAULT 'pending',
                          rating INT DEFAULT NULL,
                          rating_time DATETIME DEFAULT NULL,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                          FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
                          FOREIGN KEY (consumer_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL AFTER email;
ALTER TABLE listings ADD COLUMN latitude DECIMAL(9,6) DEFAULT NULL AFTER pickup_time;
ALTER TABLE listings ADD COLUMN longitude DECIMAL(9,6) DEFAULT NULL AFTER latitude;