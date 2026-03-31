const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const os = require('os');

// ← Подключаем роуты
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const systemRoutes = require('./routes/systemRoutes');
const { logEvent } = require('./services/activityService');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// API Роуты
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/system', systemRoutes);

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

function getLocalUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  for (const iface of Object.values(interfaces)) {
    for (const net of iface || []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }

  return urls;
}

app.listen(PORT, HOST, () => {
  logEvent({
    action: 'Сервер запущен',
    details: `http://localhost:${PORT}`,
    username: 'system',
    role: 'system',
  });

  console.log(`✅ Server started on http://localhost:${PORT}`);

  const lanUrls = getLocalUrls(PORT);
  if (lanUrls.length) {
    console.log('📱 Local network access:');
    lanUrls.forEach((url) => console.log(`   ${url}`));
  }
});