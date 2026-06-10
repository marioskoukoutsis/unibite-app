const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// GET — ενεργές αγγελίες
exports.getListings = async (req, res) => {
    try {
        // μόνο ενεργές και φρέσκιες (τελευταίες 48 ώρες)
        const query = `
            SELECT * FROM listings 
            WHERE status = 'active' 
            AND created_at >= NOW() - INTERVAL 48 HOUR
        `;

        const [listings] = await pool.query(query);
        res.json(listings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη λήψη των αγγελιών' });
    }
};

// POST — νέα αγγελία
exports.createListing = async (req, res) => {
    try {
        const { cook_id, title, photo_base64, notes, allergens, total_portions, pickup_location, pickup_time, latitude, longitude } = req.body;

        if (!cook_id || !title || !total_portions || !pickup_location || !pickup_time) {
            return res.status(400).json({ error: 'Λείπουν υποχρεωτικά πεδία' });
        }

        let photo_url = null;

        // φωτογραφία ως base64 → την σώζουμε σε αρχείο
        if (photo_base64) {
            // χωρίζουμε το "data:image/...;base64," header από τα δεδομένα.
            // [\s\S]+ (όχι .+) γιατί τα μεγάλα base64 περιέχουν newlines
            const matches = photo_base64.match(/^data:image\/([\w+.-]+);base64,([\s\S]+)$/);

            if (matches && matches.length === 3) {
                let extension = matches[1];
                // heic/heif τα κρατάμε ως jpeg (ο browser έχει ήδη μετατρέψει)
                if (extension === 'heic' || extension === 'heif') extension = 'jpeg';
                const imageData = matches[2].replace(/\s/g, ''); // καθάρισμα whitespace

                const buffer = Buffer.from(imageData, 'base64');
                const fileName = Date.now() + '.' + extension;

                // δημιουργία του uploads αν λείπει
                const uploadDir = path.join(__dirname, '../public/uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filePath = path.join(uploadDir, fileName);

                fs.writeFileSync(filePath, buffer);

                photo_url = '/uploads/' + fileName; // αυτό αποθηκεύεται στη βάση
            }
        }

        const query = `
            INSERT INTO listings 
            (cook_id, title, photo_url, notes, allergens, total_portions, available_portions, pickup_location, pickup_time, latitude, longitude) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            cook_id, title, photo_url, notes || null,
            allergens ? JSON.stringify(allergens) : null,
            total_portions, total_portions, pickup_location, pickup_time,
            latitude || null, longitude || null
        ];

        const [result] = await pool.query(query, values);
        res.status(201).json({ message: 'Η αγγελία δημιουργήθηκε!', listing_id: result.insertId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά την αποθήκευση της αγγελίας' });
    }
};

// PUT — επεξεργασία αγγελίας
exports.updateListing = async (req, res) => {
    try {
        const listingId = req.params.id;
        const { title, notes, total_portions, pickup_location, pickup_time, allergens, photo_base64, latitude, longitude } = req.body;

        // τρέχουσα κατάσταση (χρειαζόμαστε μερίδες + παλιά φωτογραφία)
        const [currentListings] = await pool.query('SELECT total_portions, available_portions, photo_url FROM listings WHERE id = ?', [listingId]);

        if (currentListings.length === 0) {
            return res.status(404).json({ error: 'Η αγγελία δεν βρέθηκε.' });
        }

        const oldTotal = currentListings[0].total_portions;
        const oldAvailable = currentListings[0].available_portions;
        let photo_url = currentListings[0].photo_url; // κρατάμε την παλιά αν δεν ανέβηκε νέα

        // νέα φωτογραφία (ίδια λογική με το create)
        if (photo_base64) {
            const matches = photo_base64.match(/^data:image\/([\w+.-]+);base64,([\s\S]+)$/);
            if (matches && matches.length === 3) {
                let extension = matches[1];
                if (extension === 'heic' || extension === 'heif') extension = 'jpeg';
                const imageData = matches[2].replace(/\s/g, '');
                const buffer = Buffer.from(imageData, 'base64');
                const fileName = Date.now() + '.' + extension;

                const uploadDir = path.join(__dirname, '../public/uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filePath = path.join(uploadDir, fileName);

                fs.writeFileSync(filePath, buffer);
                photo_url = '/uploads/' + fileName; // αντικατάσταση με τη νέα
            }
        }

        // πόσες μερίδες έχουν ήδη δεσμευτεί — δεν επιτρέπουμε να πέσει κάτω από αυτές
        const claimedPortions = oldTotal - oldAvailable;
        const newAvailable = total_portions - claimedPortions;

        if (newAvailable < 0) {
            return res.status(400).json({ error: `Δεν μπορείς να μειώσεις τόσο τις μερίδες. Έχουν ήδη δοθεί ${claimedPortions} μερίδες!` });
        }

        const query = `
            UPDATE listings
            SET title = ?, notes = ?, total_portions = ?, available_portions = ?, pickup_location = ?, pickup_time = ?, allergens = ?, photo_url = ?, latitude = ?, longitude = ?
            WHERE id = ?
        `;

        const values = [
            title, notes, total_portions, newAvailable, pickup_location, pickup_time,
            allergens ? JSON.stringify(allergens) : null,
            photo_url, // νέα ή παλιά
            latitude || null, longitude || null,
            listingId
        ];

        await pool.query(query, values);

        res.json({ message: 'Η αγγελία ενημερώθηκε επιτυχώς!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά την ενημέρωση της αγγελίας' });
    }
};

// DELETE — soft delete (status = deleted) + απόρριψη εκκρεμών αιτημάτων
exports.deleteListing = async (req, res) => {
    try {
        const listingId = req.params.id;

        const [result] = await pool.query(`UPDATE listings SET status = 'deleted' WHERE id = ?`, [listingId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Η αγγελία δεν βρέθηκε.' });
        }

        await pool.query(
            `UPDATE requests SET status = 'rejected' WHERE listing_id = ? AND status IN ('pending', 'approved')`,
            [listingId]
        );

        res.json({ message: 'Η αγγελία διαγράφηκε επιτυχώς!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη διαγραφή της αγγελίας' });
    }
};