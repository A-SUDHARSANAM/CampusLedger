import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'Terminal Online', system: 'Campus Ledger Backend' });
});

app.listen(PORT, () => {
    console.log(`Backend Terminal Active on port ${PORT}`);
});
