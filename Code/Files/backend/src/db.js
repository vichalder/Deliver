const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000 // 60 seconds
});

async function connect(retries = 5) {
  try {
    console.log('Attempting to connect to MariaDB database...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    
    const connection = await pool.getConnection();
    console.log('Successfully connected to MariaDB database');
    connection.release();
  } catch (err) {
    console.error('Error connecting to MariaDB database:', err);
    if (err.code === 'ETIMEDOUT') {
      console.error('Connection timed out. Please check if the database server is running and accessible.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied. Please check your database username and password.');
    } else if (err.code === 'ENOTFOUND') {
      console.error('Host not found. Please check your database host address.');
    }
    
    if (retries > 0) {
      console.log(`Retrying connection in 5 seconds... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connect(retries - 1);
    }
    
    throw err;
  }
}

module.exports = {
  connect,
  pool
};
