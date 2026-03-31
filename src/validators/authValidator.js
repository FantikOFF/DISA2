const { body } = require('express-validator');

exports.registerValidation = [
    body('username').isLength({ min: 3 }).withMessage('Логин должен быть не короче 3 символов'),
    body('email').isEmail().withMessage('Введите корректный email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не короче 6 символов'),
];

exports.loginValidation = [
    body('password').notEmpty().withMessage('Введите пароль'),
    body().custom((value) => {
        if (!value.username && !value.email) {
            throw new Error('Введите логин или email');
        }
        return true;
    }),
];