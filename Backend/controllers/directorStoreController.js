const connectDB = require("../db");
const oracledb = require("oracledb");


// =====================================================
// Dashboard Overview (includes budget summary)
// =====================================================

async function getDashboardStats(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        // Total stocked items in this officer's category
        const totalStockedResult = await connection.execute(
            `SELECT NVL(SUM(Current_Stock), 0) AS TOTAL
             FROM Item
             WHERE Type = (SELECT Store_Category FROM Director_Store WHERE Dir_Store_ID = :officerId)`,
            { officerId: officerId }
        );

        // Pending (forwarded) demand requests in this officer's category
        const pendingResult = await connection.execute(
            `SELECT COUNT(*) AS TOTAL
             FROM STORE_DEMAND_REQUESTS
             WHERE Status = 'Forwarded'
             AND Item_Type = (SELECT Store_Category FROM Director_Store WHERE Dir_Store_ID = :officerId)`,
            { officerId: officerId }
        );

        // Supplies this officer created this calendar month
        const deliveredResult = await connection.execute(
            `SELECT COUNT(*) AS TOTAL
             FROM Supply
             WHERE Creation_Officer_ID = :officerId
             AND TRUNC(Supply_Date, 'MM') = TRUNC(SYSDATE, 'MM')`,
            { officerId: officerId }
        );

        // Budget: total approved / used / remaining, as separate scalar
        // subqueries (NOT a join — joining Budget_Request to Supply directly
        // multiplies rows and overcounts both sums)
        const budgetResult = await connection.execute(
            `SELECT
                (SELECT NVL(SUM(Approved_Budget), 0) FROM Budget_Request
                 WHERE Creator_ID = :officerId AND Status in ('Approved', 'Partially Approved')) AS TOTAL_BUDGET,
                (SELECT NVL(SUM(Cost), 0) FROM Supply
                 WHERE Creation_Officer_ID = :officerId) AS USED_BUDGET,
                (SELECT NVL(SUM(Approved_Budget), 0) FROM Budget_Request
                 WHERE Creator_ID = :officerId AND Status = 'Approved')
                - (SELECT NVL(SUM(Cost), 0) FROM Supply
                   WHERE Creation_Officer_ID = :officerId) AS REMAINING_BUDGET
             FROM DUAL`,
            { officerId: officerId }
        );

        res.json({
            totalStockedItems: totalStockedResult.rows[0].TOTAL,
            pendingRequests: pendingResult.rows[0].TOTAL,
            deliveredThisMonth: deliveredResult.rows[0].TOTAL,
            totalBudget: budgetResult.rows[0].TOTAL_BUDGET,
            usedBudget: budgetResult.rows[0].USED_BUDGET,
            remainingBudget: budgetResult.rows[0].REMAINING_BUDGET
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
            `SELECT Name, Email, Phones, Office_Unit, Store_Category, Appointment_Date
             FROM Director_Store_Profile WHERE User_ID = :officerId`,
            { officerId: officerId }
        );

        if (result.rows.length === 0) {
            return res.json({ success: false, message: "Profile not found" });
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

        const officerId = req.body.officerId;
        const name = req.body.name || null;
        const email = req.body.email || null;
        const password = req.body.password || null;
        const phones = req.body.phones || []; // [{ oldPhone, newPhone }, ...]

        connection = await connectDB();

        await connection.execute(
            `UPDATE USER_INFO SET Name = NVL(:name, Name), Email = NVL(:email, Email),
             Password = NVL(:password, Password) WHERE User_ID = :officerId`,
            { name, email, password, officerId }
        );

        for (const entry of phones) {

            if (entry.oldPhone && entry.newPhone) {
                await connection.execute(
                    `UPDATE User_Phone SET Phone = :newPhone
                     WHERE User_ID = :officerId AND Phone = :oldPhone`,
                    { newPhone: entry.newPhone, officerId, oldPhone: entry.oldPhone }
                );
            } else if (!entry.oldPhone && entry.newPhone) {
                await connection.execute(
                    `INSERT INTO User_Phone (User_ID, Phone) VALUES (:officerId, :newPhone)`,
                    { officerId, newPhone: entry.newPhone }
                );
            } else if (entry.oldPhone && !entry.newPhone) {
                await connection.execute(
                    `DELETE FROM User_Phone WHERE User_ID = :officerId AND Phone = :oldPhone`,
                    { officerId, oldPhone: entry.oldPhone }
                );
            }
        }

        await connection.commit();

        res.json({ success: true, message: "Profile updated" });

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
// Verify Demand Requests — the queue awaiting this officer
// =====================================================

async function getDemandRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        const result = await connection.execute(
            `SELECT Demand_Request_ID,
       Upz_Name,
       Dist_Name,
       Item_Name,
       Quantity,
       Estimated_Cost,
       Status,
       TO_CHAR(Submission_Date, 'DD-MON-YYYY') AS Submission_Date
FROM STORE_DEMAND_REQUESTS
WHERE Status = 'Forwarded'
AND Item_Type = (SELECT Store_Category FROM Director_Store WHERE Dir_Store_ID = :officerId)
ORDER BY Submission_Date`,
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
// Approve a demand request
// =====================================================

async function approveDemandRequest(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const demandRequestId = req.body.demandRequestId;

        connection = await connectDB();

        // Who this request's district officer is (needed for Approval.District_Officer_ID)
        const districtResult = await connection.execute(
            `SELECT Revision_Officer_ID FROM Demand_Request WHERE Demand_Request_ID = :demandRequestId`,
            { demandRequestId }
        );

        if (districtResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Demand request not found" });
        }

        const districtOfficerId = districtResult.rows[0].REVISION_OFFICER_ID;

        // Next Approval_ID, following the 'A001' pattern
        const idResult = await connection.execute(
            `SELECT 'A' || LPAD(NVL(MAX(TO_NUMBER(SUBSTR(Approval_ID, 2))), 0) + 1, 3, '0') AS NEW_ID FROM Approval`
        );
        const newApprovalId = idResult.rows[0].NEW_ID;

        await connection.execute(
            `INSERT INTO Approval (Approval_ID, Demand_Request_ID, Director_Store_ID, District_Officer_ID, Approval_Date)
             VALUES (:newApprovalId, :demandRequestId, :officerId, :districtOfficerId, SYSDATE)`,
            { newApprovalId, demandRequestId, officerId, districtOfficerId }
        );

        await connection.execute(
            `UPDATE Demand_Request SET Status = 'Approved' WHERE Demand_Request_ID = :demandRequestId`,
            { demandRequestId }
        );

        await connection.commit();

        res.json({ success: true, approvalId: newApprovalId });

    } catch (error) {

        console.error("Approve demand request error:", error);

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
// Reject a demand request
// =====================================================

async function rejectDemandRequest(req, res) {

    let connection;

    try {

        const demandRequestId = req.body.demandRequestId;

        connection = await connectDB();

        await connection.execute(
            `UPDATE Demand_Request SET Status = 'Rejected' WHERE Demand_Request_ID = :demandRequestId`,
            { demandRequestId }
        );

        await connection.commit();

        res.json({ success: true });

    } catch (error) {

        console.error("Reject demand request error:", error);

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
// Approved requests still waiting on a Supply (Create Supply dropdown)
// =====================================================

async function getApprovedRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        const result = await connection.execute(
            `SELECT a.Demand_Request_ID, i.Name AS Item_Name, uo.Upz_Name, dr.Quantity, dr.Estimated_Cost
             FROM Approval a
             JOIN Demand_Request dr ON a.Demand_Request_ID = dr.Demand_Request_ID
             JOIN Item i ON dr.Item_ID = i.Item_ID
             JOIN Upazila_Office uo ON dr.Submission_Officer_ID = uo.Off_ID
             WHERE a.Director_Store_ID = :officerId
             AND NOT EXISTS (
                 SELECT 1 FROM Supply s WHERE s.Demand_Request_ID = a.Demand_Request_ID
             )
             ORDER BY a.Approval_Date`,
            { officerId: officerId }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get approved requests error:", error);

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
// Create Supply
// =====================================================

async function createSupply(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const demandRequestId = req.body.demandRequestId;
        const grantedQuantity = Number(req.body.grantedQuantity);
        const cost = Number(req.body.cost);
        const supplyDate = req.body.supplyDate; // 'YYYY-MM-DD' from an <input type="date">

        connection = await connectDB();

        const result = await connection.execute(
            `INSERT INTO Supply (Demand_Request_ID, Granted_Quantity, Cost, Supply_Date, Creation_Officer_ID)
     VALUES (:demandRequestId, :grantedQuantity, :cost, TO_DATE(:supplyDate, 'YYYY-MM-DD'), :officerId)
     RETURNING Supply_ID INTO :newId`,
            {
                demandRequestId, grantedQuantity, cost, supplyDate, officerId,
                newId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            }
        );

        const newSupplyId = result.outBinds.newId[0];

        await connection.commit();

        res.json({ success: true, supplyId: newSupplyId });

    } catch (error) {

        console.error("Create supply error:", error);
        if (error.errorNum === 20004) {
            return res.status(400).json({
                success: false,
                message: "Couldn't find that demand request."
            });
        }
        if (error.errorNum === 20005) {
            return res.status(400).json({
                success: false,
                message: error.message.split('\n')[0].replace('ORA-20005: ', '')
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
// Create Budget Request
// =====================================================

async function createBudgetRequest(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const budgetType = req.body.budgetType; // 'Revenue' or 'Development'
        const requestedAmount = Number(req.body.requestedAmount);

        connection = await connectDB();

        const result = await connection.execute(
            `INSERT INTO Budget_Request
        (Requested_Amount, Budget_Type, Creation_Date, Approval_Date, Approved_Budget, Status, Creator_ID)
     VALUES
        (:requestedAmount, :budgetType, SYSDATE, SYSDATE, 0, 'Pending', :officerId)
     RETURNING Budget_Request_ID INTO :newId`,
            {
                requestedAmount, budgetType, officerId,
                newId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            },
            { autoCommit: true }
        );

        const newBudgetRequestId = result.outBinds.newId[0];

        await connection.commit();

        res.json({ success: true, budgetRequestId: newBudgetRequestId });

    } catch (error) {

        console.error("Create budget request error:", error);
        if (error.errorNum === 20008) {
            return res.status(400).json({
                success: false,
                message: "No active director budget officer for that budget type right now."
            });
        }
        if (error.errorNum === 20009) {
            return res.status(500).json({
                success: false,
                message: "Data inconsistency: multiple active officers found for that budget type."
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
    getDashboardStats,
    getProfile,
    updateProfile,
    getDemandRequests,
    approveDemandRequest,
    rejectDemandRequest,
    getApprovedRequests,
    createSupply,
    createBudgetRequest
};