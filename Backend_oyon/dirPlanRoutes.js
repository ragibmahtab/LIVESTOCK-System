const express = require('express');
const router = express.Router();
const { executeQuery } = require('./db');

// ---------- 1. PROFILE (view) — uses VIEW: VW_DIRECTOR_PLANNING_PROFILE ----------
router.get('/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await executeQuery(
            `SELECT * FROM VW_DIRECTOR_PLANNING_PROFILE WHERE USER_ID = :userId`,
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
                planningDivision: row.PLANNING_DIVISION,
                appointmentDate: row.APPOINTMENT_DATE,
                phone: phoneResult.rows.length ? phoneResult.rows[0].PHONE : null
            }
        });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching profile' });
    }
});

// ---------- 2. PROFILE (edit) ----------
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

// ---------- 3. OVERVIEW STATS — uses FUNCTION: FN_GET_ADP_TOTAL_BUDGET ----------
router.get('/overview', async (req, res) => {
    try {
        const budgetResult = await executeQuery(
            `SELECT FN_GET_ADP_TOTAL_BUDGET() AS ADP_BUDGET FROM DUAL`
        );

        const ongoingResult = await executeQuery(
            `SELECT COUNT(*) AS ONGOING_COUNT FROM PROJECT
             WHERE END_DATE IS NULL OR END_DATE > SYSDATE`
        );

        res.json({
            success: true,
            overview: {
                adpBudget: budgetResult.rows[0].ADP_BUDGET,
                ongoingProjects: ongoingResult.rows[0].ONGOING_COUNT
            }
        });
    } catch (err) {
        console.error('Overview fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching overview' });
    }
});

// ---------- 4. ONGOING MAJOR PROJECTS (list) — uses FUNCTION for allocation ----------
router.get('/projects', async (req, res) => {
    try {
        
        const result = await executeQuery(
            `SELECT p.PROJECT_ID, p.NAME, p.START_DATE, p.END_DATE,
                    FN_GET_PROJECT_BUDGET(p.PROJECT_ID) AS ALLOCATION
             FROM PROJECT p
             ORDER BY p.START_DATE DESC`
        );
        res.json({ success: true, projects: result.rows });
    } catch (err) {
        console.error('Projects fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching projects' });
    }
});

// ---------- 5. BUDGET REQUESTS RECEIVED — uses VIEW: VW_PENDING_BUDGET_REQUESTS ----------
router.get('/budget-requests/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await executeQuery(
            `SELECT * FROM VW_PENDING_BUDGET_REQUESTS
             WHERE ALLOCATOR_ID = :userId
             ORDER BY REQUEST_DATE DESC`,
            { userId }
        );
        res.json({ success: true, requests: result.rows });
    } catch (err) {
        console.error('Budget requests fetch error:', err);
        res.status(500).json({ success: false, message: 'Server error fetching budget requests' });
    }
});

// ---------- 6. CREATE BUDGET REQUEST — calls PROCEDURE with EXCEPTION HANDLING ----------
router.post('/budget-request', async (req, res) => {
    const { userId, budgetType, requestedAmount } = req.body;
    if (!userId || !requestedAmount) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const newId = 'BR' + Date.now().toString().slice(-10);
    try {
        await executeQuery(
            `BEGIN
                 PROC_SUBMIT_BUDGET_REQUEST(:id, :requestedAmount, :budgetType, :userId);
             END;`,
            { id: newId, requestedAmount, budgetType, userId }
        );
        res.json({ success: true, message: 'Budget request submitted', id: newId });
    } catch (err) {
        console.error('Budget request insert error:', err);
        // ORA-20003 = no Director_Budget exists (raised inside the procedure)
        if (err.errorNum === 20003) {
            return res.status(500).json({ success: false, message: 'No Director Budget exists to route this request to' });
        }
        res.status(500).json({ success: false, message: 'Server error submitting budget request' });
    }
});

module.exports = router;