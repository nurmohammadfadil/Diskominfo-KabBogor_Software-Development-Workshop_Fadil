const { Sequelize, DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

// Load our custom pg wrapper
const pgWrapper = require("./pg-wrapper");
const vercelDb = require("./vercel-db");

// Create Sequelize instance with proper SSL configuration for Render
let sequelize;

try {
  // Check if we're running in Vercel production environment
  const isVercelProduction =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  if (isVercelProduction) {
    console.log(
      "🚀 Running in Vercel production environment, using optimized configuration"
    );
    sequelize = vercelDb.createVercelSequelize(process.env.DATABASE_URL);
  } else {
    console.log("🏠 Running in local/development environment");

    // Check if DATABASE_URL contains 'render.com' to determine if it's Render
    const isRenderDatabase =
      process.env.DATABASE_URL &&
      process.env.DATABASE_URL.includes("render.com");

    // Ensure pg package is available
    if (!pgWrapper.isAvailable()) {
      throw new Error(
        "PostgreSQL driver (pg) is required but not available. Please ensure pg package is installed."
      );
    }

    console.log("✅ pg package is available and ready to use");

    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions: isRenderDatabase
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : {},
      logging: process.env.NODE_ENV === "development" ? console.log : false,
      underscored: true, // Force snake_case for all columns globally
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      // Additional options for better connection handling
      retry: {
        max: 3,
        timeout: 10000,
      },
    });
  }
} catch (error) {
  console.error("Failed to create Sequelize instance:", error);
  throw error;
}

// Define Submission model
const Submission = sequelize.define(
  "Submission",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tracking_code: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    nama: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nik: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    no_wa: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    jenis_layanan: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENGAJUAN_BARU", "DIPROSES", "SELESAI", "DITOLAK"),
      defaultValue: "PENGAJUAN_BARU",
      allowNull: false,
    },
  },
  {
    tableName: "submissions",
    timestamps: true, // Enable automatic timestamp columns
    createdAt: "created_at", // Map to database column name
    updatedAt: "updated_at", // Map to database column name
  }
);

// Define NotificationLog model
const NotificationLog = sequelize.define(
  "NotificationLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    submission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "submissions",
        key: "id",
      },
    },
    channel: {
      type: DataTypes.ENUM("WHATSAPP", "EMAIL"),
      allowNull: false,
    },
    send_status: {
      type: DataTypes.ENUM("SUCCESS", "FAILED"),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    tableName: "notification_logs",
    timestamps: true, // Re-enabled for automatic timestamp columns
    createdAt: "created_at", // Map to database column name
    updatedAt: false, // Only track creation time
  }
);

// Define Admin model
const Admin = sequelize.define(
  "Admin",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [6, 255],
        notEmpty: true,
      },
    },
  },
  {
    tableName: "admins",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeCreate: async (admin) => {
        if (admin.password) {
          const saltRounds = 12;
          admin.password = await bcrypt.hash(admin.password, saltRounds);
        }
      },
      beforeUpdate: async (admin) => {
        if (admin.changed("password")) {
          const saltRounds = 12;
          admin.password = await bcrypt.hash(admin.password, saltRounds);
        }
      },
    },
  }
);

// Define relationships
Submission.hasMany(NotificationLog, { foreignKey: "submission_id" });
NotificationLog.belongsTo(Submission, { foreignKey: "submission_id" });

// Initialize database with retry logic
const initializeDatabase = async (retries = 3) => {
  try {
    console.log("Attempting to connect to database...");
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Only sync in development, not in production
    if (process.env.NODE_ENV === "development" || process.env.VERCEL !== "1") {
      console.log(
        "Development environment detected, synchronizing database models..."
      );
      await sequelize.sync({ alter: true });
      console.log("Database models synchronized.");
    } else {
      console.log(
        "Production environment detected, skipping database sync to prevent schema conflicts."
      );
      console.log(
        "Database tables should already exist and be properly configured."
      );
    }
  } catch (error) {
    console.error("Unable to connect to the database:", error);

    if (retries > 0) {
      console.log(`Retrying connection... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      return initializeDatabase(retries - 1);
    }

    console.error("Max retries reached. Exiting...");
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  Submission,
  NotificationLog,
  Admin,
  initializeDatabase,
};
