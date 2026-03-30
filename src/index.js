const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');

const app = express(); // 🔥 ВОТ ЭТО ГЛАВНОЕ

app.use(cors());
app.use(express.json());

// статика (HTML)
app.use(express.static(path.join(__dirname, '../public')));

// API
app.use('/auth', authRoutes);

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});