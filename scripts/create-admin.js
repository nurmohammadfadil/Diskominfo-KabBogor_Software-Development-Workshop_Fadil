const { Admin, initializeDatabase } = require("../lib/sequelize");

async function createAdmin() {
  try {
    // Initialize database connection
    await initializeDatabase();

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      where: {
        username: "admin"
      }
    });

    if (existingAdmin) {
      console.log("Admin user already exists!");
      console.log("Username: admin");
      console.log("Email:", existingAdmin.email);
      return;
    }

    // Create new admin user
    const admin = await Admin.create({
      username: "admin",
      email: "admin@diskominfo.bogor.go.id",
      password: "admin123" // This will be automatically hashed by the model hook
    });

    console.log("Admin user created successfully!");
    console.log("Username: admin");
    console.log("Email: admin@diskominfo.bogor.go.id");
    console.log("Password: admin123");
    console.log("ID:", admin.id);

  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    process.exit(0);
  }
}

createAdmin();
