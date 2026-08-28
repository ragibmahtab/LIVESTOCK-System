const express = require("express");

const router = express.Router();

const {
    getDashboardStats,
    getProfile,
    updateProfile,
    getInventory,
    getItems,
    createDemandRequest,
    getDemandRequests,
    recordItemUsage,
    getUsageHistory,
    getNotifications
} = require("../controllers/upazilaController");

// Dashboard Overview
router.get("/upazila/dashboard-stats", getDashboardStats);

// View / Edit Profile
router.get("/upazila/profile", getProfile);
router.put("/upazila/profile", updateProfile);

// Inventory Store Check
router.get("/upazila/inventory", getInventory);

// Shared item dropdown (Create Demand + Record Usage forms)
router.get("/upazila/items", getItems);

// Create Demand Request / Demand Application Status
router.post("/upazila/demand-requests", createDemandRequest);
router.get("/upazila/demand-requests", getDemandRequests);

// Record Item Usage & Distribution
router.post("/upazila/item-usage", recordItemUsage);
router.get("/upazila/item-usage", getUsageHistory);

// Notifications
router.get("/upazila/notifications", getNotifications);

module.exports = router;
