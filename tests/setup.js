const dotenv = require("dotenv");
const { Sequelize } = require("sequelize");

// Load environment variables
dotenv.config();

// Mock environment variables for testing
process.env.NODE_ENV = "test";

// Create test database connection
const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB + "_test",
  logging: false,
});

// Clean up function to run after tests
afterAll(async () => {
  await sequelize.close();
});

// Export for use in tests
module.exports = {
  sequelize,
};
