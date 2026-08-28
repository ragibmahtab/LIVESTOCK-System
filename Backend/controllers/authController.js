const connectDB = require("../db");
const oracledb = require("oracledb");


async function login(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const username = req.body.username;
        const password = req.body.password;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Check username/password
        // =================================

        const result = await connection.execute(

            `SELECT USER_ID
             FROM USER_INFO
             WHERE USERNAME = :username
             AND PASSWORD = :password`,

            {
                username: username,
                password: password
            }
        );


        // =================================
        // Step 4: Invalid login
        // =================================

        if (result.rows.length === 0) {

            return res.json({
                success: false,
                message: "Invalid username or password"
            });
        }


        // =================================
        // Step 5: Get USER_ID
        // =================================

        const userId = result.rows[0].USER_ID;

        console.log("Logged in USER_ID:", userId);


        // =================================
        // Step 6: Call PL/SQL procedure
        // =================================

        const roleResult = await connection.execute(

            `BEGIN
                get_user_role(:userId, :role);
             END;`,

            {
                userId: userId,

                role: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.STRING,
                    maxSize: 50
                }
            }
        );


        // =================================
        // Step 7: Get role from procedure
        // =================================

        const role = roleResult.outBinds.role;

        console.log("User role:", role);


        // =================================
        // Step 8: Check whether role exists
        // =================================

        if (!role) {

            return res.json({
                success: false,
                message: "User role could not be determined"
            });
        }


        // =================================
        // Step 9: Send result to frontend
        // =================================

        res.json({
            success: true,
            message: "Login successful",
            role: role,
            userId: userId
        });


    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });


    } finally {

        if (connection) {
            await connection.close();
        }
    }
}


module.exports = {
    login
};