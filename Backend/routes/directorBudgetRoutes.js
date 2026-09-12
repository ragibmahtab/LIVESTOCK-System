const express = require("express");

const router = express.Router();

const {
    getDashboardStats,
    getProfile,
    updateProfile,
    getBudgetRequests,
    approveBudgetRequest,
    rejectBudgetRequest,
    getAnnualBudget
} = require("../controllers/directorBudgetController");

router.get("/director-budget/dashboard-stats", getDashboardStats);

router.get("/director-budget/profile", getProfile);
router.put("/director-budget/profile", updateProfile);

router.get("/director-budget/budget-requests", getBudgetRequests);
router.post("/director-budget/budget-requests/approve", approveBudgetRequest);
router.post("/director-budget/budget-requests/reject", rejectBudgetRequest);

router.get("/director-budget/annual-budget", getAnnualBudget);

module.exports = router;
