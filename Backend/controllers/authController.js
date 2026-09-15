const connectDB = require("../db");
const oracledb = require("oracledb");


async function login(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================

        const username = req.body.username;
        const password = req.body.password;


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Check username/password
        // =================================

        const result = await connection.execute(

            `SELECT USER_ID
             FROM USER_INFO
             WHERE USERNAME = :username
             AND PASSWORD = :password`,

            {
                username: username,
                password: password
            }
        );


        // =================================
        // Step 4: Invalid login
        // =================================

        if (result.rows.length === 0) {

            return res.json({
                success: false,
                message: "Invalid username or password"
            });
        }


        // =================================
        // Step 5: Get USER_ID
        // =================================

        const userId = result.rows[0].USER_ID;

        console.log("Logged in USER_ID:", userId);




        const roleResult = await connection.execute(

            `BEGIN
                get_user_role(:userId, :role);
             END;`,

            {
                userId: userId,

                role: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.STRING,
                    maxSize: 50
                }
            }
        );


        // =================================
        // Step 7: Get role from procedure
        // =================================

        const role = roleResult.outBinds.role;

        console.log("User role:", role);


        // =================================
        // Step 8: Check whether role exists
        // =================================

        if (!role) {

            return res.json({
                success: false,
                message: "User role could not be determined"
            });
        }


        // =================================
        // Step 9: Send result to frontend
        // =================================

        res.json({
            success: true,
            message: "Login successful",
            role: role,
            userId: userId
        });


    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });


    } finally {

        if (connection) {
            await connection.close();
        }
    }
}


