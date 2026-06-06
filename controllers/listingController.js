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
            // ΣΗΜΑΝΤΙΚΟ: Χρησιμοποιούμε [\s\S]+ αντί για .+ γιατί μεγάλα base64 strings
            // μπορεί να περιέχουν newlines, και το .+ δεν τα πιάνει!
            const matches = photo_base64.match(/^data:image\/([\w+.-]+);base64,([\s\S]+)$/);

            if (matches && matches.length === 3) {
                let extension = matches[1]; // π.χ. png, jpeg, webp, heic
                // Κανονικοποίηση: αν είναι heic/heif, αποθηκεύουμε ως jpeg (ο browser τα μετατρέπει)
                if (extension === 'heic' || extension === 'heif') extension = 'jpeg';
                const imageData = matches[2].replace(/\s/g, ''); // Αφαιρούμε τυχόν whitespace/newlines

                // Μετατροπή του κειμένου ξανά σε αρχείο
                const buffer = Buffer.from(imageData, 'base64');
                const fileName = Date.now() + '.' + extension; // π.χ. 16543245.png

                // Ορίζουμε πού θα αποθηκευτεί, και αν δεν υπάρχει ο φάκελος τον δημιουργούμε
                const uploadDir = path.join(__dirname, '../public/uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filePath = path.join(uploadDir, fileName);

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
        // ΠΡΟΣΘΗΚΗ: Διαβάζουμε και το photo_base64!
        const { title, notes, total_portions, pickup_location, pickup_time, allergens, photo_base64 } = req.body;

        // 1. Βρίσκουμε την τρέχουσα κατάσταση της αγγελίας (παίρνουμε και το photo_url τώρα)
        const [currentListings] = await pool.query('SELECT total_portions, available_portions, photo_url FROM listings WHERE id = ?', [listingId]);

        if (currentListings.length === 0) {
            return res.status(404).json({ error: 'Η αγγελία δεν βρέθηκε.' });
        }

        const oldTotal = currentListings[0].total_portions;
        const oldAvailable = currentListings[0].available_portions;
        let photo_url = currentListings[0].photo_url; // Κρατάμε την ΠΑΛΙΑ φωτογραφία από προεπιλογή

        // --- ΝΕΟ: ΕΠΕΞΕΡΓΑΣΙΑ ΝΕΑΣ ΦΩΤΟΓΡΑΦΙΑΣ (Αν ανέβασε) ---
        if (photo_base64) {
            // Ίδιο regex fix: [\w+.-] για MIME types και [\s\S]+ για μεγάλα base64 strings
            const matches = photo_base64.match(/^data:image\/([\w+.-]+);base64,([\s\S]+)$/);
            if (matches && matches.length === 3) {
                let extension = matches[1];
                if (extension === 'heic' || extension === 'heif') extension = 'jpeg';
                const imageData = matches[2].replace(/\s/g, ''); // Αφαιρούμε whitespace
                const buffer = Buffer.from(imageData, 'base64');
                const fileName = Date.now() + '.' + extension;

                const uploadDir = path.join(__dirname, '../public/uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filePath = path.join(uploadDir, fileName);

                fs.writeFileSync(filePath, buffer);
                photo_url = '/uploads/' + fileName; // Αντικαθιστούμε με το νέο link!
            }
        }

        // 2. Υπολογίζουμε πόσες μερίδες έχουν ήδη "κρατηθεί"
        const claimedPortions = oldTotal - oldAvailable;
        const newAvailable = total_portions - claimedPortions;

        if (newAvailable < 0) {
            return res.status(400).json({ error: `Δεν μπορείς να μειώσεις τόσο τις μερίδες. Έχουν ήδη δοθεί ${claimedPortions} μερίδες!` });
        }

        // 3. Ενημερώνουμε ΤΑ ΠΑΝΤΑ, μαζί με το photo_url!
        const query = `
            UPDATE listings
            SET title = ?, notes = ?, total_portions = ?, available_portions = ?, pickup_location = ?, pickup_time = ?, allergens = ?, photo_url = ?
            WHERE id = ?
        `;

        const values = [
            title, notes, total_portions, newAvailable, pickup_location, pickup_time,
            allergens ? JSON.stringify(allergens) : null,
            photo_url, // Το νέο ή το παλιό URL
            listingId
        ];

        await pool.query(query, values);

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