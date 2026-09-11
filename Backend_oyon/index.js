const express = require('express');
const cors = require('cors');
require('dotenv').config();
const oracledb = require('oracledb');
const { executeQuery } = require('./db');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/api/project-director', require('./proDirRoutes'));
app.use('/api/director-planning', require('./dirPlanRoutes'));

// Login authentication matching the ACTUAL schema (Username/Password + get_user_role procedure)
app.post('/api/auth/login', async (req, res) => {
    const { user_name, password } = req.body;

    try {
        // Step 1: check username + password against USER_INFO
        const userResult = await executeQuery(
            `SELECT USER_ID FROM USER_INFO WHERE USERNAME = :username AND PASSWORD = :password`,
            { username: user_name, password: password }
        );

        if (!userResult.rows || userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Username or Password'
            });
        }

        const userId = userResult.rows[0].USER_ID;

        // Step 2: get role via the get_user_role PL/SQL procedure
        const roleResult = await executeQuery(
            `BEGIN get_user_role(:userId, :role); END;`,
            {
                userId: userId,
                role: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 50 }
            }
        );

        const role = roleResult.outBinds.role;

        if (!role) {
            return res.status(401).json({
                success: false,
                message: 'User role could not be determined'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
                id: userId,
                role: role
            }
        });

    } catch (err) {
        console.error('Database Query Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Database Error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));