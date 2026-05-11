const pool = require('../config/db');

exports.getStats = async (req, res) => {
    try {
        const [[portionsResult]] = await pool.query(`
            SELECT COUNT(*) AS total_portions 
            FROM requests 
            WHERE status = 'picked_up' AND created_at >= NOW() - INTERVAL 1 MONTH
        `);

        const [[topDonorResult]] = await pool.query(`
            SELECT u.name, COUNT(r.id) AS portions_given
            FROM users u
            JOIN listings l ON u.id = l.cook_id
            JOIN requests r ON l.id = r.listing_id
            WHERE r.status = 'picked_up'
            GROUP BY u.id
            ORDER BY portions_given DESC
            LIMIT 1
        `);

        const [topMeals] = await pool.query(`
            SELECT l.title, AVG(r.rating) AS avg_rating
            FROM listings l
            JOIN requests r ON l.id = r.listing_id
            WHERE r.rating IS NOT NULL
            GROUP BY l.id
            ORDER BY avg_rating DESC
            LIMIT 3
        `);

        res.json({
            totalPortions: portionsResult.total_portions || 0,
            topDonor: topDonorResult || { name: 'Κανένας ακόμα', portions_given: 0 },
            topMeals: topMeals
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Πρόβλημα στη λήψη στατιστικών.' });
    }
};