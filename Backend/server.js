// const express = require("express");

// const authRoutes = require("./routes/authRoutes");
// const upazilaRoutes = require("./routes/upazilaRoutes");

// const app = express();

// // Allow the static frontend to call this API during local development.
// app.use((req, res, next) => {
//     res.header("Access-Control-Allow-Origin", "*");
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//     res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
//     if (req.method === "OPTIONS") {
//         return res.sendStatus(204);
//     }
//     next();
// });

// // Allows Node.js to understand JSON sent from frontend
// app.use(express.json());

// // Connect our login routes
// app.use(authRoutes);
// app.use(upazilaRoutes);

// // Start server
// app.listen(3000, () => {
//     console.log("Server is running on port 3000");
// });



const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { executeQuery } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Direct login authentication using USER_INFO table
app.post('/api/auth/login', async (req, res) => {
    const { user_name, password, role } = req.body;

    try {
        const query = `
            SELECT USER_ID, USER_NAME, ROLE, CADRE_NO 
            FROM USER_INFO 
            WHERE (USER_NAME = :user_name OR TO_CHAR(USER_ID) = :user_name)
              AND PASSWORD = :password 
              AND ROLE = :role
        `;
        const result = await executeQuery(query, [user_name, user_name, password, role]);

        if (result.rows && result.rows.length > 0) {
            const user = result.rows[0];
            return res.status(200).json({
                success: true,
                message: 'Login successful',
                user: {
                    id: user.USER_ID,
                    userName: user.USER_NAME,
                    role: user.ROLE,
                    cadreNo: user.CADRE_NO
                }
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Invalid Username, Password, or Role'
        });
    } catch (err) {
        console.error('Database Query Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Database Error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));