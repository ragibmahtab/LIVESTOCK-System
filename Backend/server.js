const express = require("express");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const upazilaRoutes = require("./routes/upazilaRoutes");
const districtRoutes = require("./routes/districtRoutes");
const directorStoreRoutes = require("./routes/directorStoreRoutes");
const farmManagerRoutes = require("./routes/farmManagerRoutes");
const directorProductionRoutes = require("./routes/directorProductionRoutes");
const directorBudgetRoutes = require("./routes/directorBudgetRoutes");



const app = express();

// Allow the static frontend to call this API during local development.
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// Allows Node.js to understand JSON sent from frontend
app.use(express.json());

// Serve the Frontend folder (index.html, district.html, etc.) as static
// files at the site root.
app.use(express.static(path.join(__dirname, "../Frontend")));

// The Frontend HTML files reference scripts as "../js/auth.js" etc,
// which on disk resolves to a sibling "js" folder outside Frontend.
// Browsers clamp ".." at the site root, so that request actually hits
// "/js/auth.js" -- mount the real js folder there so it resolves.
app.use("/js", express.static(path.join(__dirname, "../js")));

// Connect our login routes
app.use(authRoutes);
app.use(upazilaRoutes);
app.use(districtRoutes);
app.use(directorStoreRoutes);
app.use(farmManagerRoutes);
app.use(directorProductionRoutes);
app.use(directorBudgetRoutes);
// Start server
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});