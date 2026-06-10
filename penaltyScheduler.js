const pool = require('./config/db');

/**
 * Penalty για μη-αξιολόγηση εντός 48 ωρών.
 * Όποιος παρέλαβε φαγητό αλλά δεν βαθμολόγησε μέσα σε 48 ώρες χάνει 1 credit.
 * Βάζουμε rating = -1 (sentinel) ώστε το ίδιο request να μην ξαναχρεωθεί.
 */

async function checkNoRatingPenalties() {
    try {
        // Παραλαβές 48+ ωρών που έμειναν χωρίς βαθμολογία
        const [expiredRequests] = await pool.query(`
            SELECT r.id, r.consumer_id, l.title
            FROM requests r
            JOIN listings l ON r.listing_id = l.id
            WHERE r.status = 'picked_up'
              AND r.rating IS NULL
              AND l.pickup_time <= NOW() - INTERVAL 48 HOUR
        `);

        if (expiredRequests.length === 0) {
            return; // δεν εκκρεμεί τίποτα
        }

        console.log(`⏰ Βρέθηκαν ${expiredRequests.length} αιτήματα χωρίς αξιολόγηση (48h+). Εφαρμογή penalty...`);

        for (const req of expiredRequests) {
            // -1 credit στον consumer
            await pool.query(
                'UPDATE users SET credits = GREATEST(credits - 1, 0) WHERE id = ?',
                [req.consumer_id]
            );

            // μαρκάρουμε ως ελεγμένο για να μην ξαναχρεωθεί
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
 * Ξεκινά τον scheduler: πρώτος έλεγχος λίγο μετά το boot, μετά κάθε ώρα.
 */
function startPenaltyScheduler() {
    console.log('🕐 No-Rating Penalty Scheduler ξεκίνησε (κάθε 1 ώρα)');

    // μικρή καθυστέρηση ώστε να έχει σηκωθεί ο server
    setTimeout(checkNoRatingPenalties, 10000);

    setInterval(checkNoRatingPenalties, 60 * 60 * 1000);
}

module.exports = { startPenaltyScheduler, checkNoRatingPenalties };
