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
        // Step 3: Total annual budget for this officer
        // =================================

        const totalBudgetResult = await connection.execute(

            `SELECT NVL(SUM(afb.Total_Amount), 0) AS TOTAL
FROM Annual_Fiscal_Budget afb
WHERE afb.Director_Budget_ID = :officerId
AND afb.Fiscal_Year = '2025-2026'`,

            { officerId: officerId }
        );


        // =================================
        // Step 4: Requests awaiting approval
        // =================================

        const pendingResult = await connection.execute(

            `SELECT COUNT(*) AS TOTAL
             FROM Budget_Request br
             WHERE br.Director_Budget_ID = :officerId
             AND br.Status = 'Pending'`,

            { officerId: officerId }
        );


        // =================================
        // Step 5: Approved this month (amount + count)
        // =================================

        const approvedThisMonthResult = await connection.execute(

            `SELECT
                NVL(SUM(br.Approved_Budget), 0) AS TOTAL_AMOUNT,
                COUNT(*) AS TOTAL_COUNT
             FROM Budget_Request br
             JOIN Director_Budget db
                  ON br.Director_Budget_ID = db.Dir_Bud_ID
             WHERE db.Dir_Bud_ID = :officerId
               AND br.Status IN ('Approved', 'Partially Approved')
               AND br.Approval_Date >= TRUNC(SYSDATE, 'MM')
               AND br.Approval_Date < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)`,

            { officerId: officerId }
        );


        // =================================
        // Step 6: Recent budget requests for the table (10 requests)
        // =================================

        const recentRequestsResult = await connection.execute(

            `SELECT * FROM (
                SELECT
                    br.Budget_Request_ID,
                    br.Requested_Amount,
                    br.Budget_Type,
                    TO_CHAR(br.Creation_Date, 'DD-MON-YYYY') AS Creation_Date,
                    TO_CHAR(br.Approval_Date, 'DD-MON-YYYY') AS Approval_Date,
                    br.Approved_Budget,
                    br.Status,

                    u.Name AS Submitter_Name,

                    COALESCE(
                        ds.Office_Unit,
                        dp.Farm_Type,
                        dpl.Planning_Division
                    ) AS Office_Name

                FROM Budget_Request br

                JOIN USER_INFO u
                     ON br.Creator_ID = u.User_ID

                JOIN Director_Budget db
                     ON br.Director_Budget_ID = db.Dir_Bud_ID

                LEFT JOIN Director_Store ds
                     ON br.Creator_ID = ds.Dir_Store_ID

                LEFT JOIN Director_Production dp
                     ON br.Creator_ID = dp.Director_Production_ID

                LEFT JOIN Director_Planning dpl
                     ON br.Creator_ID = dpl.Director_Plan_ID

                WHERE db.Dir_Bud_ID = :officerId

                ORDER BY br.Creation_Date DESC
            )
            WHERE ROWNUM <= 10`,

            { officerId: officerId }
        );


        // =================================
        // Step 7: Send everything back to frontend
        // =================================

        res.json({
            totalAnnualBudget: totalBudgetResult.rows[0] ? totalBudgetResult.rows[0].TOTAL : 0,
            pendingRequests: pendingResult.rows[0] ? pendingResult.rows[0].TOTAL : 0,
            approvedThisMonthAmount: approvedThisMonthResult.rows[0] ? approvedThisMonthResult.rows[0].TOTAL_AMOUNT : 0,
            approvedThisMonthCount: approvedThisMonthResult.rows[0] ? approvedThisMonthResult.rows[0].TOTAL_COUNT : 0,
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

            `SELECT * FROM Director_Budget_Profile WHERE User_ID = :officerId`,

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
// Note: unlike the other dashboards, this edit form only has a single
// Mobile Number field rather than a multi-phone add/remove list, so this
// does one User_Phone upsert instead of looping over an array of rows.

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
        const oldPhone = req.body.oldPhone || null;
        const newPhone = req.body.newPhone || null;


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
        // Step 4: Update / insert the phone number
        // =================================

        if (oldPhone && newPhone && oldPhone !== newPhone) {

            await connection.execute(
                `UPDATE User_Phone SET Phone = :newPhone
                 WHERE User_ID = :officerId AND Phone = :oldPhone`,
                { newPhone, officerId, oldPhone }
            );

        } else if (!oldPhone && newPhone) {

            await connection.execute(
                `INSERT INTO User_Phone (User_ID, Phone) VALUES (:officerId, :newPhone)`,
                { officerId, newPhone }
            );
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
// View Budget Requests (for this officer to review)
// =====================================================

async function getBudgetRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        const result = await connection.execute(

            `SELECT
                br.Budget_Request_ID,
                br.Requested_Amount,
                br.Budget_Type,
                TO_CHAR(br.Creation_Date, 'DD-MON-YYYY') AS Creation_Date,
                TO_CHAR(br.Approval_Date, 'DD-MON-YYYY') AS Approval_Date,
                br.Approved_Budget,
                br.Status,

                u.Name AS Submitter_Name,

                COALESCE(
                    ds.Office_Unit,
                    dp.Farm_Type,
                    dpl.Planning_Division
                ) AS Office_Name

             FROM Budget_Request br

             JOIN USER_INFO u
                  ON br.Creator_ID = u.User_ID

             JOIN Director_Budget db
                  ON br.Director_Budget_ID = db.Dir_Bud_ID

             LEFT JOIN Director_Store ds
                  ON br.Creator_ID = ds.Dir_Store_ID

             LEFT JOIN Director_Production dp
                  ON br.Creator_ID = dp.Director_Production_ID

             LEFT JOIN Director_Planning dpl
                  ON br.Creator_ID = dpl.Director_Plan_ID

             WHERE db.Dir_Bud_ID = :officerId
             and br.status = 'Pending'

             ORDER BY br.Creation_Date DESC`,

            { officerId: officerId }
        );

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
// Approve Budget Request
// =====================================================
// Approved_Budget can come in lower than Requested_Amount (a partial
// approval), so the frontend sends whatever amount was actually approved.
// All the safety checks (must be Pending, amount in range, annual budget
// has enough left) live in the WHERE clause rather than a PL/SQL
// exception, so a failed guard shows up as rowsAffected === 0, not a
// thrown error — that's why the check below matters.

async function approveBudgetRequest(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const budgetRequestId = req.body.budgetRequestId;
        const approvedAmount = Number(req.body.approvedAmount);

        connection = await connectDB();

        const result = await connection.execute(

            `UPDATE Budget_Request br

             SET
                 br.Approved_Budget = :approvedAmount,
                 br.Approval_Date = SYSDATE,
                 br.Status =
                     CASE
                         WHEN :approvedAmount = br.Requested_Amount
                             THEN 'Approved'
                         ELSE 'Partially Approved'
                     END

             WHERE br.Budget_Request_ID = :budgetRequestId
               AND br.Director_Budget_ID = :officerId
               AND br.Status = 'Pending'
               AND :approvedAmount >= 0
               AND :approvedAmount <= br.Requested_Amount
               AND EXISTS (
                   SELECT 1
                   FROM Annual_Fiscal_Budget afb
                   JOIN Director_Budget db
                        ON afb.Director_Budget_ID = db.Dir_Bud_ID
                   WHERE db.Dir_Bud_ID = br.Director_Budget_ID
                     AND afb.Budget_Type = br.Budget_Type
                     AND afb.Total_Amount >= :approvedAmount
               )`,

            { officerId, budgetRequestId, approvedAmount },
            { autoCommit: true }
        );

        if (result.rowsAffected === 0) {
            return res.status(400).json({
                success: false,
                message: "Could not approve: request isn't pending, amount is out of range, or the annual budget doesn't cover it."
            });
        }

        res.json({ success: true, message: "Budget request approved" });

    } catch (error) {

        console.error("Approve budget request error:", error);

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
// Reject Budget Request
// =====================================================

async function rejectBudgetRequest(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const budgetRequestId = req.body.budgetRequestId;

        connection = await connectDB();

        const result = await connection.execute(

            `UPDATE Budget_Request br

             SET
                 br.Status = 'Rejected',
                 br.Approval_Date = SYSDATE,
                 br.Approved_Budget = 0

             WHERE br.Budget_Request_ID = :budgetRequestId
               AND br.Director_Budget_ID = :officerId
               AND br.Status = 'Pending'`,

            { officerId, budgetRequestId },
            { autoCommit: true }
        );

        if (result.rowsAffected === 0) {
            return res.status(400).json({
                success: false,
                message: "Could not reject: this request isn't pending anymore."
            });
        }

        res.json({ success: true, message: "Budget request rejected" });

    } catch (error) {

        console.error("Reject budget request error:", error);

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
// Annual Budget Distribution (sector-wise summary)
// =====================================================
// Total_Amount on Annual_Fiscal_Budget is a LIVE remaining balance —
// trg_update_annual_budget subtracts from it the moment a request is
// approved. So "Allocation" has to be reconstructed by adding Spent back
// on, and "Remaining" is just Total_Amount as-is (not Total_Amount minus
// Spent again, which would double-subtract).

async function getAnnualBudget(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        const result = await connection.execute(

            `
                SELECT
    afb.Budget_Type AS Sector,
    afb.Fiscal_Year,

    

                afb.Total_Amount +
                NVL(SUM(CASE WHEN br.Status IN ('Approved', 'Partially Approved') THEN br.Approved_Budget ELSE 0 END), 0)
                    AS Allocation,

                NVL(SUM(CASE WHEN br.Status IN ('Approved', 'Partially Approved') THEN br.Approved_Budget ELSE 0 END), 0)
                    AS Spent,

                afb.Total_Amount AS Remaining

             FROM Annual_Fiscal_Budget afb
             JOIN Director_Budget db
                  ON afb.Director_Budget_ID = db.Dir_Bud_ID
             LEFT JOIN Budget_Request br
                  ON br.Director_Budget_ID = db.Dir_Bud_ID
                 AND br.Budget_Type = afb.Budget_Type
                 AND br.Status IN ('Approved', 'Partially Approved')

             WHERE db.Dir_Bud_ID = :officerId
             AND afb.Fiscal_Year = '2025-2026'

             GROUP BY afb.Budget_Type, afb.Fiscal_Year, afb.Total_Amount
             ORDER BY afb.Fiscal_Year DESC`,

            { officerId: officerId }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get annual budget error:", error);

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
    getBudgetRequests,
    approveBudgetRequest,
    rejectBudgetRequest,
    getAnnualBudget
};
