/**
 * @file session.js - Session management utility for Xstro client
 * @author AstroX11
 * @license MIT - Free to use and modify, see https://opensource.org/licenses/MIT
 * 
 * @async
 * @function getSession
 * @description Retrieves and manages session data by connecting to remote API and handling local SQLite databases
 * @throws {Error} If session data cannot be retrieved or database operations fail
 * @returns {Promise<void>} Resolves when session is connected or logs appropriate messages
 * 
 * The function performs the following operations:
 * 1. Checks for SESSION_ID in config
 * 2. Downloads session data from remote API
 * 3. Manages temporary and main SQLite databases
 * 4. Syncs session data between databases
 * 5. Performs cleanup operations
 * 
 * @requires path
 * @requires config
 * @requires fs
 * @requires xstro-utils
 * @requires sequelize
 */
import path from 'path';
import config from '#config';
import { promises as fs } from 'fs';
import { getJson, getBuffer } from 'xstro-utils';
import { Sequelize } from 'sequelize';

export async function getSession() {
	const { SESSION_ID } = config;
	if (!SESSION_ID) return console.log('No Session Data\nGenerating QR');

	const DATABASE_PATH = path.join(process.cwd(), 'database.db');
	const TEMP_PATH = path.join(process.cwd(), 'temp_database.db');
	let db = null;

	try {
		const { files } = await getJson(
			`https://xstro-api-40f56748ff31.herokuapp.com/session/${SESSION_ID}`,
		);
		await fs.writeFile(TEMP_PATH, await getBuffer(files[0].url));

		db = {
			main: new Sequelize({
				dialect: 'sqlite',
				storage: DATABASE_PATH,
				logging: false,
			}),
			temp: new Sequelize({
				dialect: 'sqlite',
				storage: TEMP_PATH,
				logging: false,
			}),
		};

		const getSessionId = db =>
			db
				.query('SELECT session_id FROM session LIMIT 1', {
					type: Sequelize.QueryTypes.SELECT,
				})
				.then(([result]) => result?.session_id);

		const [mainId, tempId] = await Promise.all([
			getSessionId(db.main),
			getSessionId(db.temp),
		]);

		if (mainId === tempId) return console.log('Session connected');

		const tempData = await db.temp.query('SELECT * FROM session', {
			type: Sequelize.QueryTypes.SELECT,
		});

		await db.main.transaction(async t => {
			await db.main.query('DELETE FROM session', { transaction: t });
			await db.main.query(
				'INSERT INTO session (session_id, data_key, data_value) VALUES ' +
					tempData.map(() => '(?, ?, ?)').join(','),
				{
					replacements: tempData.flatMap(row => [
						row.session_id,
						row.data_key,
						row.data_value,
					]),
					transaction: t,
				},
			);
		});

		console.log('Session connected');
	} catch {
		console.log('No Session Data');
	} finally {
		await Promise.all([
			db?.main?.close(),
			db?.temp?.close(),
			fs.unlink(TEMP_PATH).catch(() => {}),
		]);
	}
}
