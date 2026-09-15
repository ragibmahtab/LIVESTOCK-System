const connectDB = require("../db");
const oracledb = require("oracledb");


// =====================================================
// View Profile
// =====================================================

async function getProfile(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get officer id from frontend
        // =================================

        const officerId = req.query.officerId;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Look up the profile
        // =================================

        const result = await connection.execute(
            `SELECT * FROM VW_PROJECT_DIRECTOR_PROFILE WHERE USER_ID = :officerId`,
            { officerId }
        );

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                message: "Profile not found"
            });
        }


        // =================================
        // Step 4: Attach phone number
        // =================================

        const phoneResult = await connection.execute(
            `SELECT PHONE FROM USER_PHONE WHERE USER_ID = :officerId`,
            { officerId }
        );

        const profile = result.rows[0];
        profile.PHONE = phoneResult.rows.length ? phoneResult.rows[0].PHONE : null;


        // =================================
        // Step 5: Send result to frontend
        // =================================

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
// Note: this dashboard's edit form has a single Mobile Number field
// (not a multi-phone add/remove list), so this replaces whatever phone
// was on file with the one submitted, same as the original behavior.
// User_Phone has no surrogate ID (PK is User_ID + Phone), so no
// sequence/trigger is needed here — just fill in the INSERT below.

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
        const phone = req.body.phone || null;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Update USER_INFO
        // =================================

        if (password) {
            await connection.execute(
                `UPDATE USER_INFO SET Name = :name, Email = :email, Password = :password WHERE User_ID = :officerId`,
                { name, email, password, officerId }
            );
        } else {
            await connection.execute(
                `UPDATE USER_INFO SET Name = :name, Email = :email WHERE User_ID = :officerId`,
                { name, email, officerId }
            );
        }


        // =================================
        // Step 4: Replace the phone number
        // =================================

        if (phone) {

            await connection.execute(
                `DELETE FROM USER_PHONE WHERE User_ID = :officerId`,
                { officerId }
            );

            
            await connection.execute(
                `INSERT INTO USER_PHONE (User_ID, Phone) VALUES (:officerId, :phone)`,
                { officerId, phone }
            );
        }


        // =================================
        // Step 5: Commit and respond
        // =================================

        await connection.commit();

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
// Project Details
// =====================================================
// FIXED: Project has flat Village / Union_Name / Upazila / District
// columns — there is no Location object type in the schema, so the
// old p.Location.Village-style dot access would have thrown at
// runtime. Rewritten to reference the columns directly.

