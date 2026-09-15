const express = require("express");

const router = express.Router();

const {
    getProfile,
    updateProfile,
    getProjectDetails,
    getPlan,
    getPurchaseRecords,
    getPurchaseSummary,
    createPurchaseRecord,
    createBudgetRequest,
    getOverview
} = require("../controllers/projectDirectorController");

router.get("/project-director/profile", getProfile);
router.put("/project-director/profile", updateProfile);

router.get("/project-director/project-details", getProjectDetails);

router.get("/project-director/plan", getPlan);

router.get("/project-director/purchase-records", getPurchaseRecords);
router.get("/project-director/purchase-summary", getPurchaseSummary);
router.post("/project-director/purchase-records", createPurchaseRecord);

router.post("/project-director/budget-request", createBudgetRequest);

router.get("/project-director/overview", getOverview);

module.exports = router;
