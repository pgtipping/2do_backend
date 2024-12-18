const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

// Create connection URL
const dbUrl =
  process.env.DATABASE_URL ||
  `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${
    process.env.POSTGRES_HOST || "localhost"
  }:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB}`;

const sequelize = new Sequelize(dbUrl, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
  },
  dialectOptions: {
    ssl:
      process.env.NODE_ENV === "production"
        ? {
            require: true,
            rejectUnauthorized: false,
          }
        : false,
  },
});

// Test the connection and sync database
async function initializeDatabase() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log("Connected to PostgreSQL database successfully.");
    console.log("Connection URL:", dbUrl.replace(/:[^:]*@/, ":****@")); // Hide password in logs

    // Drop and recreate tables in development
    if (process.env.NODE_ENV === "development") {
      await sequelize.sync({ force: true });
      console.log("Database tables dropped and recreated.");
    } else {
      // In production, just sync new changes
      await sequelize.sync({ alter: true });
      console.log("Database tables synchronized.");
    }
  } catch (error) {
    console.error("Database initialization error:");
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);
    console.error("Connection details:", {
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST || "localhost",
      port: process.env.POSTGRES_PORT || 5432,
    });
    throw error;
  }
}

// Only initialize if not in test environment
if (process.env.NODE_ENV !== "test") {
  initializeDatabase();
}

module.exports = sequelize;
