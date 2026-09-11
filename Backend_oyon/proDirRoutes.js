const express = require('express');
const router = express.Router();
const oracledb = require('oracledb');
const { executeQuery } = require('./db');

// ---------- 1. PROFILE (view) — uses VIEW: VW_PROJECT_DIRECTOR_PROFILE ----------
router.get('/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await executeQuery(
            `SELECT * FROM VW_PROJECT_DIRECTOR_PROFILE WHERE USER_ID = :userId`,
            { userId }
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        const phoneResult = await executeQuery(
            `SELECT PHONE FROM USER_PHONE WHERE USER_ID = :userId`,
            { userId }
        );

        const row = result.rows[0];
        res.json({
            success: true,
            profile: {
                userId: row.USER_ID,
                name: row.NAME,
                email: row.EMAIL,
                username: row.USERNAME,
                gradationNo: row.GRADATION_NO,
                projectName: row.PROJECT_NAME,
                phone: phoneResult.rows.length ? phoneResult.rows[0].PHONE : null
            }
        });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching profile' });
    }
});

// ---------- 2. PROFILE (edit) — plain UPDATE, no view needed for writes ----------
router.put('/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    const { name, email, phone, password } = req.body;
    try {
        if (password && password.trim() !== '') {
            await executeQuery(
                `UPDATE USER_INFO SET NAME = :name, EMAIL = :email, PASSWORD = :password WHERE USER_ID = :userId`,
                { name, email, password, userId }
            );
        } else {
            await executeQuery(
                `UPDATE USER_INFO SET NAME = :name, EMAIL = :email WHERE USER_ID = :userId`,
                { name, email, userId }
            );
        }
        if (phone) {
            await executeQuery(`DELETE FROM USER_PHONE WHERE USER_ID = :userId`, { userId });
            await executeQuery(
                `INSERT INTO USER_PHONE (USER_ID, PHONE) VALUES (:userId, :phone)`,
                { userId, phone }
            );
        }
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ success: false, message: 'Server error updating profile' });
    }
});

// ---------- 3. PROJECT DETAILS ----------
router.get('/project-details/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await executeQuery(
            `SELECT p.PROJECT_ID, p.NAME, p.START_DATE, p.END_DATE,
                    p.VILLAGE, p.UNION_NAME, p.UPAZILA, p.DISTRICT, p.TYPE
             FROM PROJECT p
             JOIN PROJECT_DIRECTOR pd ON pd.PROJECT_ID = p.PROJECT_ID
             WHERE pd.PROJECT_DIRECTOR_ID = :userId`,
            { userId }
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        res.json({ success: true, project: result.rows[0] });
    } catch (err) {
        console.error('Project details fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching project details' });
    }
});

// ---------- 4. PROJECT PLAN ----------
router.get('/plan/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // SUBQUERY: project id is looked up inline instead of a separate round-trip
        const planResult = await executeQuery(
            `SELECT FISCAL_YEAR, ITEM_NAME, TYPE, QUANTITY, ESTIMATED_COST
             FROM PLAN
             WHERE PROJECT_ID = (
                 SELECT PROJECT_ID FROM PROJECT_DIRECTOR WHERE PROJECT_DIRECTOR_ID = :userId
             )
             ORDER BY FISCAL_YEAR`,
            { userId }
        );
        res.json({ success: true, plan: planResult.rows });
    } catch (err) {
        console.error('Plan fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching plan' });
    }
});

// ---------- 5. PURCHASE RECORDS (list) ----------
router.get('/purchase-records/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await executeQuery(
            `SELECT PURCHASE_RECORD_ID, ITEM_NAME, FISCAL_YEAR, COST, PURCHASE_DATE, QUANTITY
             FROM PURCHASE_RECORD
             WHERE PROJECT_DIRECTOR_ID = :userId
             ORDER BY PURCHASE_DATE DESC`,
            { userId }
        );
        res.json({ success: true, records: result.rows });
    } catch (err) {
        console.error('Purchase record fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching purchase records' });
    }
});

