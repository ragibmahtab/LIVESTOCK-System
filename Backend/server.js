const express = require("express");

const authRoutes = require("./routes/authRoutes");
const upazilaRoutes = require("./routes/upazilaRoutes");
const districtRoutes = require("./routes/districtRoutes");
const directorStoreRoutes = require("./routes/directorStoreRoutes");
const farmManagerRoutes = require("./routes/farmManagerRoutes");


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

// Connect our login routes
app.use(authRoutes);
app.use(upazilaRoutes);
app.use(districtRoutes);
app.use(directorStoreRoutes);
app.use(farmManagerRoutes);
// Start server
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});