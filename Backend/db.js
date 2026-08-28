const oracledb = require("oracledb");
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function connectDB() {

    try {
        oracledb.initOracleClient({
            libDir: 'C:\\Users\\Nazifah\\Downloads\\instantclient-basic-windows.x64-23.26.3.0.0\\instantclient_23_26'
        });
        const connection = await oracledb.getConnection({

            user: "system",
            password: "oracle123",
            connectString: "localhost:1521/xe"

        });

        console.log("Oracle database connected!");

        return connection;

    } catch (error) {

        console.error("Database connection failed:");
        console.error(error);

    }

}

module.exports = connectDB;