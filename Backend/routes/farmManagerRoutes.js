// ============================================================================
// farmManagerRoutes.js
// Mount this in your main app, e.g.:
//   const farmManagerRoutes = require('./routes/farmManagerRoutes');
//   app.use('/api/farm-manager', farmManagerRoutes);
//
// ASSUMPTION: you already have an auth middleware (checking session/JWT)
// somewhere in the project — plug it in below as `authenticate`. Left as a
// pass-through no-op here so the routes work standalone while you wire it up.
// ============================================================================

const express = require('express');
const router = express.Router();

const {
    getDashboardStats,
    getProfile,
    updateProfile,
    getFarmResources,
    getDemandRequests,
    createDemandRequest,
    recordConsumption,
    getConsumptionHistory,
    getNotifications
} = require('../controllers/farmManagerController'); // adjust path to match your project structure

// TODO: replace with your real auth middleware (e.g. verifyToken from auth.js)
function authenticate(req, res, next) {
    next();
}

router.use(authenticate);

// Dashboard Overview
router.get('/dashboard-stats', getDashboardStats);

// View Profile
router.get('/profile', getProfile);

// Edit Profile
router.put('/profile', updateProfile);

// Farm Resource Check (also feeds the resource dropdowns on other tabs)
router.get('/resources', getFarmResources);

// Create Demand Request + Check Demand Status (same list endpoint, filtered by query params)
router.get('/demand-requests', getDemandRequests);
router.post('/demand-requests', createDemandRequest);

// Record Consumption
router.post('/consumption', recordConsumption);
router.get('/consumption-history', getConsumptionHistory);

// Notifications (low stock)
router.get('/notifications', getNotifications);

module.exports = router;
