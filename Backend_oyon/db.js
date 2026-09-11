const oracledb = require('oracledb');
require('dotenv').config();

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Oracle database configuration
const dbConfig = {
    user: process.env.DB_USER || "system",
    password: process.env.DB_PASSWORD || "oyon4948",
    connectString: process.env.DB_CONNECT_STRING || "localhost:1521/XEPDB1"
};

// Database query execution helper
async function executeQuery(sql, binds = []) {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(sql, binds, { autoCommit: true });
        return result;
    } catch (err) {
        console.error("Database Query Error:", err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Connection Close Error:", err);
            }
        }
    }
}

module.exports = { executeQuery };