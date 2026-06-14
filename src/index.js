require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// === CORS Configuration ===
// [SERVER] Uncomment block ini untuk production server
const allowedOrigins = [
  "http://localhost:5173",
  "https://fintrack.arijiq.net"
];

// Middleware
app.use(helmet());

// [LOCAL] Comment block ini jika di server
// app.use(cors({
//   origin: process.env.FRONTEND_URL || 'http://localhost:5173',
//   credentials: true,
//   exposedHeaders: ['RateLimit-Reset', 'RateLimit-Limit', 'RateLimit-Remaining']
// }));

// [SERVER] Uncomment block ini untuk production server
app.use(cors({
  origin: function (origin, callback) {
    // allow mobile apps / curl
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  exposedHeaders: [
    'RateLimit-Reset',
    'RateLimit-Limit',
    'RateLimit-Remaining'
  ]
}));

app.use(express.json());
app.use(cookieParser());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fintrack')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/funds', require('./routes/fundRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/salary-cycles', require('./routes/salaryCycleRoutes'));

app.get("/", (req, res) => {
  res.send("Fintrack API is running...");
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
