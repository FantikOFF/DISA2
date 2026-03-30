const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Получить все встречи
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM meetings 
            ORDER BY reception_date DESC, created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении встреч' });
    }
});

// Обновить статус встречи
router.put('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const result = await pool.query(`
            UPDATE meetings 
            SET status = $1, updated_at = NOW() 
            WHERE id = $2 
            RETURNING *
        `, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при обновлении статуса' });
    }
});

module.exports = router;