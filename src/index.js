require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Nginx, Cloudflare, etc.)
const PORT = process.env.PORT || 5000;

// === CORS Configuration ===
// [SERVER] Uncomment block ini untuk production server
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://fintrack.arijiq.net"
// ];

// CORS Configuration
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173'];

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
  exposedHeaders: ['RateLimit-Reset', 'RateLimit-Limit', 'RateLimit-Remaining']
}));

// Middleware
const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      connectSrc: ["'self'", "http://localhost:5000", "http://localhost:5173", "https://fintrack.arijiq.net"]
    },
  },
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
app.use('/api/ai', require('./routes/aiRoutes'));

app.get("/", (req, res) => {
  res.send("Fintrack API is running...");
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.status || 500;
  
  if (process.env.NODE_ENV === 'production') {
    return res.status(status).json({ message: 'Internal Server Error' });
  }
  
  return res.status(status).json({ 
    message: 'Internal Server Error', 
    error: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
