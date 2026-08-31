// ============================================================================
// farmManagerController.js
// Backend controller for the Farm Manager dashboard.
//
// Conventions followed (per project rules):
//   - Always get connections through connectDB(), never oracledb.getConnection()
//   - No trailing semicolons inside SQL template literals
//   - No double-quoted column aliases -> Oracle auto-uppercases them, and the
//     frontend JS reads rows by ALL-CAPS keys (e.g. row.CURRENT_QUANTITY)
//   - Always COMMIT after INSERT/UPDATE
//
// TWO THINGS THAT WERE BROKEN IN THE STUB AND ARE FIXED HERE:
//   1. The import. Backend/db.js does `module.exports = connectDB`, so
//      `const { connectDB } = require('../db')` gives undefined and every
//      request crashes. It must be a plain import, same as the other
//      controllers in this project.
//   2. updateProfile never handled `password`, even though the frontend
//      sends it, and never deleted removed phone numbers.
// ============================================================================

const connectDB = require('../db'); // adjust path to match your project structure
const oracledb = require('oracledb');

// ----------------------------------------------------------------------------
// GET /api/farm-manager/dashboard-stats?managerId=...
// Returns: { MANAGER_NAME, FARM_NAME, TOTAL_RESOURCES, LOW_STOCK_COUNT,
//            PENDING_DEMAND_COUNT, MONTHLY_CONSUMPTION_COUNT }
// ----------------------------------------------------------------------------
async function getDashboardStats(req, res) {
    const { managerId } = req.query;
    let connection;

    try {
        connection = await connectDB();

        // Header info: manager's name + assigned farm name.
        // LEFT JOIN on Farm because Assigned_Farm is nullable in the schema,
        // so a newly hired manager with no farm yet still gets a name back.
        const headerQuery = `
            SELECT u.Name, f.Name AS FARM_NAME
            FROM USER_INFO u
            JOIN Farm_Manager fm ON u.User_ID = fm.Manager_ID
            LEFT JOIN Farm f ON fm.Assigned_Farm = f.Farm_ID
            WHERE u.User_ID = :managerId
        `;

        // Total resources tracked on this manager's assigned farm.
        const totalResourcesQuery = `
            SELECT COUNT(*) AS TOTAL_RESOURCES
            FROM Resources
            WHERE Farm_ID = (SELECT Assigned_Farm FROM Farm_Manager
                             WHERE Manager_ID = :managerId)
        `;

        // Resources that have dropped below their minimum on this farm.
        const lowStockQuery = `
            SELECT COUNT(*) AS LOW_STOCK_COUNT
            FROM Resources
            WHERE Farm_ID = (SELECT Assigned_Farm FROM Farm_Manager
                             WHERE Manager_ID = :managerId)
            AND Current_Quantity < Minimum_Quantity
        `;

        // This manager's demand requests still waiting on a director.
        const pendingDemandQuery = `
            SELECT COUNT(*) AS PENDING_DEMAND_COUNT
            FROM Farm_Demand
            WHERE Creator_ID = :managerId
            AND Status = 'Pending'
        `;

        // Consumption rows this manager recorded in the current calendar month.
        // TRUNC(date, 'MM') cuts a date back to the 1st of its month, so this
        // compares "the month of Record_Date" with "the month of today".
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
        console.error('getDashboardStats error:', err);
        res.status(500).json({ message: 'Failed to load dashboard stats.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// GET /api/farm-manager/profile?managerId=...
// Returns: { NAME, USERNAME, EMAIL, CANDIDATE_TYPE, EXPERIENCE,
//            FARM_NAME, FARM_LOCATION, FARM_SCALE, PHONES: [ '...', '...' ] }
// ----------------------------------------------------------------------------
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
            SELECT Phone
            FROM User_Phone
            WHERE User_ID = :managerId
            ORDER BY Phone
        `;

        const profileResult = await connection.execute(profileQuery, { managerId });
        const phonesResult = await connection.execute(phonesQuery, { managerId });

        if (!profileResult.rows.length) {
            return res.status(404).json({ message: 'Farm manager profile not found.' });
        }

        const profile = profileResult.rows[0];
        res.json({
            ...profile,
            PHONES: phonesResult.rows.map(r => r.PHONE)
        });
    } catch (err) {
        console.error('getProfile error:', err);
        res.status(500).json({ message: 'Failed to load profile.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// PUT /api/farm-manager/profile
// Body: { managerId, name, email, password, phones: [{ oldPhone, newPhone }] }
//
// NVL(:value, Column) means "use the new value, but keep the old one if the
// new value is NULL". Oracle treats an empty string as NULL, so a field the
// user left blank on the form is simply left unchanged.
// ----------------------------------------------------------------------------
async function updateProfile(req, res) {
    const { managerId, name, email, password, phones } = req.body;
    let connection;

    try {
        connection = await connectDB();

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

        const submitted = (phones || []).filter(p => p.newPhone);

        for (const pair of submitted) {
            if (pair.oldPhone) {
                // Existing number being changed
                const updatePhoneQuery = `
                    UPDATE User_Phone
                    SET Phone = :newPhone
                    WHERE User_ID = :managerId AND Phone = :oldPhone
                `;
                await connection.execute(updatePhoneQuery, {
                    managerId, oldPhone: pair.oldPhone, newPhone: pair.newPhone
                });
            } else {
                // Brand new phone number for this user
                const insertPhoneQuery = `
                    INSERT INTO User_Phone (User_ID, Phone)
                    VALUES (:managerId, :newPhone)
                `;
                await connection.execute(insertPhoneQuery, {
                    managerId, newPhone: pair.newPhone
                });
            }
        }

        // The frontend's trash button just removes the row from the form, so a
        // deleted number never reaches us. Anything still in the table that the
        // user did not submit back is therefore a deletion.
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
        res.json({ message: 'Profile updated successfully.' });
    } catch (err) {
        console.error('updateProfile error:', err);
        if (connection) {
            try { await connection.rollback(); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
        }
        if (err.errorNum === 1) {
            return res.status(400).json({
                message: 'That email or phone number is already used by another account.'
            });
        }
        res.status(500).json({ message: 'Failed to update profile.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// GET /api/farm-manager/resources?managerId=...&sort=ASC|DESC
// Returns: [ { RESOURCE_ID, NAME, TYPE, CURRENT_QUANTITY, MINIMUM_QUANTITY } ]
// Used by both "Farm Resource Check" and the resource dropdowns.
// ----------------------------------------------------------------------------
async function getFarmResources(req, res) {
    const { managerId, sort } = req.query;
    let connection;

    // A bind variable cannot carry ASC/DESC, so the direction has to be pasted
    // into the string. Anything that is not exactly 'ASC' becomes 'DESC', which
    // means no user input ever reaches the SQL text.
    const sortDirection = String(sort || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    try {
        connection = await connectDB();

        const resourcesQuery = `
            SELECT Resource_ID, Name, Type, Current_Quantity, Minimum_Quantity
            FROM Resources
            WHERE Farm_ID = (SELECT Assigned_Farm FROM Farm_Manager
                             WHERE Manager_ID = :managerId)
            ORDER BY Current_Quantity ${sortDirection}, Name
        `;

        const result = await connection.execute(resourcesQuery, { managerId });
        res.json(result.rows);
    } catch (err) {
        console.error('getFarmResources error:', err);
        res.status(500).json({ message: 'Failed to load farm resources.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// GET /api/farm-manager/demand-requests?managerId=...&status=...&limit=...
// Returns: [ { FARM_DEMAND_ID, RESOURCE_NAME, REQUESTED_QUANTITY,
//              ESTIMATED_COST, PRIORITY, STATUS } ]
//
// NOTE: Farm_Demand has no date column, so "most recent" is approximated by
// sorting on Farm_Demand_ID descending. Since IDs are handed out in order
// (FD001, FD002, ...), the newest request always has the highest ID.
// ----------------------------------------------------------------------------
async function getDemandRequests(req, res) {
    const { managerId, status, limit } = req.query;
    let connection;

    try {
        connection = await connectDB();

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

        // Row capping uses ROWNUM, not FETCH FIRST ... ROWS ONLY, because this
        // project runs on Oracle 11g XE where FETCH FIRST does not exist.
        // ROWNUM is numbered before ORDER BY runs, so the sorted query has to
        // be wrapped in an outer SELECT or you get 5 random rows, not the top 5.
        if (limit) {
            demandQuery = `SELECT * FROM (${demandQuery}) WHERE ROWNUM <= :limit`;
        }

        const binds = { managerId };
        if (status) binds.status = status;
        if (limit) binds.limit = Number(limit);

        const result = await connection.execute(demandQuery, binds);
        res.json(result.rows);
    } catch (err) {
        console.error('getDemandRequests error:', err);
        res.status(500).json({ message: 'Failed to load demand requests.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// POST /api/farm-manager/demand-requests
// Body: { managerId, resourceId, requestedQuantity, estimatedCost, priority, description }
// Returns: { FARM_DEMAND_ID }
//
// Farm_Demand.Approved_By_ID is NOT NULL, so a request cannot be saved without
// an approver. We look up the serving Director (Production) whose Farm_Type
// matches the type of the farm that owns this resource:
//     Resources -> Farm -> Farm.Type = Director_Production.Farm_Type
// End_Date IS NULL means the director is still in the post.
// This is the same routing the director-production dashboard reads back with
// "Approved_By_ID = :officerId", so the two pages stay in sync.
// ----------------------------------------------------------------------------
async function createDemandRequest(req, res) {
    const { managerId, resourceId, requestedQuantity, estimatedCost, priority, description } = req.body;
    let connection;

    const quantity = Number(requestedQuantity);

    if (!resourceId || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Pick a resource and enter a quantity above zero.' });
    }

    try {
        connection = await connectDB();

        // Find the director who will receive this request.
        // Checked separately so we can give a clear message instead of letting
        // Oracle throw a NOT NULL error the user cannot understand.
        // NOTE: this is written with ROWNUM, not FETCH FIRST ... ROWS ONLY.
        // FETCH FIRST needs Oracle 12c, and this project runs on 11g XE.
        // The sort has to happen in an inner query first, because ROWNUM is
        // assigned before ORDER BY runs.
        const approverResult = await connection.execute(
            `SELECT Director_Production_ID FROM (
                 SELECT dp.Director_Production_ID
                 FROM Director_Production dp
                 JOIN Farm f ON f.Type = dp.Farm_Type
                 JOIN Resources r ON r.Farm_ID = f.Farm_ID
                 WHERE r.Resource_ID = :resourceId
                 AND dp.End_Date IS NULL
                 ORDER BY dp.Appointment_Date DESC
             )
             WHERE ROWNUM = 1`,
            { resourceId }
        );

        if (!approverResult.rows.length) {
            return res.status(400).json({
                message: 'No serving Director (Production) is assigned to this farm type yet, so the request cannot be routed.'
            });
        }

        const approverId = approverResult.rows[0].DIRECTOR_PRODUCTION_ID;

        // Next Farm_Demand_ID in the 'FD001' pattern.
        // SUBSTR starts at 3 because the prefix 'FD' is two characters long.
        const idResult = await connection.execute(
            `SELECT 'FD' || LPAD(NVL(MAX(TO_NUMBER(SUBSTR(Farm_Demand_ID, 3))), 0) + 1, 3, '0') AS NEW_ID
             FROM Farm_Demand`
        );
        const newFarmDemandId = idResult.rows[0].NEW_ID;

        const insertDemandQuery = `
            INSERT INTO Farm_Demand
            (Farm_Demand_ID, Resource_ID, Requested_Quantity, Estimated_Cost,
             Creator_ID, Approved_By_ID, Status, Description, Priority)
            VALUES (:newFarmDemandId, :resourceId, :requestedQuantity, :estimatedCost,
                    :managerId, :approverId, 'Pending', :description, :priority)
        `;

        await connection.execute(insertDemandQuery, {
            newFarmDemandId,
            resourceId,
            requestedQuantity: quantity,
            estimatedCost: Number(estimatedCost) || 0,
            managerId,
            approverId,
            description: description || null,
            priority
        });

        await connection.commit();
        res.status(201).json({ FARM_DEMAND_ID: newFarmDemandId });
    } catch (err) {
        console.error('createDemandRequest error:', err);
        if (connection) {
            try { await connection.rollback(); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
        }
        res.status(500).json({ message: 'Failed to submit demand request.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// POST /api/farm-manager/consumption
// Body: { managerId, purpose, consumptionDate, items: [{ resourceId, quantityUsed }] }
// Returns: { CONSUMPTION_ID }
//
// Header-detail pattern, same shape as Item_Usage / Uses on the officer side:
//   1. One row in Consumption (the "why")
//   2. One row per resource in Records (the "what and how much")
// Records has PRIMARY KEY (Consumption_ID, Resource_ID), so the same resource
// cannot appear twice inside one submission — that is checked below.
// ----------------------------------------------------------------------------
async function recordConsumption(req, res) {
    const { managerId, purpose, consumptionDate, items } = req.body;
    let connection;

    if (!Array.isArray(items) || !items.length) {
        return res.status(400).json({ message: 'At least one resource item is required.' });
    }

    const resourceIds = items.map(i => i.resourceId);
    if (new Set(resourceIds).size !== resourceIds.length) {
        return res.status(400).json({
            message: 'The same resource is listed twice. Combine the rows into one.'
        });
    }

    try {
        connection = await connectDB();

        // Next Consumption_ID in the 'C001' pattern.
        // SUBSTR starts at 2 because the prefix 'C' is one character long.
        const idResult = await connection.execute(
            `SELECT 'C' || LPAD(NVL(MAX(TO_NUMBER(SUBSTR(Consumption_ID, 2))), 0) + 1, 3, '0') AS NEW_ID
             FROM Consumption`
        );
        const consumptionId = idResult.rows[0].NEW_ID;

        const insertConsumptionQuery = `
            INSERT INTO Consumption (Consumption_ID, Purpose)
            VALUES (:consumptionId, :purpose)
        `;

        await connection.execute(insertConsumptionQuery, {
            consumptionId,
            purpose: purpose || null
        });

        // TO_DATE of a NULL is still NULL, so NVL falls back to today's date
        // when the form's date field was left empty.
        const insertRecordQuery = `
            INSERT INTO Records
            (Consumption_ID, Resource_ID, Quantity_Used, Record_Date, Manager_ID)
            VALUES (:consumptionId, :resourceId, :quantityUsed,
                    NVL(TO_DATE(:recordDate, 'YYYY-MM-DD'), SYSDATE), :managerId)
        `;

        // Using up a resource lowers the farm's stock. GREATEST(..., 0) stops
        // the stock going negative if someone over-reports.
        const updateStockQuery = `
            UPDATE Resources
            SET Current_Quantity = GREATEST(Current_Quantity - :quantityUsed, 0)
            WHERE Resource_ID = :resourceId
        `;

        for (const item of items) {
            const quantityUsed = Number(item.quantityUsed);

            if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) {
                throw new Error('Every resource row needs a quantity above zero.');
            }

            await connection.execute(insertRecordQuery, {
                consumptionId,
                resourceId: item.resourceId,
                quantityUsed,
                recordDate: consumptionDate || null,
                managerId
            });

            await connection.execute(updateStockQuery, {
                quantityUsed,
                resourceId: item.resourceId
            });
        }

        await connection.commit();
        res.status(201).json({ CONSUMPTION_ID: consumptionId });
    } catch (err) {
        console.error('recordConsumption error:', err);
        if (connection) {
            try { await connection.rollback(); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
        }
        res.status(500).json({ message: err.message || 'Failed to save consumption record.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// GET /api/farm-manager/notifications?managerId=...
// Returns: [ { RESOURCE_ID, NAME, CURRENT_QUANTITY, MINIMUM_QUANTITY } ]
//
// Calls the stored procedure get_farm_low_stock, which walks an explicit
// cursor (OPEN / FETCH / EXIT WHEN %NOTFOUND / CLOSE) over the farm's
// resources and hands back the low ones through a REF CURSOR.
// Recalculated on every call, so no trigger is needed to keep it correct.
// ----------------------------------------------------------------------------
async function getNotifications(req, res) {
    const { managerId } = req.query;
    let connection;
    let resultSet;

    try {
        connection = await connectDB();

        // The procedure has two parameters: the manager ID going in, and a
        // REF CURSOR coming back out. oracledb.CURSOR is the bind type for it.
        const result = await connection.execute(
            `BEGIN get_farm_low_stock(:managerId, :cursor); END;`,
            {
                managerId: managerId,
                cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR }
            }
        );

        // A REF CURSOR is a pointer, not the rows themselves. getRows() pulls
        // the rows across, and the cursor must be closed afterwards or the
        // database keeps the handle open.
        resultSet = result.outBinds.cursor;
        const rows = await resultSet.getRows();

        res.json(rows);
    } catch (err) {
        console.error('getNotifications error:', err);

        // -20001 and -20002 are the two errors the procedure raises on purpose.
        // Show those to the user, and hide anything else behind a generic line.
        if (err.errorNum === 20001 || err.errorNum === 20002) {
            return res.status(400).json({ message: err.message });
        }

        res.status(500).json({ message: 'Failed to load notifications.' });
    } finally {
        if (resultSet) {
            try { await resultSet.close(); } catch (closeErr) { console.error('Cursor close failed:', closeErr); }
        }
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// GET /api/farm-manager/consumption-history?managerId=...&filter=all|most|least
// Returns: [ { CONSUMPTION_ID, RESOURCE_NAME, QUANTITY_USED, PURPOSE, RECORD_DATE } ]
//
// All three filters return the same five column names on purpose, so the one
// table in the HTML can render any of them without extra frontend code.
// In the most/least views the columns are reused: CONSUMPTION_ID holds the
// resource id, QUANTITY_USED holds the total, PURPOSE holds how many times it
// was used, and RECORD_DATE holds the last time it was used.
// ----------------------------------------------------------------------------
async function getConsumptionHistory(req, res) {
    const { managerId, filter } = req.query;
    let connection;

    try {
        connection = await connectDB();

        let historyQuery;

        if (filter === 'most' || filter === 'least') {
            const direction = filter === 'most' ? 'DESC' : 'ASC';

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
        console.error('getConsumptionHistory error:', err);
        res.status(500).json({ message: 'Failed to load consumption history.' });
    } finally {
        if (connection) await connection.close();
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