// ---------- 5b. PURCHASE SUMMARY — calls PROCEDURE that uses a CURSOR ----------
router.get('/purchase-summary/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await executeQuery(
            `BEGIN
                 PROC_PURCHASE_SUMMARY(:userId, :totalCost, :recordCount);
             END;`,
            {
                userId,
                totalCost: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
                recordCount: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            }
        );
        res.json({
            success: true,
            totalCost: result.outBinds.totalCost,
            recordCount: result.outBinds.recordCount
        });
    } catch (err) {
        console.error('Purchase summary error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching purchase summary' });
    }
});

// ---------- 6. PURCHASE RECORDS (add new) — calls PROCEDURE with EXCEPTION HANDLING ----------
router.post('/purchase-records', async (req, res) => {
    const { userId, itemName, fiscalYear, cost, purchaseDate, quantity } = req.body;
    if (!userId || !itemName || !cost || !quantity) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const newId = 'PR' + Date.now().toString().slice(-10);
    try {
        await executeQuery(
            `BEGIN
                 PROC_INSERT_PURCHASE_RECORD(:id, :itemName, :fiscalYear, :cost,
                     TO_DATE(:purchaseDate, 'YYYY-MM-DD'), :quantity, :userId);
             END;`,
            { id: newId, itemName, fiscalYear, cost, purchaseDate, quantity, userId }
        );
        res.json({ success: true, message: 'Purchase record added', id: newId });
    } catch (err) {
        console.error('Purchase record insert error:', err);
        // ORA-20001 = invalid cost, ORA-20002 = duplicate id (raised inside the procedure)
        if (err.errorNum === 20001) {
            return res.status(400).json({ success: false, message: 'Cost must be a positive number' });
        }
        if (err.errorNum === 20002) {
            return res.status(400).json({ success: false, message: 'Duplicate record ID, please try again' });
        }
        res.status(500).json({ success: false, message: 'Server error saving purchase record' });
    }
});

// ---------- 7. BUDGET REQUEST (submit) ----------
router.post('/budget-request', async (req, res) => {
    const { userId, requestedAmount, priority } = req.body;
    if (!userId || !requestedAmount || !priority) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    try {
        const allocatorResult = await executeQuery(
            `SELECT DIRECTOR_PLAN_ID FROM DIRECTOR_PLANNING WHERE ROWNUM = 1`
        );
        if (!allocatorResult.rows.length) {
            return res.status(500).json({ success: false, message: 'No planning director exists to route this request to' });
        }
        const allocatorId = allocatorResult.rows[0].DIRECTOR_PLAN_ID;
        const newId = 'PBR' + Date.now().toString().slice(-9);

        await executeQuery(
            `INSERT INTO PROJECT_BUDGET_REQUEST
                (PROJECT_BUDGET_REQUEST_ID, REQUESTED_AMOUNT, ALLOCATED_AMOUNT, REQUESTER_ID, ALLOCATOR_ID, STATUS, REQUEST_DATE, PRIORITY)
             VALUES
                (:id, :requestedAmount, 0, :userId, :allocatorId, 'Pending', SYSDATE, :priority)`,
            { id: newId, requestedAmount, userId, allocatorId, priority }
        );
        res.json({ success: true, message: 'Budget request submitted', id: newId });
    } catch (err) {
        console.error('Budget request insert error:', err);
        res.status(500).json({ success: false, message: 'Server error submitting budget request' });
    }
});

// ---------- 8. OVERVIEW STATS — uses FUNCTION (+ SUBQUERY inside the call) ----------
router.get('/overview/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        
        const budgetResult = await executeQuery(
            `SELECT FN_GET_PROJECT_BUDGET(
                 (SELECT PROJECT_ID FROM PROJECT_DIRECTOR WHERE PROJECT_DIRECTOR_ID = :userId)
             ) AS TOTAL_BUDGET
             FROM DUAL`,
            { userId }
        );

        const pendingResult = await executeQuery(
            `SELECT COUNT(*) AS PENDING_COUNT FROM PROJECT_BUDGET_REQUEST
             WHERE REQUESTER_ID = :userId AND STATUS = 'Pending'`,
            { userId }
        );

        res.json({
            success: true,
            overview: {
                totalBudget: budgetResult.rows[0].TOTAL_BUDGET,
                pendingProposals: pendingResult.rows[0].PENDING_COUNT
            }
        });
    } catch (err) {
        console.error('Overview fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching overview' });
    }
});

module.exports = router;