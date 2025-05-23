#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL environment variable is not set.');
  console.error('Please set the DATABASE_URL in your .env file or environment variables.');
  console.error('Example: DATABASE_URL=postgres://username:password@localhost:5432/database_name');
  process.exit(1);
}

const dbName = databaseUrl.split('/').pop().split('?')[0];

const schemaFilePath = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(schemaFilePath)) {
  console.error('Error: schema.sql file not found. Please ensure it exists in the project root directory.');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`This will initialize the database schema for '${dbName}'.`);
console.log('Warning: This will drop and recreate the necessary tables. All existing data will be lost.');
rl.question('Do you want to continue? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    try {
      console.log('Executing schema...');
      execSync(`psql "${databaseUrl}" -f "${schemaFilePath}"`, { stdio: 'inherit' });
      console.log('Database schema has been successfully initialized!');
    } catch (error) {
      console.error('Error executing schema:', error.message);
      console.error('Please make sure PostgreSQL is installed and running, and the DATABASE_URL is correct.');
    }
  } else {
    console.log('Operation cancelled.');
  }
  rl.close();
});
