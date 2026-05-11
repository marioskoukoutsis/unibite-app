const mysql = require('mysql2/promise');

// Απευθείας σύνδεση με τις τοπικές ρυθμίσεις της MySQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',         // Το προεπιλεγμένο username
    password: 'taxvax2005',         // Κενό password για το XAMPP
    database: 'unibite_db', // Το όνομα της βάσης που δημιούργησες
    port: 3306            // Η τυπική θύρα της MySQL
});

module.exports = pool;