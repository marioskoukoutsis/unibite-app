const pool = require('./config/db');

/**
 * 48-Hour No-Rating Penalty
 * 
 * Αυτόματος έλεγχος: Αν ένας consumer παρέλαβε φαγητό (picked_up)
 * αλλά ΔΕΝ έβαλε αξιολόγηση μέσα σε 48 ώρες, χάνει 1 credit.
 * 
 * Για να μην τιμωρηθεί ο χρήστης πολλαπλά, θέτουμε rating = -1
 * (sentinel value) ώστε να μη ξαναελεγχθεί.
 */

async function checkNoRatingPenalties() {
    try {
        // Βρες όλα τα requests που:
        // 1. Έχουν status 'picked_up'
        // 2. Δεν έχουν rating (NULL)
        // 3. Η παραλαβή (pickup_time) ήταν πριν 48+ ώρες
        const [expiredRequests] = await pool.query(`
            SELECT r.id, r.consumer_id, l.title
            FROM requests r
            JOIN listings l ON r.listing_id = l.id
            WHERE r.status = 'picked_up'
              AND r.rating IS NULL
              AND l.pickup_time <= NOW() - INTERVAL 48 HOUR
        `);

        if (expiredRequests.length === 0) {
            return; // Τίποτα προς επεξεργασία
        }

        console.log(`⏰ Βρέθηκαν ${expiredRequests.length} αιτήματα χωρίς αξιολόγηση (48h+). Εφαρμογή penalty...`);

        for (const req of expiredRequests) {
            // 1. Αφαίρεση 1 credit από τον consumer
            await pool.query(
                'UPDATE users SET credits = GREATEST(credits - 1, 0) WHERE id = ?',
                [req.consumer_id]
            );

            // 2. Σημείωση: βάζουμε rating = -1 (sentinel) ώστε να μη ξαναεπεξεργαστεί
            await pool.query(
                'UPDATE requests SET rating = -1 WHERE id = ?',
                [req.id]
            );

            console.log(`   ❌ Penalty: Consumer #${req.consumer_id} → -1 credit (δεν αξιολόγησε: "${req.title}")`);
        }

        console.log(`✅ Ολοκληρώθηκε ο έλεγχος no-rating penalty.`);

    } catch (error) {
        console.error('❌ Σφάλμα στον έλεγχο no-rating penalty:', error);
    }
}

/**
 * Εκκίνηση του scheduler.
 * Τρέχει κάθε 1 ώρα (3600000 ms).
 */
function startPenaltyScheduler() {
    console.log('🕐 No-Rating Penalty Scheduler ξεκίνησε (κάθε 1 ώρα)');
    
    // Πρώτος έλεγχος μετά από 10 δευτερόλεπτα (αφού ξεκινήσει ο server)
    setTimeout(checkNoRatingPenalties, 10000);
    
    // Μετά, κάθε 1 ώρα
    setInterval(checkNoRatingPenalties, 60 * 60 * 1000);
}

module.exports = { startPenaltyScheduler, checkNoRatingPenalties };
