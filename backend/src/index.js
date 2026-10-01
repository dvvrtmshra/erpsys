const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const pool = require('./db');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', require('express').static(require('path').join(__dirname, '../../uploads')));

app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
  },
}));

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/catalog', require('./modules/catalog/catalog.routes'));
app.use('/api/inventory', require('./modules/inventory/inventory.routes'));
app.use('/api/suppliers', require('./modules/suppliers/suppliers.routes'));
app.use('/api/customers', require('./modules/customers/customers.routes'));
app.use('/api/orders', require('./modules/orders/orders.routes'));
app.use('/api/purchases', require('./modules/purchases/purchases.routes'));
app.use('/api/tenders', require('./modules/tenders/tenders.routes'));
app.use('/api/accounting', require('./modules/accounting/accounting.routes'));
app.use('/api/users', require('./modules/users/users.routes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
