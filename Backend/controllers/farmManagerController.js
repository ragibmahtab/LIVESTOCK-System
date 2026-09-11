const connectDB = require("../db");
const oracledb = require("oracledb");


// =====================================================
// Dashboard Overview
// =====================================================

async function getDashboardStats(req, res) {

    const { managerId } = req.query;
    let connection;

    try {

        connection = await connectDB();

        // Manager's name + assigned farm (LEFT JOIN because Assigned_Farm is nullable)
        const headerQuery = `
            SELECT u.Name, f.Name AS FARM_NAME
            FROM USER_INFO u
            JOIN Farm_Manager fm ON u.User_ID = fm.Manager_ID
            LEFT JOIN Farm f ON fm.Assigned_Farm = f.Farm_ID
            WHERE u.User_ID = :managerId
        `;

        // Resources tracked on this manager's farm
        const totalResourcesQuery = `
            SELECT COUNT(*) AS TOTAL_RESOURCES
            FROM Resources
            WHERE Farm_ID = (SELECT Assigned_Farm FROM Farm_Manager WHERE Manager_ID = :managerId)
        `;

        // Resources that fell below their minimum
        const lowStockQuery = `
            SELECT COUNT(*) AS LOW_STOCK_COUNT
            FROM Resources
            WHERE Farm_ID = (SELECT Assigned_Farm FROM Farm_Manager WHERE Manager_ID = :managerId)
            AND Current_Quantity < Minimum_Quantity
        `;

        // This manager's demand requests still waiting on a director
        const pendingDemandQuery = `
            SELECT COUNT(*) AS PENDING_DEMAND_COUNT
            FROM Farm_Demand
            WHERE Creator_ID = :managerId
            AND Status = 'Pending'
        `;

        // Consumption recorded this month (TRUNC 'MM' cuts a date to the 1st of its month)
        const monthlyConsumptionQuery = `
            SELECT COUNT(*) AS MONTHLY_CONSUMPTION_COUNT
            FROM Records
            WHERE Manager_ID = :managerId
            AND TRUNC(Record_Date, 'MM') = TRUNC(SYSDATE, 'MM')
        `;

        const headerResult = await connection.execute(headerQuery, { managerId });
        const totalResourcesResult = await connection.execute(totalResourcesQuery, { managerId });
        const lowStockResult = await connection.execute(lowStockQuery, { managerId });
        const pendingDemandResult = await connection.execute(pendingDemandQuery, { managerId });
        const monthlyConsumptionResult = await connection.execute(monthlyConsumptionQuery, { managerId });

        res.json({
            MANAGER_NAME: headerResult.rows[0]?.NAME,
            FARM_NAME: headerResult.rows[0]?.FARM_NAME,
            TOTAL_RESOURCES: totalResourcesResult.rows[0]?.TOTAL_RESOURCES,
            LOW_STOCK_COUNT: lowStockResult.rows[0]?.LOW_STOCK_COUNT,
            PENDING_DEMAND_COUNT: pendingDemandResult.rows[0]?.PENDING_DEMAND_COUNT,
            MONTHLY_CONSUMPTION_COUNT: monthlyConsumptionResult.rows[0]?.MONTHLY_CONSUMPTION_COUNT
        });

    } catch (err) {

        console.error("getDashboardStats error:", err);

        res.status(500).json({ message: "Failed to load dashboard stats." });

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

    const { managerId } = req.query;
    let connection;

    try {

        connection = await connectDB();

        const profileQuery = `
            SELECT u.Name, u.Username, u.Email,
                   fm.Candidate_Type, fm.Experience,
                   f.Name AS FARM_NAME,
                   f.Location AS FARM_LOCATION,
                   f.Scale AS FARM_SCALE
            FROM USER_INFO u
            JOIN Farm_Manager fm ON u.User_ID = fm.Manager_ID
            LEFT JOIN Farm f ON fm.Assigned_Farm = f.Farm_ID
            WHERE u.User_ID = :managerId
        `;

        const phonesQuery = `
            SELECT Phone FROM User_Phone WHERE User_ID = :managerId ORDER BY Phone
        `;

        const profileResult = await connection.execute(profileQuery, { managerId });
        const phonesResult = await connection.execute(phonesQuery, { managerId });

        if (profileResult.rows.length === 0) {
            return res.status(404).json({ message: "Farm manager profile not found." });
        }

        const profile = profileResult.rows[0];
        profile.PHONES = phonesResult.rows.map(row => row.PHONE);

        res.json(profile);

    } catch (err) {

        console.error("getProfile error:", err);

        res.status(500).json({ message: "Failed to load profile." });

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

    const { managerId, name, email, password, phones } = req.body;
    let connection;

    try {

        connection = await connectDB();

        // NVL keeps the old value when the form field was left blank
        const updateUserInfoQuery = `
            UPDATE USER_INFO
            SET Name = NVL(:name, Name),
                Email = NVL(:email, Email),
                Password = NVL(:password, Password)
            WHERE User_ID = :managerId
        `;

        await connection.execute(updateUserInfoQuery, {
            name: name || null,
            email: email || null,
            password: password || null,
            managerId
        });

        // Blank rows dropped here — User_Phone.Phone is NOT NULL
        const submitted = (phones || []).filter(p => p.newPhone);

        for (const pair of submitted) {

            if (pair.oldPhone) {
                await connection.execute(
                    `UPDATE User_Phone SET Phone = :newPhone
                     WHERE User_ID = :managerId AND Phone = :oldPhone`,
                    { managerId, oldPhone: pair.oldPhone, newPhone: pair.newPhone }
                );
            } else {
                await connection.execute(
                    `INSERT INTO User_Phone (User_ID, Phone) VALUES (:managerId, :newPhone)`,
                    { managerId, newPhone: pair.newPhone }
                );
            }
        }

        // The trash button only removes the row from the form, so whatever is
        // still in the table but not submitted back counts as a deletion
        const keptPhones = submitted.map(p => p.newPhone);

        const currentPhonesResult = await connection.execute(
            `SELECT Phone FROM User_Phone WHERE User_ID = :managerId`,
            { managerId }
        );

        for (const row of currentPhonesResult.rows) {
            if (!keptPhones.includes(row.PHONE)) {
                await connection.execute(
                    `DELETE FROM User_Phone WHERE User_ID = :managerId AND Phone = :phone`,
                    { managerId, phone: row.PHONE }
                );
            }
        }

        await connection.commit();

        res.json({ message: "Profile updated successfully." });

    } catch (err) {

        console.error("updateProfile error:", err);

        if (connection) {
            try { await connection.rollback(); } catch (rollbackErr) { console.error("Rollback failed:", rollbackErr); }
        }

        if (err.errorNum === 1) {
            return res.status(400).json({
                message: "That email or phone number is already used by another account."
            });
        }

        res.status(500).json({ message: "Failed to update profile." });

    } finally {

        if (connection) {
            await connection.close();
        }
    }
}


// =====================================================
// Farm Resource Check — also feeds the resource dropdowns
// =====================================================

async function getFarmResources(req, res) {

    const { managerId, sort } = req.query;
    let connection;

    // A bind can't carry ASC/DESC, so it is whitelisted to two fixed words
    const sortDirection = String(sort || "").toUpperCase() === "ASC" ? "ASC" : "DESC";

    try {

        connection = await connectDB();

        const resourcesQuery = `
            SELECT Resource_ID, Name, Type, Current_Quantity, Minimum_Quantity
            FROM Resources
            WHERE Farm_ID = (SELECT Assigned_Farm FROM Farm_Manager WHERE Manager_ID = :managerId)
            ORDER BY Current_Quantity ${sortDirection}, Name
        `;

        const result = await connection.execute(resourcesQuery, { managerId });

        res.json(result.rows);

    } catch (err) {

        console.error("getFarmResources error:", err);

        res.status(500).json({ message: "Failed to load farm resources." });

    } finally {

        if (connection) {
            await connection.close();
        }
    }
}


// =====================================================
// Check Demand Status — this manager's own requests
// =====================================================

async function getDemandRequests(req, res) {

    const { managerId, status, limit } = req.query;
    let connection;

    try {

        connection = await connectDB();

        // Farm_Demand has no date column, so newest = highest ID
        let demandQuery = `
            SELECT fd.Farm_Demand_ID, r.Name AS RESOURCE_NAME,
                   fd.Requested_Quantity, fd.Estimated_Cost,
                   fd.Priority, fd.Status
            FROM Farm_Demand fd
            JOIN Resources r ON fd.Resource_ID = r.Resource_ID
            WHERE fd.Creator_ID = :managerId
        `;

        if (status) {
            demandQuery += ` AND fd.Status = :status`;
        }

        demandQuery += ` ORDER BY fd.Farm_Demand_ID DESC`;

        // ROWNUM instead of FETCH FIRST (Oracle 11g). Wrapped in an outer SELECT
        // because ROWNUM is numbered before ORDER BY runs
        if (limit) {
            demandQuery = `SELECT * FROM (${demandQuery}) WHERE ROWNUM <= :limit`;
        }

        const binds = { managerId };
        if (status) binds.status = status;
        if (limit) binds.limit = Number(limit);

        const result = await connection.execute(demandQuery, binds);

        res.json(result.rows);

    } catch (err) {

        console.error("getDemandRequests error:", err);

        res.status(500).json({ message: "Failed to load demand requests." });

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

    const { managerId, resourceId, requestedQuantity, estimatedCost, priority, description } = req.body;
    let connection;

    const quantity = Number(requestedQuantity);

    if (!resourceId || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ message: "Pick a resource and enter a quantity above zero." });
    }

    try {

        connection = await connectDB();

        // Farm_Demand_ID and Approved_By_ID are filled by trg_farm_demand_id
        const result = await connection.execute(
            `INSERT INTO Farm_Demand
             (Resource_ID, Requested_Quantity, Estimated_Cost, Creator_ID, Status, Description, Priority)
             VALUES (:resourceId, :requestedQuantity, :estimatedCost, :managerId, 'Pending', :description, :priority)
             RETURNING Farm_Demand_ID INTO :newId`,
            {
                resourceId,
                requestedQuantity: quantity,
                estimatedCost: Number(estimatedCost) || 0,
                managerId,
                description: description || null,
                priority,
                newId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            }
        );

        const newFarmDemandId = result.outBinds.newId[0];

        await connection.commit();

        res.status(201).json({ FARM_DEMAND_ID: newFarmDemandId });

    } catch (err) {

        console.error("createDemandRequest error:", err);

        if (connection) {
            try { await connection.rollback(); } catch (rollbackErr) { console.error("Rollback failed:", rollbackErr); }
        }

        // -20015 and -20016 are raised by trg_farm_demand_id
        if (err.errorNum === 20015) {
            return res.status(400).json({
                message: "No serving Director (Production) handles this farm type, so the request cannot be routed."
            });
        }

        if (err.errorNum === 20016) {
            return res.status(500).json({
                message: "Data inconsistency: more than one serving Director (Production) found for this farm type."
            });
        }

        res.status(500).json({ message: "Failed to submit demand request." });

    } finally {

        if (connection) {
            await connection.close();
        }
    }
}


// =====================================================
// Record Consumption — one Consumption row, many Records rows
// =====================================================

async function recordConsumption(req, res) {

    const { managerId, purpose, consumptionDate, items } = req.body;
    let connection;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one resource item is required." });
    }

    // Records PK is (Consumption_ID, Resource_ID), so no repeats in one submission
    const resourceIds = items.map(i => i.resourceId);
    if (new Set(resourceIds).size !== resourceIds.length) {
        return res.status(400).json({ message: "The same resource is listed twice. Combine the rows into one." });
    }

    try {

        connection = await connectDB();

        // Consumption_ID is filled by trg_consumption_id
        const consumptionResult = await connection.execute(
            `INSERT INTO Consumption (Purpose) VALUES (:purpose)
             RETURNING Consumption_ID INTO :newId`,
            {
                purpose: purpose || null,
                newId: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 12 }
            }
        );

        const consumptionId = consumptionResult.outBinds.newId[0];

        // TO_DATE of NULL is NULL, so NVL falls back to today.
        // trg_records_stock_update checks the stock and takes the quantity off Resources
        const insertRecordQuery = `
            INSERT INTO Records
            (Consumption_ID, Resource_ID, Quantity_Used, Record_Date, Manager_ID)
            VALUES (:consumptionId, :resourceId, :quantityUsed,
                    NVL(TO_DATE(:recordDate, 'YYYY-MM-DD'), SYSDATE), :managerId)
        `;

        for (const item of items) {

            const quantityUsed = Number(item.quantityUsed);

            if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) {
                throw new Error("Every resource row needs a quantity above zero.");
            }

            await connection.execute(insertRecordQuery, {
                consumptionId,
                resourceId: item.resourceId,
                quantityUsed,
                recordDate: consumptionDate || null,
                managerId
            });
        }

        await connection.commit();

        res.status(201).json({ CONSUMPTION_ID: consumptionId });

    } catch (err) {

        console.error("recordConsumption error:", err);

        if (connection) {
            try { await connection.rollback(); } catch (rollbackErr) { console.error("Rollback failed:", rollbackErr); }
        }

        // -20017 and -20018 are raised by trg_records_stock_update
        if (err.errorNum === 20017) {
            return res.status(400).json({
                message: err.message.split("\n")[0].replace("ORA-20017: ", "")
            });
        }

        if (err.errorNum === 20018) {
            return res.status(400).json({ message: "One of the selected resources no longer exists." });
        }

        res.status(500).json({ message: err.message || "Failed to save consumption record." });

    } finally {

        if (connection) {
            await connection.close();
        }
    }
}


