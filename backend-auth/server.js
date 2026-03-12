const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors()); 
app.use(express.json()); 

// 1. Connection to Database (This helps fulfill the "Data Tables" requirement)
const PORT = process.env.PORT || 5000;
// Note: Vitoria will replace this URL later with a real MongoDB Cloud link
const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Wellness Database Connected!'))
  .catch((err) => console.log('❌ Connection Error:', err));

// ==========================================
// ROUTES (Connecting to your Proposal Goals)
// ==========================================

// Login & Registration [cite: 22, 28]
app.post('/api/auth/register', (req, res) => {
    res.send("User registration logic goes here");
});

// Services (Gym, Pilates, Spa, Massage) [cite: 12, 23]
app.get('/api/services', (req, res) => {
    res.json([
        { name: "Pilates", duration: "60 min" },
        { name: "Spa", duration: "45 min" }
    ]);
});

// Admin Approval/Rejection Workflow [cite: 14, 42]
app.patch('/api/admin/requests/:id', (req, res) => {
    res.send("Admin approval/rejection logic goes here");
});

// Appointment Booking & Conflict Handling [cite: 26, 42, 45]
app.post('/api/bookings', (req, res) => {
    res.send("Logic to check for overlapping appointments goes here");
});

app.listen(PORT, () => {
  console.log(`🚀 Server spinning at http://localhost:${PORT}`);
});