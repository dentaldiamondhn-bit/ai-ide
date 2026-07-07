import { Surreal, Table } from 'surrealdb'

let db: Surreal | null = null

export async function getDb(): Promise<Surreal> {
  if (db) return db
  db = new Surreal()
  await db.connect(process.env.SURREALDB_ENDPOINT!, {
    namespace: process.env.SURREALDB_NS || 'main',
    database: process.env.SURREALDB_DB || 'main',
    authentication: process.env.SURREALDB_TOKEN!,
  })
  return db
}

export async function closeDb(): Promise<void> {
  if (db) { await db.close(); db = null }
}
