const pool = require('../config/db'); // Φέρνουμε τη σύνδεση με τη βάση
const fs = require('fs');
const path = require('path');

// Η συνάρτηση για το GET
exports.getListings = async (req, res) => {
    try {
        // SQL ΜΑΓΕΙΑ: Φέρε όσες είναι 'active' ΚΑΙ δημιουργήθηκαν αυστηρά τις τελευταίες 48 ώρες!
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

// Η συνάρτηση για το POST
exports.createListing = async (req, res) => {
    try {
        const { cook_id, title, photo_base64, notes, allergens, total_portions, pickup_location, pickup_time } = req.body;

        if (!cook_id || !title || !total_portions || !pickup_location || !pickup_time) {
            return res.status(400).json({ error: 'Λείπουν υποχρεωτικά πεδία' });
        }

        let photo_url = null;

        // Αν μας έστειλε κείμενο εικόνας (Base64)
        if (photo_base64) {
            // Το Base64 String έχει αυτή τη μορφή: "data:image/png;base64,iVBORw0KGgo..."
            // Χωρίζουμε την επικεφαλίδα από τα πραγματικά δεδομένα
            const matches = photo_base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);

            if (matches && matches.length === 3) {
                const extension = matches[1]; // π.χ. png, jpeg
                const imageData = matches[2]; // Τα πραγματικά δεδομένα

                // Μετατροπή του κειμένου ξανά σε αρχείο
                const buffer = Buffer.from(imageData, 'base64');
                const fileName = Date.now() + '.' + extension; // π.χ. 16543245.png

                // Ορίζουμε πού θα αποθηκευτεί (πρέπει να έχεις φτιάξει τον φάκελο public/uploads)
                const filePath = path.join(__dirname, '../public/uploads', fileName);

                // Γράφουμε το αρχείο στον δίσκο!
                fs.writeFileSync(filePath, buffer);

                // Κρατάμε το url για να το βάλουμε στη βάση
                photo_url = '/uploads/' + fileName;
            }
        }

        const query = `
            INSERT INTO listings 
            (cook_id, title, photo_url, notes, allergens, total_portions, available_portions, pickup_location, pickup_time) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            cook_id, title, photo_url, notes || null,
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

// --- Η συνάρτηση για την ΕΠΕΞΕΡΓΑΣΙΑ (PUT) ---
exports.updateListing = async (req, res) => {
    try {
        const listingId = req.params.id;
        const { title, notes, total_portions, pickup_location, pickup_time, allergens } = req.body;

        const query = `
            UPDATE listings
            SET title = ?, notes = ?, total_portions = ?, pickup_location = ?, pickup_time = ?, allergens = ?
            WHERE id = ?
        `;

        const values = [
            title, notes, total_portions, pickup_location, pickup_time,
            allergens ? JSON.stringify(allergens) : null,
            listingId
        ];

        const [result] = await pool.query(query, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Η αγγελία δεν βρέθηκε.' });
        }

        res.json({ message: 'Η αγγελία ενημερώθηκε επιτυχώς!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά την ενημέρωση της αγγελίας' });
    }
};

// --- ΝΕΟ: Η συνάρτηση για τη ΔΙΑΓΡΑΦΗ (DELETE) ---
exports.deleteListing = async (req, res) => {
    try {
        const listingId = req.params.id;

        // SOFT DELETE: Δεν κάνουμε "DELETE FROM", απλά αλλάζουμε το status σε 'deleted'
        const query = `UPDATE listings SET status = 'deleted' WHERE id = ?`;

        const [result] = await pool.query(query, [listingId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Η αγγελία δεν βρέθηκε.' });
        }

        res.json({ message: 'Η αγγελία διαγράφηκε επιτυχώς!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα κατά τη διαγραφή της αγγελίας' });
    }
};