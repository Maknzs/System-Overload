require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');

const app = express();
app.use(express.json());
app.use(helmet());

// Rate limiting (auth-heavy routes)
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 100 });
app.use('/api/auth', authLimiter);
const accountLimiter = rateLimit({ windowMs: 15*60*1000, max: 200 });
app.use('/api/account', accountLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8080;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`API listening on :${PORT}`));
  } catch (e) {
    console.error('Failed to start API', e);
    process.exit(1);
  }
}

start();
