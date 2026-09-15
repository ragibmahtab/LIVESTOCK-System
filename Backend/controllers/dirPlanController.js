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
            `SELECT * FROM VW_DIRECTOR_PLANNING_PROFILE WHERE USER_ID = :officerId`,
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
// Note: single Mobile Number field, same as project-director's edit
// form — replaces whatever phone was on file with the one submitted.
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

            // TODO: write INSERT query here
            // Table: USER_PHONE (User_ID, Phone) — composite PK, no generated ID
            // Binds available: officerId, phone
            await connection.execute(
                ``,
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
// Overview Stats
// =====================================================

async function getOverview(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 2: Total ADP budget across all projects
        // =================================

        const budgetResult = await connection.execute(
            `SELECT FN_GET_ADP_TOTAL_BUDGET() AS ADP_BUDGET FROM DUAL`
        );


        // =================================
        // Step 3: Count of ongoing projects
        // =================================

        const ongoingResult = await connection.execute(
            `SELECT COUNT(*) AS ONGOING_COUNT FROM Project
             WHERE End_Date IS NULL OR End_Date > SYSDATE`
        );


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json({
            adpBudget: budgetResult.rows[0].ADP_BUDGET,
            ongoingProjects: ongoingResult.rows[0].ONGOING_COUNT
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


// =====================================================
// Ongoing Major Projects (list)
// =====================================================

async function getProjects(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 2: Fetch all projects with their allocation
        // =================================

        const result = await connection.execute(
            `SELECT p.Project_ID, p.Name, p.Start_Date, p.End_Date,
                    FN_GET_PROJECT_BUDGET(p.Project_ID) AS ALLOCATION
             FROM Project p
             ORDER BY p.Start_Date DESC`
        );


        // =================================
        // Step 3: Send result to frontend
        // =================================

        res.json(result.rows);

    } catch (error) {

        console.error("Get projects error:", error);

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
// Budget Requests Received
// =====================================================
// CHANGED: was SELECT * FROM VW_PENDING_BUDGET_REQUESTS, but that view's
// actual columns didn't match what the frontend expected (BUDGET_TYPE
// came back undefined, OFFICE_NAME/SUBMITTER_NAME didn't exist at all --
// Project_Budget_Request has no Budget_Type column, only Budget_Request
// does). Replaced with an explicit join so every column is one that's
// actually verified against the schema: the requesting project's name
// and Type (labeled "Sector" in the UI), plus the request's own columns.

async function getBudgetRequests(req, res) {

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
        // Step 3: Fetch pending budget requests routed to this officer
        // =================================

        const result = await connection.execute(
            `SELECT pbr.Project_Budget_Request_ID,
                    p.Name AS Project_Name,
                    p.Type AS Sector,
                    pbr.Requested_Amount,
                    pbr.Request_Date,
                    pbr.Status,
                    pbr.Priority
             FROM Project_Budget_Request pbr
             JOIN Project_Director pd ON pd.Project_Director_ID = pbr.Requester_ID
             JOIN Project p ON p.Project_ID = pd.Project_ID
             WHERE pbr.Allocator_ID = :officerId
             ORDER BY pbr.Request_Date DESC`,
            { officerId }
        );


        // =================================
        // Step 4: Send result to frontend
        // =================================

        res.json(result.rows);

    } catch (error) {

        console.error("Get budget requests error:", error);

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
// Create Budget Request (Director Planning -> Director Budget)
// =====================================================
// This is the SAME Budget_Request table director-store submits to —
// reuses the EXISTING Budget_Request_Seq / trg_budget_request_id
// infrastructure (not something to create here) instead of the old
// PROC_SUBMIT_BUDGET_REQUEST. That trigger already generates
// Budget_Request_ID and auto-fills Director_Budget_ID by matching
// Budget_Type, so Node only needs to send the fields it can't derive.
// Confirm against your existing trg_budget_request_id definition
// whether Status / Approved_Budget / Creation_Date / Approval_Date
// are also defaulted there — if so, drop them from the INSERT below
// too; if not, keep supplying them as the old code did.

async function createBudgetRequest(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const officerId = req.body.officerId;
        const budgetType = req.body.budgetType;
        const requestedAmount = req.body.requestedAmount;

        if (!officerId || !requestedAmount) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Insert the budget request
        // =================================

        // TODO: write INSERT query here
        // Table: Budget_Request
        // Do NOT include Budget_Request_ID or Director_Budget_ID —
        // trg_budget_request_id fills both in
        // Columns the old code supplied manually: Requested_Amount, Budget_Type,
        // Creation_Date, Approval_Date, Approved_Budget, Creator_ID, Status
        // (double check which of these the trigger now defaults for you)
        // End with: RETURNING Budget_Request_ID INTO :newId
        // Binds available: requestedAmount, budgetType, officerId, newId
        const result = await connection.execute(
            ``,
            {
                requestedAmount, budgetType, officerId,
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

        // Raised inside trg_budget_request_id if no active Director_Budget
        // officer exists for this budget type
        if (error.errorNum === 20008 || error.errorNum === 20009) {
            return res.status(500).json({
                success: false,
                message: "No Director Budget exists to route this request to"
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


module.exports = {
    getProfile,
    updateProfile,
    getOverview,
    getProjects,
    getBudgetRequests,
    createBudgetRequest
};
