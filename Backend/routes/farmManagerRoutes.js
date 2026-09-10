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
router.use(authenticate);

// server.js does app.use(farmManagerRoutes) with NO prefix, same as
// directorStoreRoutes.js — so every path must bake in '/farm-manager' itself.

router.get('/farm-manager/dashboard-stats', getDashboardStats);
router.get('/farm-manager/profile', getProfile);
router.put('/farm-manager/profile', updateProfile);
router.get('/farm-manager/resources', getFarmResources);
router.get('/farm-manager/demand-requests', getDemandRequests);
router.post('/farm-manager/demand-requests', createDemandRequest);
router.post('/farm-manager/consumption', recordConsumption);
router.get('/farm-manager/consumption-history', getConsumptionHistory);
router.get('/farm-manager/notifications', getNotifications);
module.exports = router;
