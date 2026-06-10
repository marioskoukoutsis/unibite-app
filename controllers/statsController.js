const pool = require('../config/db');

// Δεδομένα για τη σελίδα στατιστικών/leaderboard
exports.getLeaderboard = async (req, res) => {
    try {
        // σύνολο μερίδων που παραλήφθηκαν (όλων των εποχών)
        const [[portionsResult]] = await pool.query(`
            SELECT COUNT(*) AS total_portions
            FROM requests
            WHERE status = 'picked_up'
        `);

        // πόσοι διαφορετικοί μάγειρες έχουν προσφέρει
        const [[cooksResult]] = await pool.query(`
            SELECT COUNT(DISTINCT l.cook_id) AS total_cooks
            FROM listings l
            JOIN requests r ON l.id = r.listing_id
            WHERE r.status = 'picked_up'
        `);

        // top 10 μάγειρες με τις περισσότερες μερίδες
        const [topCooks] = await pool.query(`
            SELECT u.name, COUNT(r.id) AS portions_given,
                   ROUND(AVG(CASE WHEN r.rating > 0 THEN r.rating ELSE NULL END), 1) AS avg_rating
            FROM users u
            JOIN listings l ON u.id = l.cook_id
            JOIN requests r ON l.id = r.listing_id
            WHERE r.status = 'picked_up'
            GROUP BY u.id
            ORDER BY portions_given DESC
            LIMIT 10
        `);

        // top 5 γεύματα με την καλύτερη μέση βαθμολογία
        const [topMeals] = await pool.query(`
            SELECT l.title, u.name AS cook_name,
                   ROUND(AVG(r.rating), 1) AS avg_rating,
                   COUNT(r.rating) AS total_ratings
            FROM listings l
            JOIN requests r ON l.id = r.listing_id
            JOIN users u ON l.cook_id = u.id
            WHERE r.rating IS NOT NULL AND r.rating > 0
            GROUP BY l.id
            ORDER BY avg_rating DESC, total_ratings DESC
            LIMIT 5
        `);

        // μερίδες του τελευταίου μήνα
        const [[monthResult]] = await pool.query(`
            SELECT COUNT(*) AS monthly_portions
            FROM requests
            WHERE status = 'picked_up' AND created_at >= NOW() - INTERVAL 1 MONTH
        `);

        res.json({
            totalPortions: portionsResult.total_portions || 0,
            totalCooks: cooksResult.total_cooks || 0,
            monthlyPortions: monthResult.monthly_portions || 0,
            topCooks: topCooks,
            topMeals: topMeals
        });

    } catch (error) {
        console.error('Σφάλμα στο leaderboard:', error);
        res.status(500).json({ error: 'Πρόβλημα στη λήψη στατιστικών.' });
    }
};
