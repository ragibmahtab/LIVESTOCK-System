const express = require("express");

const router = express.Router();

const {
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
} = require("../controllers/directorProductionController");

router.get("/director-production/dashboard-stats", getDashboardStats);

router.get("/director-production/farms", getFarms);

router.get("/director-production/profile", getProfile);
router.put("/director-production/profile", updateProfile);

router.get("/director-production/demand-requests", getDemandRequests);
router.post("/director-production/demand-requests/approve", approveDemandRequest);
router.post("/director-production/demand-requests/reject", rejectDemandRequest);

router.get("/director-production/approved-requests", getApprovedRequests);
router.post("/director-production/supply", createSupply);

router.post("/director-production/budget-request", createBudgetRequest);

module.exports = router;
