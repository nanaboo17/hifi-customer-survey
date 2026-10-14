#!/usr/bin/env node
// Generate secure, unique survey URLs from a CSV of customers.
//
// Input CSV must have a header row containing a customer id column and a phone
// number column. Recognised names (case/space/underscore insensitive):
//   customer id : customer_id, customerid, customer, id, cust_id
//   phone       : phone_number, phone, phonenumber, msisdn, no_hp, no_telepon, whatsapp
//
// Outputs (written to --out, default ./scripts/out):
//   urls.csv         customer_id,phone_number,survey_url   <- send these via KATA WhatsApp
//   invitations.sql  INSERT statements (SHA-256 hash only) <- run in Supabase SQL Editor
//
// The raw token is never written to SQL, matching the server-side validation model.
//
// Usage:
//   node scripts/generate-links.mjs customers.csv \
//     --base-url https://survei.hifi.id --expires-days 14 --out scripts/out
//
// Env fallbacks: SURVEY_BASE_URL, SURVEY_EXPIRES_DAYS.

import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const CUSTOMER_KEYS = ['customer_id', 'customerid', 'customer', 'id', 'cust_id']
const PHONE_KEYS = ['phone_number', 'phone', 'phonenumber', 'msisdn', 'no_hp', 'no_telepon', 'telepon', 'whatsapp', 'wa']

function parseArgs(argv) {
  const args = { _: [], out: 'scripts/out', baseUrl: process.env.SURVEY_BASE_URL || 'http://localhost:3000', expiresDays: Number(process.env.SURVEY_EXPIRES_DAYS || 14) }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') args.out = argv[++i]
    else if (a === '--base-url') args.baseUrl = argv[++i]
    else if (a === '--expires-days') args.expiresDays = Number(argv[++i])
    else if (a === '--help' || a === '-h') args.help = true
    else args._.push(a)
  }
  return args
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

const normalizeHeader = (h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_')
const normalizePhone = (p) => p.trim().replace(/[^\d+]/g, '')
const sqlString = (v) => `'${String(v).replace(/'/g, "''")}'`

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args._.length === 0) {
    console.log(`Usage: node scripts/generate-links.mjs <customers.csv> [--base-url URL] [--expires-days N] [--out DIR]

Input CSV columns: customer_id, phone_number
Outputs: urls.csv (send via KATA) and invitations.sql (run in Supabase).`)
    process.exit(args.help ? 0 : 1)
  }

  const inputPath = resolve(args._[0])
  if (!existsSync(inputPath)) {
    console.error(`Input CSV not found: ${inputPath}`)
    process.exit(1)
  }
  if (!Number.isFinite(args.expiresDays) || args.expiresDays <= 0) {
    console.error('--expires-days must be a positive number.')
    process.exit(1)
  }

  const baseUrl = args.baseUrl.replace(/\/+$/, '')
  const rows = parseCsv(readFileSync(inputPath, 'utf8'))
  if (rows.length < 2) {
    console.error('CSV must contain a header row and at least one customer row.')
    process.exit(1)
  }

  const header = rows[0].map(normalizeHeader)
  const customerIdx = header.findIndex((h) => CUSTOMER_KEYS.includes(h))
  const phoneIdx = header.findIndex((h) => PHONE_KEYS.includes(h))
  if (customerIdx === -1 || phoneIdx === -1) {
    console.error(`Could not find required columns. Found: ${header.join(', ') || '(none)'}`)
    console.error(`Expected a customer id column (${CUSTOMER_KEYS.slice(0, 3).join(', ')}...) and a phone column (${PHONE_KEYS.slice(0, 3).join(', ')}...).`)
    process.exit(1)
  }

  const records = []
  const seen = new Set()
  for (let i = 1; i < rows.length; i++) {
    const customerId = (rows[i][customerIdx] || '').trim()
    const phone = normalizePhone(rows[i][phoneIdx] || '')
    if (!customerId && !phone) continue
    if (!customerId) { console.warn(`Row ${i + 1}: missing customer_id, skipped.`); continue }
    if (!phone) { console.warn(`Row ${i + 1}: missing phone_number, skipped.`); continue }
    if (seen.has(customerId)) { console.warn(`Row ${i + 1}: duplicate customer_id "${customerId}", skipped.`); continue }
    seen.add(customerId)

    const token = randomBytes(32).toString('base64url')
    records.push({ customerId, phone, token, hash: createHash('sha256').update(token).digest('hex') })
  }

  if (records.length === 0) {
    console.error('No valid customer rows found.')
    process.exit(1)
  }

  const outDir = resolve(args.out)
  if (!existsSync(dirname(outDir))) mkdirSync(dirname(outDir), { recursive: true })
  mkdirSync(outDir, { recursive: true })

  const csvEscape = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const urlsCsv = ['customer_id,phone_number,survey_url']
    .concat(records.map((r) => [csvEscape(r.customerId), csvEscape(r.phone), csvEscape(`${baseUrl}/s/${r.token}`)].join(',')))
    .join('\n')

  const sql = ['-- Generated by scripts/generate-links.mjs',
    `-- Base URL: ${baseUrl} | validity: ${args.expiresDays} days | rows: ${records.length}`,
    '-- Only token hashes are stored; raw tokens live in urls.csv and are sent to customers.',
    'insert into public.survey_invitations (customer_id, phone_number, token_hash, expires_at) values',
    records.map((r) => ` (${sqlString(r.customerId)}, ${sqlString(r.phone)}, ${sqlString(r.hash)}, now() + interval '${args.expiresDays} days')`).join(',\n') + ';',
    ''].join('\n')

  writeFileSync(join(outDir, 'urls.csv'), urlsCsv + '\n', 'utf8')
  writeFileSync(join(outDir, 'invitations.sql'), sql, 'utf8')

  console.log(`Generated ${records.length} invitation(s).`)
  console.log(`  URLs for KATA WhatsApp : ${join(outDir, 'urls.csv')}`)
  console.log(`  SQL for Supabase       : ${join(outDir, 'invitations.sql')}`)
  console.log('Treat urls.csv as sensitive: send each unique URL, then delete the file.')
}

main()
