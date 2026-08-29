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
        // Step 3: Total available items in this officer's store(s)
        // =================================

        const totalItemsResult = await connection.execute(
            `SELECT COUNT(*) AS TOTAL_ITEMS
             FROM Item
             WHERE Store_ID = (
               SELECT Store_ID
               FROM Store
               WHERE Upazila_Officer_ID = :officerId
                )`,
            { officerId: officerId }
        );


        // =================================
        // Step 4: Pending demand applications for this officer
        // =================================

        const pendingDemandsResult = await connection.execute(
            `SELECT COUNT(*) AS PENDING_DEMANDS
             FROM Demand_Request
             WHERE Submission_Officer_ID = :officerId
             AND Status = 'Pending'`,
            { officerId: officerId }
        );


        // =================================
        // Step 5: Vaccine/feed distributed (sum of Uses.Quantity)
        // =================================

        // const distributedResult = await connection.execute(
        //     // TODO: write query here
        //     ``,
        //     { officerId: officerId }
        // );


        // =================================
        // Step 6: Recent demand applications for the table
        // =================================

        // const recentDemandsResult = await connection.execute(
        //     // TODO: write query here
        //     // Expected: Demand_Request joined to Item, latest first
        //     ``,
        //     { officerId: officerId }
        // );


        // =================================
        // Step 7: Send everything back to frontend
        // =================================

        res.json({
            totalItems: totalItemsResult.rows[0] ? totalItemsResult.rows[0].TOTAL_ITEMS : 0,
            pendingDemands: pendingDemandsResult.rows[0] ? pendingDemandsResult.rows[0].PENDING_DEMANDS : 0,
            distributed: 0,
            recentDemands: []
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
            `select name,username,email,Upz_name,phones from
            Upazila_Officer_Profile where user_id = :officerId`,
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
            `UPDATE USER_INFO
             SET Name = NVL(:name, Name),
                 Email = NVL(:email, Email),
                 Password = NVL(:password, Password)
             WHERE User_ID = :officerId`,
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
// Inventory Store Check
// =====================================================

async function getInventory(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        const result = await connection.execute(
            `SELECT ITEM_ID, NAME, TYPE, CURRENT_STOCK, MINIMUM_QUANTITY
     FROM UPAZILA_STORE_ITEMS
     WHERE UPAZILA_OFFICER_ID = :officerId
            `,
            { officerId: officerId }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get inventory error:", error);

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
// Shared: item dropdown for Create Demand + Record Usage
// =====================================================

async function getItems(req, res) {

    let connection;

    try {

        const officerId = req.query.officerId;

        connection = await connectDB();

        const result = await connection.execute(

            // TODO: write query here
            // Item_ID + Name for items available to this officer's store(s)
            ``,

            { officerId: officerId }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get items error:", error);

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
// Create Demand Request
// =====================================================

async function createDemandRequest(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const officerId = req.body.officerId;
        const itemId = req.body.itemId;
        const quantity = req.body.quantity;
        const estimatedCost = req.body.estimatedCost;
        const submissionDate = req.body.submissionDate;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Insert the demand request
        // =================================

        await connection.execute(

            // TODO: write query here once Demand_Request_ID has a
            // sequence + trigger set up (same pattern as Item_Usage).
            //
            // Revision_Officer_ID lookup is already worked out — reuse this:
            //   (SELECT Dist_Off_ID FROM District_Office
            //    WHERE Dist_ID = (SELECT Dist_ID FROM Upazila_Office WHERE Off_ID = :officerId))
            //
            // Insert into Demand_Request (Item_ID, Submission_Officer_ID,
            // Revision_Officer_ID, Quantity, Submission_Date, Estimated_Cost, Status)
            ``,

            {
                officerId: officerId,
                itemId: itemId,
                quantity: quantity,
                estimatedCost: estimatedCost,
                submissionDate: submissionDate
            },
            { autoCommit: true }
        );


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json({
            success: true,
            message: "Demand request submitted"
        });

    } catch (error) {

        console.error("Create demand request error:", error);

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
// Demand Application Status
// =====================================================

async function getDemandRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);
        const status = req.query.status;
        connection = await connectDB();
        const result = await connection.execute(
            `SELECT 
    DR.Demand_Request_ID,
    I.Name              AS Item_Name,
    DR.Quantity         AS Quantity,
    DR.Estimated_Cost,
    TO_CHAR(DR.Submission_Date, 'DD-MON-YYYY') AS Submission_Date,
    DR.Status
FROM Demand_Request DR
JOIN Item I 
    ON DR.Item_ID = I.Item_ID
WHERE DR.Submission_Officer_ID = :officerId
ORDER BY DR.Submission_Date DESC`,
            { officerId }
        );
        await connection.close();
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch demand requests' });
    }
}


// =====================================================
// Record Item Usage & Distribution
// =====================================================

async function recordItemUsage(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const officerId = req.body.officerId;
        const purpose = req.body.purpose;
        const usageDate = req.body.usageDate;
        const items = req.body.items; // [{ itemId, quantity }, ...]


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Insert into Item_Usage, get back the new ID
        // =================================

        const usageResult = await connection.execute(

            // TODO: write query here once Item_Usage_ID has its
            // sequence + trigger set up.
            // Insert into Item_Usage (Purpose, Upazila_Officer_ID)
            // RETURNING Item_Usage_ID INTO :newId
            ``,

            {
                officerId: officerId,
                purpose: purpose,
                newId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            }
        );

        // const newUsageId = usageResult.outBinds.newId[0];


        // =================================
        // Step 4: Insert into Uses, one row per item
        // =================================

        for (const entry of items) {
            await connection.execute(

                // TODO: write query here
                // Insert into Uses (Usage_ID, Item_ID, Quantity, Usage_Date)
                // bind: newUsageId, entry.itemId, entry.quantity, usageDate
                ``,

                { itemId: entry.itemId, quantity: entry.quantity, usageDate: usageDate }
            );
        }

        await connection.commit();


        // =================================
        // Step 5: Send result to frontend
        // =================================

        res.json({
            success: true,
            message: "Usage recorded"
        });

    } catch (error) {

        console.error("Record item usage error:", error);

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


async function getUsageHistory(req, res) {

    let connection;

    try {

        const officerId = req.query.officerId;

        connection = await connectDB();

        const result = await connection.execute(
            `SELECT Usage_ID  , Item_Name, Quantity, Purpose, to_char(Usage_Date, 'YYYY-MM-DD') as Usage_Date
     FROM OFFICER_USAGE_HISTORY
     WHERE Upazila_Officer_ID = :officerId
     ORDER BY Usage_Date DESC`,
            { officerId }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No usage history found for this officer.' });
        }
        res.json(result.rows);

    } catch (error) {

        console.error("Get usage history error:", error);

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
// Notifications
// =====================================================

async function getNotifications(req, res) {
    let connection;
    try {
        const officerId = req.query.officerId;
        connection = await connectDB();

        const result = await connection.execute(
            `BEGIN get_low_stock_notifications(:officerId, :messages); END;`,
            {
                officerId: officerId,
                messages: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
            }
        );

        const rawText = result.outBinds.messages || '';
        const notifications = rawText.split('\n').filter(line => line.trim() !== '');

        res.json(notifications);
    } catch (error) {
        console.error("Get notifications error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    } finally {
        if (connection) await connection.close();
    }
}


module.exports = {
    getDashboardStats,
    getProfile,
    updateProfile,
    getInventory,
    getItems,
    createDemandRequest,
    getDemandRequests,
    recordItemUsage,
    getUsageHistory,
    getNotifications
};