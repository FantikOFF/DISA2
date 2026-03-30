const bcrypt = require('bcrypt');
const { createUser, getUserByEmail } = require('../models/userModel');

// регистрация
exports.register = async (req, res) => {
    const { username, email, password } = req.body;

    console.log("REGISTER DATA:", username, email, password); // 👈

    try {
        const hash = await bcrypt.hash(password, 10);

        const user = await createUser(username, email, hash);

        console.log("USER CREATED:", user); // 👈

        res.json(user);
    } catch (err) {
        console.log("ERROR:", err); // 👈 САМОЕ ВАЖНОЕ
        res.status(500).json({ error: 'Ошибка регистрации' });
    }
};

// логин
exports.login = async (req, res) => {
    const { email, password } = req.body;

    // 👑 админ (захардкожен)
    if (email === 'admin@mail.com' && password === 'admin123') {
        return res.json({ role: 'admin' });
    }

    try {
        const user = await getUserByEmail(email);

        if (!user) {
            return res.status(400).json({ error: 'Пользователь не найден' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return res.status(400).json({ error: 'Неверный пароль' });
        }

        res.json({ role: 'user' });

    } catch (err) {
        res.status(500).json({ error: 'Ошибка входа' });
    }
};