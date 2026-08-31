const express = require("express");

const router = express.Router();

const {
    getDashboardStats,
    getProfile,
    updateProfile,
    getUpazilaRequests,
    getStoreInventory,
    getDistrictUpazilas,
    searchUpazilaRequests
} = require("../controllers/districtController");

// Dashboard Overview
router.get("/district/dashboard-stats", getDashboardStats);

// View / Edit Profile
router.get("/district/profile", getProfile);
router.put("/district/profile", updateProfile);

// View Upazila Requests
router.get("/district/upazila-requests", getUpazilaRequests);
router.get("/district/upazila-options", getDistrictUpazilas);
router.get("/district/upazila-requests/search", searchUpazilaRequests);
router.get("/district/store-inventory", getStoreInventory);

module.exports = router;
