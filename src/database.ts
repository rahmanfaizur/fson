import { Pool } from 'pg';

let pool: Pool;

function getPool() {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not set in the environment variables.');
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }
    return pool;
}

async function initializeDatabase() {
    const pool = getPool();
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                "userId" TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                "timestamp" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `);
        client.release();
        console.log('PostgreSQL Database initialized.');
    } catch (error) {
        console.error("Error initializing database:", error);
        throw error;
    }
}

async function addMessage(userId: string, role: 'user' | 'model', content: string) {
    const pool = getPool();
    console.log(`Attempting to add message for userId: ${userId}`);
    try {
        await pool.query(
            'INSERT INTO messages ("userId", role, content) VALUES ($1, $2, $3)',
            [userId, role, content]
        );
        console.log(`Successfully added message for userId: ${userId}`);
    } catch (error) {
        console.error("Error adding message:", error);
    }
}

async function getHistory(userId: string, limit: number = 20) {
    const pool = getPool();
    try {
        const result = await pool.query(
            'SELECT role, content FROM messages WHERE "userId" = $1 ORDER BY "timestamp" DESC LIMIT $2',
            [userId, limit]
        );
        
        // The Gemini API expects messages in chronological order
        return result.rows.reverse().map(row => ({ role: row.role, parts: [{ text: row.content }] }));
    } catch (error) {
        console.error("Error getting history:", error);
        return [];
    }
}

export { initializeDatabase, addMessage, getHistory };