async function getProjectDetails(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get officer id from frontend
        // =================================

        const officerId = req.query.officerId;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Look up the project this officer directs
        // =================================

        const result = await connection.execute(
            `SELECT p.Project_ID, p.Name, p.Start_Date, p.End_Date,
                    p.Village   AS VILLAGE,
                    p.Union_Name AS UNION_NAME,
                    p.Upazila   AS UPAZILA,
                    p.District  AS DISTRICT,
                    p.Type
             FROM Project p
             JOIN Project_Director pd ON pd.Project_ID = p.Project_ID
             WHERE pd.Project_Director_ID = :officerId`,
            { officerId }
        );

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                message: "Project not found"
            });
        }


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json(result.rows[0]);

    } catch (error) {

        console.error("Get project details error:", error);

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
// View Project Plan
// =====================================================

async function getPlan(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get officer id from frontend
        // =================================

        const officerId = req.query.officerId;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Fetch the plan rows for this officer's project
        // =================================

        const result = await connection.execute(
            `SELECT Fiscal_Year, Item_Name, Type, Quantity, Estimated_Cost
             FROM Plan
             WHERE Project_ID = (
                 SELECT Project_ID FROM Project_Director WHERE Project_Director_ID = :officerId
             )
             ORDER BY Fiscal_Year`,
            { officerId }
        );


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json(result.rows);

    } catch (error) {

        console.error("Get plan error:", error);

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
// Purchase Records (list)
// =====================================================

async function getPurchaseRecords(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get officer id from frontend
        // =================================

        const officerId = req.query.officerId;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Fetch this officer's purchase records
        // =================================

        const result = await connection.execute(
            `SELECT Purchase_Record_ID, Item_Name, Fiscal_Year, Cost, Purchase_Date, Quantity
             FROM Purchase_Record
             WHERE Project_Director_ID = :officerId
             ORDER BY Purchase_Date DESC`,
            { officerId }
        );


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json(result.rows);

    } catch (error) {

        console.error("Get purchase records error:", error);

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
// Purchase Summary
// =====================================================


async function getPurchaseSummary(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get officer id from frontend
        // =================================

        const officerId = req.query.officerId;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Call the summary procedure
        // =================================

        const result = await connection.execute(
            `BEGIN
                 PROC_PURCHASE_SUMMARY(:officerId, :totalCost, :recordCount);
             END;`,
            {
                officerId,
                totalCost: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                recordCount: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            }
        );


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json({
            totalCost: result.outBinds.totalCost,
            recordCount: result.outBinds.recordCount
        });

    } catch (error) {

        console.error("Get purchase summary error:", error);

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
// Purchase Records (add new)
// =====================================================


async function createPurchaseRecord(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const officerId = req.body.officerId;
        const itemName = req.body.itemName;
        const fiscalYear = req.body.fiscalYear;
        const cost = req.body.cost;
        const purchaseDate = req.body.purchaseDate;
        const quantity = req.body.quantity;

        if (!officerId || !itemName || !cost || !quantity) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Insert the purchase record
        // =================================


        const result = await connection.execute(
            `INSERT INTO Purchase_Record
        (Item_Name, Fiscal_Year, Cost, Purchase_Date, Quantity, Project_Director_ID)
     VALUES
        (:itemName, :fiscalYear, :cost, TO_DATE(:purchaseDate, 'YYYY-MM-DD'), :quantity, :officerId)
     RETURNING Purchase_Record_ID INTO :newId`,
            {
                itemName, fiscalYear, cost,
                purchaseDate, quantity, officerId,
                newId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            }
        );

        await connection.commit();


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json({
            success: true,
            message: "Purchase record added",
            id: result.outBinds.newId[0]
        });

    } catch (error) {

        console.error("Create purchase record error:", error);

        // ORA-20001 = invalid cost (raised inside trg_purchase_record_id)
        if (error.errorNum === 20001) {
            return res.status(400).json({ success: false, message: "Cost must be a positive number" });
        }
        // ORA-20002 = this purchase would exceed the planned quantity
        // for the project/fiscal year (raised inside trg_purchase_record_id)
        if (error.errorNum === 20002) {
            return res.status(400).json({
                success: false,
                message: error.message.split('\n')[0].replace(/^ORA-20002:\s*/, '')
            });
        }

        // ORA-20003 = no project found for this officer
        if (error.errorNum === 20003) {
            return res.status(400).json({ success: false, message: "No project found for this officer" });
        }

        // ORA-20004 = no Plan row for this project + fiscal year
        if (error.errorNum === 20004) {
            return res.status(400).json({ success: false, message: "No plan entry exists for this project and fiscal year" });
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
// Submit Budget Request (to a Director Planning officer)
// =====================================================


async function createBudgetRequest(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const officerId = req.body.officerId;
        const requestedAmount = req.body.requestedAmount;
        const priority = req.body.priority;

        if (!officerId || !requestedAmount || !priority) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Insert the budget request
        // =================================


        const result = await connection.execute(
            `INSERT INTO Project_Budget_Request
        (Requested_Amount, Allocated_Amount, Requester_ID, Priority)
     VALUES
        (:requestedAmount, 0, :officerId, :priority)
     RETURNING Project_Budget_Request_ID INTO :newId`,
            {
                requestedAmount, officerId, priority,
                newId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            },
            { autoCommit: true }
        );


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json({
            success: true,
            message: "Budget request submitted",
            id: result.outBinds.newId[0]
        });

    } catch (error) {

        console.error("Create budget request error:", error);

        // ORA-20010 = no Director_Planning row to route this to (raised
        // inside trg_project_budget_request_id)
        if (error.errorNum === 20010) {
            return res.status(500).json({
                success: false,
                message: "No planning director exists to route this request to"
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
// Overview Stats
// =====================================================

async function getOverview(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get officer id from frontend
        // =================================

        const officerId = req.query.officerId;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Total budget for this officer's project
        // =================================

        const budgetResult = await connection.execute(
            `SELECT FN_GET_PROJECT_BUDGET(
                 (SELECT Project_ID FROM Project_Director WHERE Project_Director_ID = :officerId)
             ) AS TOTAL_BUDGET
             FROM DUAL`,
            { officerId }
        );


        // =================================
        // Step 4: Count of this officer's pending budget requests
        // =================================

        const pendingResult = await connection.execute(
            `SELECT COUNT(*) AS PENDING_COUNT FROM Project_Budget_Request
             WHERE Requester_ID = :officerId AND Status = 'Pending'`,
            { officerId }
        );


        // =================================
        // Step 5: Send result to frontend
        // =================================

        res.json({
            totalBudget: budgetResult.rows[0].TOTAL_BUDGET,
            pendingProposals: pendingResult.rows[0].PENDING_COUNT
        });

    } catch (error) {

        console.error("Get overview error:", error);

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
    getProfile,
    updateProfile,
    getProjectDetails,
    getPlan,
    getPurchaseRecords,
    getPurchaseSummary,
    createPurchaseRecord,
    createBudgetRequest,
    getOverview
};
