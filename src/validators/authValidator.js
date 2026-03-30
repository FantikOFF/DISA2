const { body } = require('express-validator');

exports.registerValidation = [
    body('username').isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
];

exports.loginValidation = [
    body('email').isEmail(),
    body('password').notEmpty(),
];