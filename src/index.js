require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// ← Подключаем роуты
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');   // ← Новый роут

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// API Роуты
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);     // ← Подключили встречи

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});