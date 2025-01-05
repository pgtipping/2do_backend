"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if we need to add any new enum values in the future
      const enumCheck = await queryInterface.sequelize.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type 
          WHERE typname = 'enum_tasks_status'
        );
      `);

      const enumExists = enumCheck[0][0].exists;

      if (!enumExists) {
        // If enum doesn't exist (shouldn't happen with new setup), create it
        await queryInterface.sequelize.query(`
          CREATE TYPE enum_tasks_status AS ENUM ('PENDING', 'COMPLETED');
        `);
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Migration failed:", error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // No down migration needed as we want to keep these status values
    return Promise.resolve();
  },
};