async function register(req, res) {

    let connection;

    try {

        // =================================
        // Step 1: Get input from frontend
        // =================================
        // Expected req.body shape (sent by handleSignup in auth.js):
        // {
        //   fullName, email, username, password, role,
        //   phoneNumbers: ["01712345678", ...],
        //   roleDetails: { <name-attribute>: <value>, ... }  // only the
        //                  fields from whichever role block was visible
        // }

        const {
            fullName,
            email,
            username,
            password,
            role,
            phoneNumbers,
            roleDetails
        } = req.body;

        if (!fullName || !email || !username || !password || !role) {
            return res.json({
                success: false,
                message: "Missing required fields"
            });
        }

        if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
            return res.json({
                success: false,
                message: "At least one phone number is required"
            });
        }


        // =================================
        // Step 2: Connect to Oracle
        // =================================

        connection = await connectDB();


        // =================================
        // Step 3: Reject duplicate username/email
        // Check_User_Registration raises ORA-20002 (username taken)
        // or ORA-20003 (email taken) -- caught below.
        // =================================

        await connection.execute(
            `BEGIN
                Check_User_Registration(:username, :email);
             END;`,
            {
                username: username,
                email: email
            }
        );


        // =================================
        // Step 4: Tell the USER_INFO trigger which
        // per-role sequence to draw the new User_ID from
        // =================================

        await connection.execute(
            `BEGIN
                registration_ctx.set_role(:role);
             END;`,
            { role: role }
        );


        // =================================
        // Step 5: Insert into USER_INFO
        // Do NOT include User_ID -- trg_user_info_id fills it in from
        // whichever sequence matches the role set in Step 4.
        // =================================

        const userInsertResult = await connection.execute(
            `INSERT INTO USER_INFO (Username, Password, Name, Email)
             VALUES (:username, :password, :name, :email)
             RETURNING User_ID INTO :newUserId`,
            {
                username: username,
                password: password,
                name: fullName,
                email: email,
                newUserId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            }
        );

        const newUserId = userInsertResult.outBinds.newUserId[0];


        // =================================
        // Step 6: Insert into the role-specific table
        // =================================

        switch (role) {

            case "director-store":
                // Table: Director_Store
                // Columns: Dir_Store_ID (=newUserId), Gradation_No,
                //          Office_Unit, Appointment_Date, Store_Category
                // NOTE: HTML field name is "office_location" but the DDL
                // column is "Office_Unit" -- mapped explicitly below.
                await connection.execute(
                    `INSERT INTO Director_Store
                        (Dir_Store_ID, Gradation_No, Office_Unit, Appointment_Date, Store_Category)
                     VALUES
                        (:dirStoreId, :gradationNo, :officeUnit, TO_DATE(:appointmentDate, 'YYYY-MM-DD'), :storeCategory)`,
                    {
                        dirStoreId: newUserId,
                        gradationNo: roleDetails.gradation_number,
                        officeUnit: roleDetails.office_location,
                        appointmentDate: roleDetails.appointment_date,
                        storeCategory: roleDetails.store_category
                    }
                );
                break;

            case "director-budget":
                // Table: Director_Budget
                // Columns: Dir_Bud_ID (=newUserId), Gradation_No,
                //          Appointment_Date, Budget_Type
                await connection.execute(
                    `INSERT INTO Director_Budget
                        (Dir_Bud_ID, Gradation_No, Appointment_Date, Budget_Type)
                     VALUES
                        (:dirBudId, :gradationNo, TO_DATE(:appointmentDate, 'YYYY-MM-DD'), :budgetType)`,
                    {
                        dirBudId: newUserId,
                        gradationNo: roleDetails.gradation_number,
                        appointmentDate: roleDetails.appointment_date,
                        budgetType: roleDetails.budget_type
                    }
                );
                break;

            case "director-planning":
                // Table: Director_Planning
                // Columns: Director_Plan_ID (=newUserId), Gradation_No,
                //          Appointment_Date, Planning_Division
                await connection.execute(
                    `INSERT INTO Director_Planning
                        (Director_Plan_ID, Gradation_No, Appointment_Date, Planning_Division)
                     VALUES
                        (:dirPlanId, :gradationNo, TO_DATE(:appointmentDate, 'YYYY-MM-DD'), :planningDivision)`,
                    {
                        dirPlanId: newUserId,
                        gradationNo: roleDetails.gradation_number,
                        appointmentDate: roleDetails.appointment_date,
                        planningDivision: roleDetails.planning_division
                    }
                );
                break;

            case "director-production":
                // Table: Director_Production
                // Columns: Director_Production_ID (=newUserId), Gradation_No,
                //          Appointment_Date, Farm_Type
                await connection.execute(
                    `INSERT INTO Director_Production
                        (Director_Production_ID, Gradation_No, Appointment_Date, Farm_Type)
                     VALUES
                        (:dirProductionId, :gradationNo, TO_DATE(:appointmentDate, 'YYYY-MM-DD'), :farmType)`,
                    {
                        dirProductionId: newUserId,
                        gradationNo: roleDetails.gradation_number,
                        appointmentDate: roleDetails.appointment_date,
                        farmType: roleDetails.farm_type
                    }
                );
                break;

            case "project-director":
                // Table: Project_Director
                // Columns: Project_Director_ID (=newUserId), Gradation_No, Project_ID
                // (Assistant_Project_Director_ID stays NULL at registration time)
                await connection.execute(
                    `INSERT INTO Project_Director
                        (Project_Director_ID, Gradation_No, Project_ID)
                     VALUES
                        (:projectDirectorId, :gradationNo, :projectId)`,
                    {
                        projectDirectorId: newUserId,
                        gradationNo: roleDetails.gradation_number,
                        projectId: roleDetails.project_id
                    }
                );
                break;

            // "upazilla", "district", and "farm-manager" are not wired up
            // yet -- trg_user_info_id already rejects those roles before
            // execution ever reaches here, so this default only fires for
            // a genuinely unrecognized role value.
            default:
                throw new Error(`Unknown or not-yet-supported role: ${role}`);
        }


        // =================================
        // Step 7: Insert phone numbers
        // Runs once per number. USER_PHONE_PHONE_UK enforces that no
        // two users can share a phone number -- caught below as a
        // unique-constraint violation.
        // =================================

        for (const phone of phoneNumbers) {
            await connection.execute(
                `INSERT INTO User_Phone (User_ID, Phone) VALUES (:userId, :phone)`,
                {
                    userId: newUserId,
                    phone: phone
                }
            );
        }


        // =================================
        // Step 8: Commit the whole registration
        // =================================

        await connection.commit();

        res.json({
            success: true,
            message: "Registration successful",
            userId: newUserId
        });


    } catch (error) {

        console.error("Registration error:", error);

        if (connection) {
            await connection.rollback();
        }

        // ORA-20002 / ORA-20003 raised by Check_User_Registration
        if (error.errorNum === 20002) {
            return res.json({ success: false, message: "Username already taken" });
        }
        if (error.errorNum === 20003) {
            return res.json({ success: false, message: "Email already registered" });
        }

        // ORA-20020 raised by trg_user_info_id for a role that isn't
        // wired up yet (upazilla, district, farm-manager)
        if (error.errorNum === 20020) {
            return res.json({ success: false, message: "Registration for this role isn't available yet" });
        }

        // ORA-00001 = a unique constraint was violated. Check_User_Registration
        // already screens username/email before we get here, so in practice
        // this means the phone number is a duplicate -- but the constraint
        // name is parsed out to be sure rather than assuming.
        if (error.errorNum === 1) {
            const message = error.message || "";
            if (message.includes("USER_PHONE_PHONE_UK")) {
                return res.json({ success: false, message: "That phone number is already registered to another account" });
            }
            return res.json({ success: false, message: "That username, email, or phone number is already in use" });
        }

        res.status(500).json({
            success: false,
            message: "Server error"
        });


    } finally {

        if (connection) {
            await connection.close();
        }
    }
}


module.exports = {
    login,
    register
};
