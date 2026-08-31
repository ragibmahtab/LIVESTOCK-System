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
//   - All SQL query strings are left EMPTY on purpose — fill these in yourself.
//     A comment above each one describes the expected columns/joins/binds so
//     the shape lines up with what the frontend JS is expecting.
// ============================================================================

const { connectDB } = require('../db'); // adjust path to match your project structure
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
        // Join USER_INFO -> Farm_Manager -> Farm on Assigned_Farm = Farm_ID.
        const headerQuery = `

        `;

        // Total distinct resources tracked for this manager's assigned farm.
        // Resources joined to Farm_Manager via Farm_ID = Assigned_Farm.
        const totalResourcesQuery = `

        `;

        // Count of resources where Current_Quantity < Minimum_Quantity for this farm.
        const lowStockQuery = `

        `;

        // Count of this manager's Farm_Demand rows where Status = 'Pending'.
        const pendingDemandQuery = `

        `;

        // Count of Records rows created by this manager (Manager_ID) in the
        // current calendar month (Record_Date).
        const monthlyConsumptionQuery = `

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

        // Join USER_INFO -> Farm_Manager -> Farm (Assigned_Farm = Farm_ID)
        // to get name/username/email/candidate type/experience/farm details.
        const profileQuery = `

        `;

        // All phone numbers for this user from User_Phone.
        const phonesQuery = `

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
// Body: { managerId, name, email, phones: [{ oldPhone, newPhone }, ...] }
//
// Mirrors UPDATE_OFFICER_PROFILE: update USER_INFO.Name/Email, then for each
// phone pair -> if oldPhone is null it's a new number (INSERT), otherwise
// UPDATE User_Phone SET Phone = newPhone WHERE User_ID = :managerId AND
// Phone = :oldPhone. Wrap in a transaction; COMMIT once, ROLLBACK on error.
// ----------------------------------------------------------------------------
async function updateProfile(req, res) {
    const { managerId, name, email, phones } = req.body;
    let connection;

    try {
        connection = await connectDB();

        const updateUserInfoQuery = `

        `;

        await connection.execute(updateUserInfoQuery, { managerId, name, email });

        for (const pair of (phones || [])) {
            if (pair.oldPhone) {
                // Existing number being changed
                const updatePhoneQuery = `

                `;
                await connection.execute(updatePhoneQuery, { managerId, oldPhone: pair.oldPhone, newPhone: pair.newPhone });
            } else {
                // Brand new phone number for this user
                const insertPhoneQuery = `

                `;
                await connection.execute(insertPhoneQuery, { managerId, newPhone: pair.newPhone });
            }
        }

        await connection.commit();
        res.json({ message: 'Profile updated successfully.' });
    } catch (err) {
        console.error('updateProfile error:', err);
        if (connection) {
            try { await connection.rollback(); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
        }
        res.status(500).json({ message: 'Failed to update profile.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// GET /api/farm-manager/resources?managerId=...
// Returns: [ { RESOURCE_ID, NAME, TYPE, CURRENT_QUANTITY, MINIMUM_QUANTITY } ]
// Used by both "Farm Resource Check" and the resource dropdowns.
// ----------------------------------------------------------------------------
async function getFarmResources(req, res) {
    const { managerId, sort } = req.query; // sort: 'ASC' | 'DESC' (Current_Quantity), matches resourceSortSelect
    let connection;

    try {
        connection = await connectDB();

        // Resources for the farm this manager is assigned to.
        // Resources.Farm_ID = Farm_Manager.Assigned_Farm WHERE Manager_ID = :managerId
        // ORDER BY Current_Quantity ASC/DESC based on `sort` (default DESC).
        // NOTE: `sort` only ever comes from a fixed frontend dropdown (ASC/DESC),
        // but still validate/whitelist it server-side before interpolating into
        // ORDER BY (bind variables can't parameterize column direction).
        const resourcesQuery = `

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
// `status` is optional (used by the status filter dropdown).
// `limit` is optional (used by the dashboard's "recent requests" preview).
// ----------------------------------------------------------------------------
async function getDemandRequests(req, res) {
    const { managerId, status, limit } = req.query;
    let connection;

    try {
        connection = await connectDB();

        // Join Farm_Demand -> Resources on Resource_ID, filter by Creator_ID = :managerId.
        // If `status` is provided, add "AND Status = :status" — mirrors the
        // getDemandRequests status-dropdown pattern already used on the officer dashboard.
        // If `limit` is provided, order by most recent first and cap the row count
        // (e.g. FETCH FIRST :limit ROWS ONLY).
        let demandQuery = `

        `;

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
// Course requirement reminder: Farm_Demand.Approved_By_ID is NOT NULL in the
// schema even though this is the *creation* step (no approver chosen yet).
// Decide with your team whether that's handled with a placeholder/default
// Director_Production_ID, a DEFAULT constraint, or a trigger — and raise a
// user-defined exception (PRAGMA EXCEPTION_INIT style, per the course PDF) if
// Requested_Quantity <= 0 rather than letting Oracle throw a generic error.
// ----------------------------------------------------------------------------
async function createDemandRequest(req, res) {
    const { managerId, resourceId, requestedQuantity, estimatedCost, priority, description } = req.body;
    let connection;

    try {
        connection = await connectDB();

        // INSERT INTO Farm_Demand (...) VALUES (...) RETURNING Farm_Demand_ID INTO :outId
        // (or call a stored procedure that generates the ID via sequence/trigger,
        // matching the IU006-style auto-generated ID pattern used elsewhere).
        const insertDemandQuery = `

        `;

        const result = await connection.execute(insertDemandQuery, {
            managerId,
            resourceId,
            requestedQuantity,
            estimatedCost,
            priority,
            description,
            outId: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
        });

        await connection.commit();
        res.status(201).json({ FARM_DEMAND_ID: result.outBinds?.outId?.[0] });
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
// Body: { managerId, purpose, items: [{ resourceId, quantityUsed }, ...] }
// Returns: { CONSUMPTION_ID }
//
// Two-step insert matching the Consumption / Records header-detail pattern
// (same shape as Item_Usage / Uses on the officer dashboard):
//   1. INSERT INTO Consumption (Consumption_ID, Purpose) -> get new ID
//   2. For each item: INSERT INTO Records (Consumption_ID, Resource_ID,
//      Quantity_Used, Record_Date, Manager_ID)
// Consider also decrementing Resources.Current_Quantity per item here (or in
// a trigger/procedure) so Farm Resource Check stays accurate.
// ----------------------------------------------------------------------------
async function recordConsumption(req, res) {
    const { managerId, purpose, consumptionDate, items } = req.body;
    let connection;

    if (!Array.isArray(items) || !items.length) {
        return res.status(400).json({ message: 'At least one resource item is required.' });
    }

    try {
        connection = await connectDB();

        // Header insert -> generates/returns Consumption_ID
        const insertConsumptionQuery = `

        `;

        const headerResult = await connection.execute(insertConsumptionQuery, {
            purpose,
            outId: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
        });

        const consumptionId = headerResult.outBinds?.outId?.[0];

        // Detail insert, one per item row (explicit loop, mirrors the
        // multi-row usage-recording pattern already used for Uses/Item_Usage).
        const insertRecordQuery = `

        `;

        for (const item of items) {
            await connection.execute(insertRecordQuery, {
                consumptionId,
                resourceId: item.resourceId,
                quantityUsed: item.quantityUsed,
                recordDate: consumptionDate || null, // fall back to SYSDATE in your query if null
                managerId
            });
        }

        await connection.commit();
        res.status(201).json({ CONSUMPTION_ID: consumptionId });
    } catch (err) {
        console.error('recordConsumption error:', err);
        if (connection) {
            try { await connection.rollback(); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
        }
        res.status(500).json({ message: 'Failed to save consumption record.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// GET /api/farm-manager/notifications?managerId=...
// Returns: [ { RESOURCE_ID, NAME, CURRENT_QUANTITY, MINIMUM_QUANTITY } ]
//
// Course requirement reminder: implement this as an explicit cursor stored
// procedure (CURSOR / OPEN / LOOP FETCH INTO / EXIT WHEN %NOTFOUND / CLOSE),
// same live-recalculation-no-triggers approach as the officer dashboard's
// low-stock notification system, scoped to this manager's assigned farm.
// Call it here with connection.execute('BEGIN your_proc(:managerId, :cursor); END;', ...)
// and read the REF CURSOR out, or use a plain SELECT if you decide a cursor
// procedure is overkill for this view — your call, just keep it consistent
// with the officer dashboard's implementation.
// ----------------------------------------------------------------------------
async function getNotifications(req, res) {
    const { managerId } = req.query;
    let connection;

    try {
        connection = await connectDB();

        const lowStockQuery = `

        `;

        const result = await connection.execute(lowStockQuery, { managerId });
        res.json(result.rows);
    } catch (err) {
        console.error('getNotifications error:', err);
        res.status(500).json({ message: 'Failed to load notifications.' });
    } finally {
        if (connection) await connection.close();
    }
}

// ----------------------------------------------------------------------------
// GET /api/farm-manager/consumption-history?managerId=...&filter=all|most|least
// Returns: [ { CONSUMPTION_ID, RESOURCE_NAME, QUANTITY_USED, PURPOSE, RECORD_DATE } ]
//
// Join Records -> Consumption (Consumption_ID) -> Resources (Resource_ID),
// filtered by Records.Manager_ID = :managerId.
//   filter = 'all'   -> plain list, most recent Record_Date first
//   filter = 'most'  -> group by Resource, order by SUM(Quantity_Used) DESC
//   filter = 'least' -> group by Resource, order by SUM(Quantity_Used) ASC
// Mirrors the officer dashboard's Usage History All/Most/Least Used pattern.
// ----------------------------------------------------------------------------
async function getConsumptionHistory(req, res) {
    const { managerId, filter } = req.query;
    let connection;

    try {
        connection = await connectDB();

        let historyQuery;
        if (filter === 'most' || filter === 'least') {
            // Aggregated view: SUM(Quantity_Used) per resource, ordered accordingly
            historyQuery = `

            `;
        } else {
            // Plain chronological list
            historyQuery = `

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
