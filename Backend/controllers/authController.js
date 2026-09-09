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
        // TODO (Nazifah): write this INSERT yourself.
        //
        // - Table: USER_INFO
        // - Insert columns: Username, Password, Name, Email
        //   (do NOT include User_ID -- trg_user_info_id fills it in
        //   from whichever sequence matches the role set in Step 4)
        // - Must end with: RETURNING User_ID INTO :newUserId
        //   so the generated id is available below
        // =================================

        const userInsertResult = await connection.execute(
            ``, // <-- write the USER_INFO insert here
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
        // TODO (Nazifah): write the INSERT for each branch below.
        // newUserId is the value to put in that table's PK/FK column.
        // =================================

        switch (role) {

            case "upazilla":
                // Table: Upazila_Office
                // Columns: Off_ID (=newUserId), Upz_Name, Upz_ID, Dist_ID
                // roleDetails keys: upazila_name, upazila_id, district_id_ref
                await connection.execute(
                    ``, // <-- write it
                    {
                        offId: newUserId,
                        upzName: roleDetails.upazila_name,
                        upzId: roleDetails.upazila_id,
                        distId: roleDetails.district_id_ref
                    }
                );
                break;

            case "district":
                // Table: District_Office
                // Columns: Dist_Off_ID (=newUserId), Dist_Name, Dist_ID
                // roleDetails keys: district_name, district_id
                await connection.execute(
                    ``, // <-- write it
                    {
                        distOffId: newUserId,
                        distName: roleDetails.district_name,
                        distId: roleDetails.district_id
                    }
                );
                break;

            case "director-store":
                // Table: Director_Store
                // Columns: Dir_Store_ID (=newUserId), Gradation_No,
                //          Office_Unit, Appointment_Date, Store_Category
                // roleDetails keys: gradation_number, appointment_date,
                //                   store_category, office_location
                // NOTE: HTML field name is "office_location" but the DDL
                // column is "Office_Unit" -- map it explicitly like this,
                // don't assume they line up.
                await connection.execute(
                    ``, // <-- write it
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
                    ``, // <-- write it
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
                    ``, // <-- write it
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
                    ``, // <-- write it
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
                    ``, // <-- write it
                    {
                        projectDirectorId: newUserId,
                        gradationNo: roleDetails.gradation_number,
                        projectId: roleDetails.project_id
                    }
                );
                break;

            case "farm-manager":
                // Table: Farm_Manager
                // Columns: Manager_ID (=newUserId), Candidate_Type, Experience, Assigned_Farm
                await connection.execute(
                    ``, // <-- write it
                    {
                        managerId: newUserId,
                        candidateType: roleDetails.cadre_type,
                        experience: roleDetails.experience,
                        assignedFarm: roleDetails.farm_id
                    }
                );
                break;

            default:
                throw new Error(`Unknown role: ${role}`);
        }


        // =================================
        // Step 7: Insert phone numbers
        // TODO (Nazifah): write this INSERT. Runs once per number.
        // Table: User_Phone, Columns: User_ID (=newUserId), Phone
        // =================================

        for (const phone of phoneNumbers) {
            await connection.execute(
                ``, // <-- write it
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
