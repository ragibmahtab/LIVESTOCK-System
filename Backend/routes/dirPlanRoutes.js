const express = require("express");

const router = express.Router();

const {
    getProfile,
    updateProfile,
    getOverview,
    getProjects,
    getBudgetRequests,
    createBudgetRequest
} = require("../controllers/dirPlanController");

router.get("/director-planning/profile", getProfile);
router.put("/director-planning/profile", updateProfile);

router.get("/director-planning/overview", getOverview);

router.get("/director-planning/projects", getProjects);

router.get("/director-planning/budget-requests", getBudgetRequests);
router.post("/director-planning/budget-request", createBudgetRequest);

module.exports = router;
