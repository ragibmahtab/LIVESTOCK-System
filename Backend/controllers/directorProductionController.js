const connectDB = require("../db");
const oracledb = require("oracledb");

// -----------------------------------------------------------------
// NOTE FOR ALL QUERIES BELOW (per known project gotchas):
//   - No trailing semicolons inside the template-literal SQL strings (ORA-00911)
//   - Never leave a query template literal empty at runtime (ORA-24373 / NJS-047)
//   - Always use connectDB(), never oracledb.getConnection() directly
//   - Do NOT double-quote column aliases -> let Oracle auto-uppercase them,
//     since the frontend JS reads ALL-CAPS keys (e.g. row.FARM_NAME)
//   - Read scalar/aggregate results by alias name, e.g. rows[0].TOTAL,
//     since OUT_FORMAT_OBJECT is set globally and rows[0][0] returns undefined
//   - Format DATE columns on the frontend with toLocaleDateString(), not TO_CHAR,
//     unless you specifically want a pre-formatted string from SQL
// -----------------------------------------------------------------


// =====================================================
// Dashboard Overview (includes budget summary)
// =====================================================

async function getDashboardStats(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        // Registered farms in this director's Farm_Type category
        // Expected: single row, column TOTAL
        // Tables: Farm, Director_Production (match Farm.Type = Director_Production.Farm_Type for :officerId)
        const totalFarmsResult = await connection.execute(
            ``,
            { officerId: officerId }
        );

        // Pending farm demand requests waiting on this director
        // Expected: single row, column TOTAL
        // Tables: Farm_Demand (Status = 'Pending', Approved_By_ID = :officerId — or filtered via
        // Resources -> Farm -> Type matching the director's Farm_Type, whichever matches your design)
        const pendingResult = await connection.execute(
            ``,
            { officerId: officerId }
        );

        // Farm supplies this director created this calendar month
        // Expected: single row, column TOTAL
        // Table: Farm_Supply (Creator_ID = :officerId, TRUNC(Supply_Date,'MM') = TRUNC(SYSDATE,'MM'))
        const suppliedResult = await connection.execute(
            ``,
            { officerId: officerId }
        );

        // Budget: total approved / used / remaining as separate scalar subqueries
        // (NOT a join -- joining Budget_Request to Farm_Supply directly multiplies rows
        // and overcounts both sums, same issue as the Store dashboard)
        // Expected: single row, columns TOTAL_BUDGET, USED_BUDGET, REMAINING_BUDGET
        // Tables: Budget_Request (Creator_ID = :officerId, Status = 'Approved'), Farm_Supply (Creator_ID = :officerId)
        const budgetResult = await connection.execute(
            ``,
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

        // Expected columns: FARM_ID, NAME, LOCATION, SCALE, MANAGER_NAME
        // Tables: Farm, Director_Production (for Farm_Type match), Farm_Manager, USER_INFO
        // (LEFT JOIN Farm_Manager/USER_INFO since a farm may not have a manager assigned yet)
        const result = await connection.execute(
            ``,
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

        // Expected columns: NAME, EMAIL, PHONES, FARM_TYPE, APPOINTMENT_DATE
        // Tables: USER_INFO, Director_Production (consider a view like Director_Store_Profile,
        // or join USER_INFO + Director_Production + an aggregated phone list directly)
        const result = await connection.execute(
            ``,
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
// Verify Farm Demand Requests — the queue awaiting this director
// =====================================================

async function getDemandRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        // Expected columns: FARM_DEMAND_ID, FARM_NAME, RESOURCE_NAME, REQUESTED_QUANTITY,
        // PRIORITY, STATUS
        // Tables: Farm_Demand, Resources, Farm
        // WHERE Status = 'Pending' AND Approved_By_ID = :officerId (or via Farm_Type match)
        const result = await connection.execute(
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
// Approve a farm demand request
// =====================================================

async function approveDemandRequest(req, res) {

    let connection;

    try {

        const officerId = Number(req.body.officerId);
        const farmDemandId = req.body.farmDemandId;

        connection = await connectDB();

        // Expected: UPDATE Farm_Demand SET Status = 'Approved' WHERE Farm_Demand_ID = :farmDemandId
        // (Approved_By_ID is already set at creation time per the schema's FK,
        // so this may just be a status flip -- confirm against your design)
        await connection.execute(
            ``,
            { farmDemandId }
        );

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

        const farmDemandId = req.body.farmDemandId;

        connection = await connectDB();

        // Expected: UPDATE Farm_Demand SET Status = 'Rejected' WHERE Farm_Demand_ID = :farmDemandId
        await connection.execute(
            ``,
            { farmDemandId }
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
// Approved farm demands still waiting on a Farm_Supply (Create Supply dropdown)
// =====================================================

async function getApprovedRequests(req, res) {

    let connection;

    try {

        const officerId = Number(req.query.officerId);

        connection = await connectDB();

        // Expected columns: FARM_DEMAND_ID, RESOURCE_NAME, FARM_NAME, REQUESTED_QUANTITY
        // Tables: Farm_Demand, Resources, Farm
        // WHERE Status = 'Approved' AND NOT EXISTS (SELECT 1 FROM Farm_Supply fs
        //   WHERE fs.Farm_Demand_ID = Farm_Demand.Farm_Demand_ID)
        const result = await connection.execute(
            ``,
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
// Create Farm Supply
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

        // Next Farm_Supply_ID, following whatever ID pattern you're using (e.g. 'FS001')
        const idResult = await connection.execute(
            ``
        );
        const newFarmSupplyId = idResult.rows[0].NEW_ID;

        // INSERT INTO Farm_Supply (Farm_Supply_ID, Granted_Quantity, Cost, Creator_ID, Farm_Demand_ID, Supply_Date)
        await connection.execute(
            ``,
            { newFarmSupplyId, farmDemandId, grantedQuantity, cost, supplyDate, officerId }
        );

        await connection.commit();

        res.json({ success: true, farmSupplyId: newFarmSupplyId });

    } catch (error) {

        console.error("Create supply error:", error);

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

        // Next Budget_Request_ID, following whatever ID pattern you're using (e.g. 'BR001')
        const idResult = await connection.execute(
            ``
        );
        const newBudgetRequestId = idResult.rows[0].NEW_ID;

        // INSERT INTO Budget_Request
        // (Budget_Request_ID, Requested_Amount, Budget_Type, Creation_Date, Approval_Date,
        //  Approved_Budget, Status, Creator_ID, Director_Budget_ID)
        // VALUES (..., SYSDATE, SYSDATE, 0, 'Pending', :officerId,
        //   (SELECT Dir_Bud_ID FROM Director_Budget WHERE Budget_Type = :budgetType AND End_Date IS NULL))
        await connection.execute(
            ``,
            { newBudgetRequestId, requestedAmount, budgetType, officerId }
        );

        await connection.commit();

        res.json({ success: true, budgetRequestId: newBudgetRequestId });

    } catch (error) {

        console.error("Create budget request error:", error);

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
