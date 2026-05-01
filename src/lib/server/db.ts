import { env } from '$env/dynamic/private';
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
	connectionString: env.DATABASE_URL
});

export async function query<T extends pg.QueryResultRow>(
	text: string,
	params?: unknown[]
): Promise<pg.QueryResult<T>> {
	return pool.query<T>(text, params);
}
