const pool = require('../config/db'); // Φέρνουμε τη σύνδεση με τη βάση

// Η συνάρτηση για το GET
exports.getListings = async (req, res) => {
    try {
        const [listings] = await pool.query("SELECT * FROM listings WHERE status = 'active'");
        res.json(listings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη λήψη των αγγελιών' });
    }
};

// Η συνάρτηση για το POST
exports.createListing = async (req, res) => {
    try {
        const { cook_id, title, photo_url, notes, allergens, total_portions, pickup_location, pickup_time } = req.body;

        if (!cook_id || !title || !total_portions || !pickup_location || !pickup_time) {
            return res.status(400).json({ error: 'Λείπουν υποχρεωτικά πεδία' });
        }

        const query = `
            INSERT INTO listings 
            (cook_id, title, photo_url, notes, allergens, total_portions, available_portions, pickup_location, pickup_time) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            cook_id, title, photo_url || null, notes || null,
            allergens ? JSON.stringify(allergens) : null,
            total_portions, total_portions, pickup_location, pickup_time
        ];

        const [result] = await pool.query(query, values);
        res.status(201).json({ message: 'Η αγγελία δημιουργήθηκε!', listing_id: result.insertId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά την αποθήκευση της αγγελίας' });
    }
};