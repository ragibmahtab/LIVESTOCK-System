const express = require("express");

const router = express.Router();

const {
    getDashboardStats,
    getProfile,
    updateProfile,
    getDemandRequests,
    approveDemandRequest,
    rejectDemandRequest,
    getApprovedRequests,
    createSupply,
    createBudgetRequest
} = require("../controllers/directorStoreController");

router.get("/director-store/dashboard-stats", getDashboardStats);

router.get("/director-store/profile", getProfile);
router.put("/director-store/profile", updateProfile);

router.get("/director-store/demand-requests", getDemandRequests);
router.post("/director-store/demand-requests/approve", approveDemandRequest);
router.post("/director-store/demand-requests/reject", rejectDemandRequest);

router.get("/director-store/approved-requests", getApprovedRequests);
router.post("/director-store/supply", createSupply);

router.post("/director-store/budget-request", createBudgetRequest);

module.exports = router;