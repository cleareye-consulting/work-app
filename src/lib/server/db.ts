import pg from "pg";

import {
	DB_HOST,
	DB_USER,
	DB_PASSWORD,
	DB_NAME
} from '$env/static/private';

export function getDB(): pg.Pool {
 return new pg.Pool({
		host: DB_HOST,
		user: DB_USER,
		password: DB_PASSWORD,
		database: DB_NAME,
		max: 10,
		idleTimeoutMillis: 30000,
	});
}