// =====================================================
// Notifications — low stock, via the get_farm_low_stock procedure
// =====================================================

async function getNotifications(req, res) {

    const { managerId } = req.query;
    let connection;
    let resultSet;

    try {

        connection = await connectDB();

        // Procedure walks an explicit cursor and returns the low rows as a REF CURSOR
        const result = await connection.execute(
            `BEGIN get_farm_low_stock(:managerId, :cursor); END;`,
            {
                managerId: managerId,
                cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR }
            }
        );

        // A REF CURSOR is a pointer, so the rows have to be pulled across
        resultSet = result.outBinds.cursor;
        const rows = await resultSet.getRows();

        res.json(rows);

    } catch (err) {

        console.error("getNotifications error:", err);

        // -20001 and -20002 are raised by the procedure on purpose
        if (err.errorNum === 20001 || err.errorNum === 20002) {
            return res.status(400).json({ message: err.message });
        }

        res.status(500).json({ message: "Failed to load notifications." });

    } finally {

        // Unclosed cursors pile up until ORA-01000
        if (resultSet) {
            try { await resultSet.close(); } catch (closeErr) { console.error("Cursor close failed:", closeErr); }
        }

        if (connection) {
            await connection.close();
        }
    }
}


// =====================================================
// Consumption History — All / Most Used / Least Used
// =====================================================

