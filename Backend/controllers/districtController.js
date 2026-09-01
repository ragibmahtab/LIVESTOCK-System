const connectDB = require("../db");
const oracledb = require("oracledb");


// =====================================================
// Dashboard Overview
// =====================================================

async function getDashboardStats(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get officer id from frontend
        // =================================

        const officerId = Number(req.query.officerId);


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Total upazilas covered by this district
        // =================================

        const totalUpazilasResult = await connection.execute(

            `SELECT COUNT(*) AS TOTAL
             FROM Upazila_Office
             WHERE Dist_ID = (
             SELECT Dist_ID FROM District_Office WHERE Dist_Off_ID = :officerId
             )`,

            { officerId: officerId }
        );


        // =================================
        // Step 4: Pending upazila demand requests (not yet forwarded)
        // =================================

        const pendingRequestsResult = await connection.execute(

            `select count(*) as total from Demand_Request where Revision_Officer_ID = :officerId and Status = 'Pending'`,
            { officerId: officerId }
        );


        // =================================
        // Step 5: Requests forwarded this month
        // =================================

        // const forwardedResult = await connection.execute(
        //     // TODO: write query here
        //     // Count of Demand_Request where Revision_Officer_ID = :officerId
        //     // AND Status = 'Forwarded' AND Submission_Date within current month
        //     ``,
        //     { officerId: officerId }
        // );


        // =================================
        // Step 6: Recent upazila demand requests for the table
        // =================================

        const recentRequestsResult = await connection.execute(
            `SELECT Demand_Request_ID,
       Upz_Name,
       Item_Name,
       Quantity,
       Status,
       TO_CHAR(Submission_Date, 'DD-MON-YYYY') AS Submission_Date
FROM DISTRICT_DEMAND_REQUESTS
WHERE Revision_Officer_ID = :officerId
AND Submission_Date BETWEEN (SYSDATE - 250) AND SYSDATE
ORDER BY Submission_Date DESC`,
            { officerId: officerId }
        );

        // =================================
        // Step 7: Send everything back to frontend
        // =================================

        res.json({
            totalUpazilas: totalUpazilasResult.rows[0].TOTAL,
            pendingRequests: pendingRequestsResult.rows[0].TOTAL,
            forwardedRequests: 0,
            recentRequests: recentRequestsResult.rows
        });

    } catch (error) {

        console.error("Dashboard stats error:", error);

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


// =====================================================
// View Profile
// =====================================================

async function getProfile(req, res) {

    let connection;

    try {

        const officerId = req.query.officerId;

        connection = await connectDB();

        const result = await connection.execute(


            `select name,email,phones,Dist_name from
             District_Officer_Profile where user_id = :officerId`,

            { officerId: officerId }
        );

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                message: "Profile not found"
            });
        }

        const phoneResult = await connection.execute(
            `SELECT Phone FROM User_Phone WHERE User_ID = :officerId`,
            { officerId: officerId }
        );

        const profile = result.rows[0];
        profile.PHONE_LIST = phoneResult.rows.map(row => row.PHONE);

        res.json(profile);

    } catch (error) {

        console.error("Get profile error:", error);

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


// =====================================================
// Edit Profile
// =====================================================

async function updateProfile(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const officerId = req.body.officerId;
        const name = req.body.name || null;
        const email = req.body.email || null;
        const password = req.body.password || null;
        const phones = req.body.phones || []; // [{ oldPhone, newPhone }, ...]


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Update USER_INFO
        // =================================

        await connection.execute(

            // TODO: write query here
            // Same pattern as Upazila_Office's UPDATE_OFFICER_PROFILE:
            // UPDATE USER_INFO SET Name = NVL(:name, Name), Email = NVL(:email, Email),
            // Password = NVL(:password, Password) WHERE User_ID = :officerId
            ``,

            { name, email, password, officerId }
        );


        // =================================
        // Step 4: Update / insert / remove phone numbers
        // =================================

        for (const entry of phones) {

            if (entry.oldPhone && entry.newPhone) {
                // Editing an existing number
                await connection.execute(
                    `UPDATE User_Phone SET Phone = :newPhone
                     WHERE User_ID = :officerId AND Phone = :oldPhone`,
                    { newPhone: entry.newPhone, officerId, oldPhone: entry.oldPhone }
                );

            } else if (!entry.oldPhone && entry.newPhone) {
                // A brand new number
                await connection.execute(
                    `INSERT INTO User_Phone (User_ID, Phone) VALUES (:officerId, :newPhone)`,
                    { officerId, newPhone: entry.newPhone }
                );

            } else if (entry.oldPhone && !entry.newPhone) {
                // Row cleared out — treat as delete
                await connection.execute(
                    `DELETE FROM User_Phone WHERE User_ID = :officerId AND Phone = :oldPhone`,
                    { officerId, oldPhone: entry.oldPhone }
                );
            }
        }

        await connection.commit();


        // =================================
        // Step 5: Send result to frontend
        // =================================

        res.json({
            success: true,
            message: "Profile updated"
        });

    } catch (error) {

        console.error("Update profile error:", error);

        if (error.errorNum === 1) {
            return res.status(400).json({
                success: false,
                message: "That email or phone number is already in use on another account."
            });
        }

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


// =====================================================
// View Upazila Requests
// =====================================================

async function getUpazilaRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        // Step 1: run the check — this throws if nothing is pending
        await connection.execute(
            `BEGIN CHECK_PENDING_UPAZILA_REQUESTS(:officerId); END;`,
            { officerId: officerId }
        );

        // Step 2: no exception was raised, so it's safe to run the real query
        const result = await connection.execute(
            `SELECT Demand_Request_ID,
       Upz_Name,
       Item_ID,
       Item_Name,
       Quantity,
       Estimated_Cost,
       Status,
       TO_CHAR(Submission_Date, 'DD-MON-YYYY') AS Submission_Date
FROM DISTRICT_DEMAND_REQUESTS
WHERE Revision_Officer_ID = :officerId
AND Status = 'Pending'
ORDER BY Submission_Date DESC`,
            { officerId: officerId }
        );

        res.json(result.rows);

    } catch (error) {

        if (error.errorNum === 20001) {
            return res.status(404).json({ message: 'No pending demand requests found for this district officer.' });
        }

        console.error("Get upazila requests error:", error);

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
// =====================================================
// Dropdown: upazilas under this district officer
// =====================================================

async function getDistrictUpazilas(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        const result = await connection.execute(
            `SELECT Upz_Name
             FROM Upazila_Office
             WHERE Dist_ID = (SELECT Dist_ID FROM District_Office WHERE Dist_Off_ID = :officerId)
             ORDER BY Upz_Name`,
            { officerId: officerId }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get district upazilas error:", error);

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


// =====================================================
// Search: requests for a specific selected upazila
// =====================================================

async function searchUpazilaRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);
        const selectedName = req.query.upzName;

        connection = await connectDB();

        const result = await connection.execute(
            `SELECT Demand_Request_ID,
       Upz_Name,
       Item_ID,
       Item_Name,
       Quantity,
       Estimated_Cost,
       Status,
       TO_CHAR(Submission_Date, 'DD-MON-YYYY') AS Submission_Date
       FROM DISTRICT_DEMAND_REQUESTS
       WHERE Revision_Officer_ID = :officerId
       AND Status = 'Pending'
       AND Upz_Name IN (
       SELECT Upz_Name FROM Upazila_Office
       WHERE Upz_Name = :selectedName
       AND Dist_ID = (SELECT Dist_ID FROM District_Office WHERE Dist_Off_ID = :officerId)
       )
       ORDER BY Submission_Date DESC`,
            { officerId: officerId, selectedName: selectedName }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Search upazila requests error:", error);

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

// =====================================================
// View Store Inventory (for the Inventory modal on
// View Upazila Requests)
// =====================================================

async function getStoreInventory(req, res) {

    let connection;

    try {

        const itemId = req.query.itemId;

        connection = await connectDB();

        const result = await connection.execute(
            `SELECT Name, Current_Stock, Minimum_Quantity
     FROM Item
     WHERE Item_ID = :itemId`,
            { itemId }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get store inventory error:", error);

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
    getDashboardStats,
    getProfile,
    updateProfile,
    getUpazilaRequests,
    getDistrictUpazilas,
    searchUpazilaRequests,
    getStoreInventory
};
