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

        // Farms in this director's category. Farm.Type is matched to the
        // director's own Farm_Type through a scalar subquery.
        const totalFarmsResult = await connection.execute(
            `SELECT COUNT(*) AS TOTAL
             FROM Farm
             WHERE Type = (SELECT Farm_Type FROM Director_Production
                           WHERE Director_Production_ID = :officerId)`,
            { officerId: officerId }
        );

        // Farm demands waiting on this director. Approved_By_ID is NOT NULL,
        // so the farm manager already routed the request here at creation time.
        const pendingResult = await connection.execute(
            `SELECT COUNT(*) AS TOTAL
             FROM Farm_Demand
             WHERE Status = 'Pending'
             AND Approved_By_ID = :officerId`,
            { officerId: officerId }
        );

        // Supplies this director created this calendar month
        const suppliedResult = await connection.execute(
            `SELECT COUNT(*) AS TOTAL
             FROM Farm_Supply
             WHERE Creator_ID = :officerId
             AND TRUNC(Supply_Date, 'MM') = TRUNC(SYSDATE, 'MM')`,
            { officerId: officerId }
        );

        // Budget: separate scalar subqueries, not a join. Joining Budget_Request
        // to Farm_Supply multiplies rows and overcounts both sums.
        const budgetResult = await connection.execute(
            `SELECT
                (SELECT NVL(SUM(Approved_Budget), 0) FROM Budget_Request
                 WHERE Creator_ID = :officerId AND Status in ('Approved', 'Partially Approved')) AS TOTAL_BUDGET,
                (SELECT NVL(SUM(Cost), 0) FROM Farm_Supply
                 WHERE Creator_ID = :officerId) AS USED_BUDGET,
                (SELECT NVL(SUM(Approved_Budget), 0) FROM Budget_Request
                 WHERE Creator_ID = :officerId AND Status = 'Approved')
                - (SELECT NVL(SUM(Cost), 0) FROM Farm_Supply
                   WHERE Creator_ID = :officerId) AS REMAINING_BUDGET
             FROM DUAL`,
            { officerId: officerId }
        );

        res.json({
            totalFarms: totalFarmsResult.rows[0].TOTAL,
            pendingRequests: pendingResult.rows[0].TOTAL,
            suppliedThisMonth: suppliedResult.rows[0].TOTAL,
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
// Government Farms — read-only list in this director's category
// =====================================================

async function getFarms(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        // LEFT JOIN on the manager side — a farm can exist with nobody assigned
        const result = await connection.execute(
            `SELECT f.Farm_ID, f.Name, f.Location, f.Scale,
                    u.Name AS MANAGER_NAME
             FROM Farm f
             LEFT JOIN Farm_Manager fm ON fm.Assigned_Farm = f.Farm_ID
             LEFT JOIN USER_INFO u ON u.User_ID = fm.Manager_ID
             WHERE f.Type = (SELECT Farm_Type FROM Director_Production
                             WHERE Director_Production_ID = :officerId)
             ORDER BY f.Name`,
            { officerId: officerId }
        );

        res.json(result.rows);

    } catch (error) {

        console.error("Get farms error:", error);

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
            `SELECT Name, Email, Phones, Farm_Type, Appointment_Date
             FROM Director_Production_Profile WHERE User_ID = :officerId`,
            { officerId: officerId }
        );

        if (result.rows.length === 0) {
            return res.json({ success: false, message: "Profile not found" });
        }

        // The view gives one joined string; the edit form needs them one by one
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
// Verify Farm Demand Requests — the queue awaiting this director
// =====================================================

async function getDemandRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        // Farm name comes through Resources.Farm_ID — Farm_Demand has no Farm_ID
        // CASE in ORDER BY so High sorts above Medium above Low, not alphabetically
        const result = await connection.execute(
            `SELECT fd.Farm_Demand_ID,
                    f.Name AS FARM_NAME,
                    r.Name AS RESOURCE_NAME,
                    fd.Requested_Quantity,
                    fd.Priority,
                    fd.Status
             FROM Farm_Demand fd
             JOIN Resources r ON r.Resource_ID = fd.Resource_ID
             JOIN Farm f ON f.Farm_ID = r.Farm_ID
             WHERE fd.Approved_By_ID = :officerId
             AND fd.Status = 'Pending'
             ORDER BY CASE fd.Priority
                        WHEN 'High' THEN 1
                        WHEN 'Medium' THEN 2
                        ELSE 3
                      END,
                      fd.Farm_Demand_ID`,
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
// Approve a farm demand request
// =====================================================

async function approveDemandRequest(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const farmDemandId = req.body.farmDemandId;

        connection = await connectDB();

        // The two extra WHERE conditions stop a director approving somebody
        // else's request, or approving the same row twice from a stale page
        const result = await connection.execute(
            `UPDATE Farm_Demand SET Status = 'Approved'
             WHERE Farm_Demand_ID = :farmDemandId
             AND Approved_By_ID = :officerId
             AND Status = 'Pending'`,
            { farmDemandId, officerId }
        );

        if (result.rowsAffected === 0) {
            return res.json({
                success: false,
                message: "That request is not pending on you any more. Refresh the page."
            });
        }

        await connection.commit();

        res.json({ success: true });

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
// Reject a farm demand request
// =====================================================

async function rejectDemandRequest(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const farmDemandId = req.body.farmDemandId;

        connection = await connectDB();

        const result = await connection.execute(
            `UPDATE Farm_Demand SET Status = 'Rejected'
             WHERE Farm_Demand_ID = :farmDemandId
             AND Approved_By_ID = :officerId
             AND Status = 'Pending'`,
            { farmDemandId, officerId }
        );

        if (result.rowsAffected === 0) {
            return res.json({
                success: false,
                message: "That request is not pending on you any more. Refresh the page."
            });
        }

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
// Approved farm demands still waiting on a Farm_Supply (Create Supply dropdown)
// =====================================================

async function getApprovedRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        // NOT EXISTS drops demands that already have a supply, so the dropdown
        // never offers the same request twice
        const result = await connection.execute(
            `SELECT fd.Farm_Demand_ID,
                    r.Name AS RESOURCE_NAME,
                    f.Name AS FARM_NAME,
                    fd.Requested_Quantity,
                    fd.Estimated_Cost
             FROM Farm_Demand fd
             JOIN Resources r ON r.Resource_ID = fd.Resource_ID
             JOIN Farm f ON f.Farm_ID = r.Farm_ID
             WHERE fd.Approved_By_ID = :officerId
             AND fd.Status = 'Approved'
             AND NOT EXISTS (SELECT 1 FROM Farm_Supply fs
                             WHERE fs.Farm_Demand_ID = fd.Farm_Demand_ID)
             ORDER BY fd.Farm_Demand_ID`,
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
// Create Farm Supply — via the CREATE_FARM_SUPPLY procedure
// =====================================================

async function createSupply(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const farmDemandId = req.body.farmDemandId;
        const grantedQuantity = Number(req.body.grantedQuantity);
        const cost = Number(req.body.cost);
        const supplyDate = req.body.supplyDate; // 'YYYY-MM-DD' from an <input type="date">

        connection = await connectDB();

        // The procedure checks the rules and commits by itself.
        // trg_farm_supply_id makes the ID, checks the budget and adds the stock
        const result = await connection.execute(
            `BEGIN CREATE_FARM_SUPPLY(:officerId, :farmDemandId, :grantedQuantity,
                                      :cost, :supplyDate, :newFarmSupplyId); END;`,
            {
                officerId,
                farmDemandId,
                grantedQuantity,
                cost,
                supplyDate,
                newFarmSupplyId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            }
        );

        res.json({ success: true, farmSupplyId: result.outBinds.newFarmSupplyId });

    } catch (error) {

        console.error("Create supply error:", error);

        // -20011 to -20014 are raised on purpose inside CREATE_FARM_SUPPLY
        if (error.errorNum >= 20011 && error.errorNum <= 20014) {
            return res.status(400).json({
                success: false,
                message: error.message.split("\n")[0].replace(/^ORA-\d+:\s*/, "")
            });
        }

        // -20019 and -20020 are raised by trg_farm_supply_id during the insert
        if (error.errorNum === 20019) {
            return res.status(400).json({
                success: false,
                message: error.message.split("\n")[0].replace("ORA-20019: ", "")
            });
        }

        if (error.errorNum === 20020) {
            return res.status(400).json({
                success: false,
                message: "Couldn't find that farm demand request."
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

        // Budget_Request_ID and Director_Budget_ID are filled by trg_budget_request_id
        // Approval_Date and Approved_Budget are NOT NULL, so they are filled with
        // placeholders now and overwritten when the budget director decides
        const result = await connection.execute(
            `INSERT INTO Budget_Request
             (Requested_Amount, Budget_Type, Creation_Date, Approval_Date, Approved_Budget, Status, Creator_ID)
             VALUES (:requestedAmount, :budgetType, SYSDATE, SYSDATE, 0, 'Pending', :officerId)
             RETURNING Budget_Request_ID INTO :newId`,
            {
                requestedAmount, budgetType, officerId,
                newId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            }
        );

        const newBudgetRequestId = result.outBinds.newId[0];

        await connection.commit();

        res.json({ success: true, budgetRequestId: newBudgetRequestId });

    } catch (error) {

        console.error("Create budget request error:", error);

        // -20008 and -20009 are raised by trg_budget_request_id
        if (error.errorNum === 20008) {
            return res.status(400).json({
                success: false,
                message: "No serving Director (Budget) found for that budget type."
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
    getFarms,
    getProfile,
    updateProfile,
    getDemandRequests,
    approveDemandRequest,
    rejectDemandRequest,
    getApprovedRequests,
    createSupply,
    createBudgetRequest
};