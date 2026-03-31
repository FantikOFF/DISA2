const express = require('express');
const router = express.Router();

const { register, login, logout, listUsers, updateManagedUser, deleteManagedUser, getMe } = require('../controllers/authController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');
const validationMiddleware = require('../middlewares/validationMiddleware');
const { registerValidation, loginValidation } = require('../validators/authValidator');

router.post('/register', registerValidation, validationMiddleware, register);
router.post('/login', loginValidation, validationMiddleware, login);
router.post('/logout', authenticateToken, logout);
router.get('/users', authenticateToken, isAdmin, listUsers);
router.patch('/users/:id', authenticateToken, isAdmin, updateManagedUser);
router.delete('/users/:id', authenticateToken, isAdmin, deleteManagedUser);
router.get('/me', authenticateToken, getMe);

module.exports = router;