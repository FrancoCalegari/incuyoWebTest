/**
 * INCUYO Web — Express Server
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── View Engine ─────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Middleware ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'incuyo-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
}));

// ─── Routes ─────────────────────────────────────────
app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));


// ─── Gemini Chatbot Proxy (módulo separado en lib/chatbot.js) ────────────────
const { handleChat } = require('./lib/chatbot');
app.post('/api/chat', handleChat);

// ─── Start Server ───────────────────────────────────
app.listen(PORT, async () => {
    console.log(`\n🚀 Instituto INCUYO Server running at http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`\nPress Ctrl+C to stop.\n`);

});