async function getConsumptionHistory(req, res) {

    const { managerId, filter } = req.query;
    let connection;

    try {

        connection = await connectDB();

        let historyQuery;

        if (filter === "most" || filter === "least") {

            const direction = filter === "most" ? "DESC" : "ASC";

            // Grouped per resource, but kept to the same five column names as the
            // All view so the one table in the HTML can render either one
            historyQuery = `
                SELECT r.Resource_ID AS CONSUMPTION_ID,
                       r.Name AS RESOURCE_NAME,
                       SUM(rec.Quantity_Used) AS QUANTITY_USED,
                       COUNT(*) || ' time(s) used' AS PURPOSE,
                       MAX(rec.Record_Date) AS RECORD_DATE
                FROM Records rec
                JOIN Resources r ON rec.Resource_ID = r.Resource_ID
                WHERE rec.Manager_ID = :managerId
                GROUP BY r.Resource_ID, r.Name
                ORDER BY SUM(rec.Quantity_Used) ${direction}
            `;

        } else {

            historyQuery = `
                SELECT rec.Consumption_ID,
                       r.Name AS RESOURCE_NAME,
                       rec.Quantity_Used,
                       c.Purpose,
                       rec.Record_Date
                FROM Records rec
                JOIN Consumption c ON rec.Consumption_ID = c.Consumption_ID
                JOIN Resources r ON rec.Resource_ID = r.Resource_ID
                WHERE rec.Manager_ID = :managerId
                ORDER BY rec.Record_Date DESC, rec.Consumption_ID DESC
            `;
        }

        const result = await connection.execute(historyQuery, { managerId });

        res.json(result.rows);

    } catch (err) {

        console.error("getConsumptionHistory error:", err);

        res.status(500).json({ message: "Failed to load consumption history." });

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
    getFarmResources,
    getDemandRequests,
    createDemandRequest,
    recordConsumption,
    getConsumptionHistory,
    getNotifications
};