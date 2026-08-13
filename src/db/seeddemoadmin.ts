import { db } from './connection';
import { hashPassword } from '../modules/auth/auth.service';

/**
 * One-off convenience script for local/dev testing. Creates a demo admin
 * user if it doesn't already exist. Run with: npm run seed:demo-admin
 *
 * Avoids all the shell-quoting problems of inserting a bcrypt hash (which
 * contains `$` characters) via `docker exec ... mysql -e "..."` - Node
 * handles the hash and knex parameterizes the query, so nothing touches a
 * shell in between.
 */
async function main() {
  const username = 'demo_admin';
  const password = 'MyPass123!';

  const existing = await db('users').where({ username }).first();
  if (existing) {
    console.log(`User "${username}" already exists (id=${existing.id}). Nothing to do.`);
    await db.destroy();
    return;
  }

  const passwordHash = await hashPassword(password);
  const [id] = await db('users').insert({
    username,
    password_hash: passwordHash,
    role: 'admin',
    is_active: true,
  });

  console.log(`Created user "${username}" (id=${id}) with password: ${password}`);
  console.log('Role is "admin", so logging in will return { mfaSetupRequired: true, setupToken }.');
  await db.destroy();
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
