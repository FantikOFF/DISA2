const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { logEvent } = require('../services/activityService');

const allowedStatuses = new Set(['Новая', 'В работе', 'Завершена', 'Отменена']);
const allowedTypes = new Set(['Тип заказа', 'Консультация', 'Осмотр', 'Ремонт', 'Доставка', 'Другое']);
const requiredCreateFields = {
    type: 'Тип работ',
    reception_date: 'Дата приёма',
    time: 'Время',
    client: 'Клиент',
    client_phone: 'Телефон',
    model: 'Модель',
    brand: 'Марка',
    license_plate: 'Гос. номер',
    vin: 'VIN',
    reason: 'Причина обращения',
    notes: 'Примечание',
};

router.use(authenticateToken);

function isAdminRequest(req) {
    return req.user?.role === 'admin';
}

function getRequesterId(req) {
    const userId = Number(req.user?.id);
    return Number.isFinite(userId) ? userId : null;
}

function isMeetingOwner(meeting, req) {
    const requesterId = getRequesterId(req);
    if (!requesterId || !meeting) return false;

    return Number(meeting.user_id) === requesterId || Number(meeting.created_by) === requesterId;
}

async function getMeetingById(id) {
    const result = await pool.query('SELECT * FROM meetings WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] || null;
}

// Получить встречи: список виден всем авторизованным пользователям
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM meetings
            ORDER BY reception_date DESC NULLS LAST, time DESC NULLS LAST, created_at DESC NULLS LAST
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Meetings fetch error:', err);
        res.status(500).json({ error: 'Ошибка при получении встреч' });
    }
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const meeting = await getMeetingById(id);

        if (!meeting) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        res.json(meeting);
    } catch (err) {
        console.error('Meeting details fetch error:', err);
        res.status(500).json({ error: 'Ошибка при получении заявки' });
    }
});

// Создать новую встречу
router.post('/', async (req, res) => {
    const {
        type,
        number,
        reception_date,
        time,
        client,
        client_phone,
        model,
        brand,
        license_plate,
        vin,
        reason,
        notes,
        assigned_to,
        created_by,
        user_id,
    } = req.body;

    const normalizedPayload = {
        type: String(type ?? '').trim(),
        reception_date: String(reception_date ?? '').trim(),
        time: String(time ?? '').trim(),
        client: String(client ?? '').trim(),
        client_phone: String(client_phone ?? '').trim(),
        model: String(model ?? '').trim(),
        brand: String(brand ?? '').trim(),
        license_plate: String(license_plate ?? '').trim(),
        vin: String(vin ?? '').trim(),
        reason: String(reason ?? '').trim(),
        notes: String(notes ?? '').trim(),
    };

    const missingFields = Object.entries(requiredCreateFields)
        .filter(([key]) => !normalizedPayload[key])
        .map(([, label]) => label);

    if (missingFields.length) {
        return res.status(400).json({
            error: `Заполните все поля заявки: ${missingFields.join(', ')}`,
        });
    }

    if (!allowedTypes.has(normalizedPayload.type)) {
        return res.status(400).json({ error: 'Недопустимый тип заявки' });
    }

    try {
        const requesterId = getRequesterId(req);
        const createdById = Number(created_by);
        const requestedUserId = Number(user_id);
        const ownerId = isAdminRequest(req) && Number.isFinite(requestedUserId) ? requestedUserId : requesterId;
        const authorId = isAdminRequest(req) && Number.isFinite(createdById) ? createdById : requesterId;

        const result = await pool.query(`
            INSERT INTO meetings (
                status, type, number, reception_date, time, client, client_phone,
                model, brand, license_plate, vin, reason, notes, assigned_to, created_by, user_id
            ) VALUES (
                $1, $2, COALESCE($3, CONCAT('REQ-', EXTRACT(EPOCH FROM NOW())::bigint::text)),
                $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
            RETURNING *
        `, [
            'Новая',
            normalizedPayload.type,
            number || null,
            normalizedPayload.reception_date,
            normalizedPayload.time,
            normalizedPayload.client,
            normalizedPayload.client_phone,
            normalizedPayload.model,
            normalizedPayload.brand,
            normalizedPayload.license_plate,
            normalizedPayload.vin,
            normalizedPayload.reason,
            normalizedPayload.notes,
            assigned_to || null,
            authorId,
            ownerId,
        ]);

        logEvent({
            action: 'Создал новую заявку',
            details: `${normalizedPayload.type} • ${normalizedPayload.brand} ${normalizedPayload.model}`,
            userId: req.user?.id,
            username: req.user?.username,
            role: req.user?.role,
        });

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Meeting create error:', err);
        res.status(500).json({ error: 'Ошибка при создании заявки' });
    }
});

// Обновить статус встречи
router.put('/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!allowedStatuses.has(status)) {
        return res.status(400).json({ error: 'Недопустимый статус' });
    }

    try {
        const meeting = await getMeetingById(id);

        if (!meeting) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        if (!isAdminRequest(req) && !isMeetingOwner(meeting, req)) {
            return res.status(403).json({ error: 'Нельзя менять чужую заявку' });
        }

        const result = await pool.query(`
            UPDATE meetings
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [status, id]);

        logEvent({
            action: 'Изменил статус заявки',
            details: `#${id} → ${status}`,
            userId: req.user?.id,
            username: req.user?.username,
            role: req.user?.role,
        });

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Meeting status update error:', err);
        res.status(500).json({ error: 'Ошибка при обновлении статуса' });
    }
});

module.exports = router;