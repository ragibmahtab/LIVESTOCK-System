const connectDB = require("../db");
const oracledb = require("oracledb");


// =====================================================
// Dashboard Overview
// =====================================================

async function getDashboardStats(req, res) {

    //console.log("=== DASHBOARD STATS HANDLER FIRING - CHECKPOINT A ===");
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

            // TODO: write query here
            // Expected: one row, one column -> total item count
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

            // TODO: write query here
            // Expected: one row, one column -> count of Demand_Request where Status = 'Pending'
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


        // // =================================
        // // Step 6: Recent demand applications for the table
        // // =================================

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

            // TODO: write query here
            // Join USER_INFO + Upazila_Office (+ User_Phone) for this officer
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

        res.json(result.rows[0]);

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
        const name = req.body.name;
        const email = req.body.email;
        const phone = req.body.phone;
        const password = req.body.password;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Update USER_INFO
        // =================================

        await connection.execute(

            // TODO: write query here
            // Update Name / Email, and Password only if one was provided
            ``,

            { officerId: officerId, name: name, email: email, password: password },
            { autoCommit: true }
        );


        // =================================
        // Step 4: Update phone number
        // =================================

        await connection.execute(

            // TODO: write query here
            // Update or insert into User_Phone
            ``,

            { officerId: officerId, phone: phone },
            { autoCommit: true }
        );


        // =================================
        // Step 5: Send result to frontend
        // =================================

        res.json({
            success: true,
            message: "Profile updated"
        });

    } catch (error) {

        console.error("Update profile error:", error);

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

            // TODO: write query here
            // Insert into Demand_Request (Demand_Request_ID, Item_ID,
            // Submission_Officer_ID, Revision_Officer_ID, Quantity,
            // Submission_Date, Estimated_Cost, Status)
            //
            // NOTE: Revision_Officer_ID (District_Office) and a generated
            // Demand_Request_ID both need a source before this will run.
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

        const officerId = req.query.officerId;

        connection = await connectDB();

        const result = await connection.execute(

            // TODO: write query here
            // Demand_Request joined to Item, filtered to this officer, latest first
            ``,

            { officerId: officerId }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get demand requests error:", error);

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
// Record Item Usage & Distribution
// =====================================================

async function recordItemUsage(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const officerId = req.body.officerId;
        const itemId = req.body.itemId;
        const quantity = req.body.quantity;
        const purpose = req.body.purpose;
        const usageDate = req.body.usageDate;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Insert into Item_Usage
        // =================================

        const usageResult = await connection.execute(

            // TODO: write query here
            // Insert into Item_Usage (Item_Usage_ID, Purpose, Upazila_Officer_ID)
            // Return the new Item_Usage_ID with a RETURNING clause so Step 4 can use it
            ``,

            { officerId: officerId, purpose: purpose }
        );


        // =================================
        // Step 4: Insert into Uses
        // =================================

        await connection.execute(

            // TODO: write query here
            // Insert into Uses (Usage_ID, Item_ID, Quantity, Usage_Date)
            ``,

            { itemId: itemId, quantity: quantity, usageDate: usageDate },
            { autoCommit: true }
        );


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

            // TODO: write query here
            // Item_Usage joined to Uses + Item, filtered to this officer, latest first
            ``,

            { officerId: officerId }
        );

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
