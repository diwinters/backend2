#!/usr/bin/env node
/**
 * Admin CLI - Manage city admins via command line
 * 
 * Usage:
 *   npm run admin add-global <did> [role]       - Add a global admin
 *   npm run admin remove-global <did>           - Remove a global admin
 *   npm run admin add-city <did> <cityId> [role]- Add admin to a city
 *   npm run admin remove-city <did> <cityId>    - Remove admin from a city
 *   npm run admin list                          - List all admins
 *   npm run admin list-cities                   - List all cities
 *   npm run admin check <did>                   - Check admin status for a DID
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color: keyof typeof COLORS, message: string) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

function logTable(data: Record<string, any>[]) {
  if (data.length === 0) {
    log('dim', '  (no results)')
    return
  }
  console.table(data)
}

async function addGlobalAdmin(did: string, role: string = 'admin') {
  log('cyan', `\n🌍 Adding global admin: ${did}`)
  
  // Check if already exists
  const existing = await prisma.cityAdmin.findFirst({
    where: { did, cityId: null },
  })
  
  if (existing) {
    log('yellow', '⚠️  This DID is already a global admin')
    return
  }
  
  const admin = await prisma.cityAdmin.create({
    data: { did, cityId: null, role },
  })
  
  log('green', '✅ Global admin added successfully')
  console.log('   ID:', admin.id)
  console.log('   DID:', admin.did)
  console.log('   Role:', admin.role)
}

async function removeGlobalAdmin(did: string) {
  log('cyan', `\n🌍 Removing global admin: ${did}`)
  
  const existing = await prisma.cityAdmin.findFirst({
    where: { did, cityId: null },
  })
  
  if (!existing) {
    log('red', '❌ No global admin found with this DID')
    return
  }
  
  await prisma.cityAdmin.delete({ where: { id: existing.id } })
  log('green', '✅ Global admin removed successfully')
}

async function addCityAdmin(did: string, cityId: string, role: string = 'admin') {
  log('cyan', `\n🏙️  Adding city admin: ${did} to city ${cityId}`)
  
  // Verify city exists
  const city = await prisma.city.findUnique({ where: { id: cityId } })
  if (!city) {
    // Try by slug
    const cityBySlug = await prisma.city.findUnique({ where: { slug: cityId } })
    if (cityBySlug) {
      cityId = cityBySlug.id
    } else {
      log('red', '❌ City not found (tried by ID and slug)')
      return
    }
  }
  
  // Check if already exists
  const existing = await prisma.cityAdmin.findUnique({
    where: { did_cityId: { did, cityId } },
  })
  
  if (existing) {
    log('yellow', '⚠️  This DID is already an admin for this city')
    return
  }
  
  const admin = await prisma.cityAdmin.create({
    data: { did, cityId, role },
    include: { city: { select: { name: true } } },
  })
  
  log('green', '✅ City admin added successfully')
  console.log('   ID:', admin.id)
  console.log('   DID:', admin.did)
  console.log('   City:', admin.city?.name)
  console.log('   Role:', admin.role)
}

async function removeCityAdmin(did: string, cityId: string) {
  log('cyan', `\n🏙️  Removing city admin: ${did} from city ${cityId}`)
  
  // Try by slug first
  const cityBySlug = await prisma.city.findUnique({ where: { slug: cityId } })
  if (cityBySlug) {
    cityId = cityBySlug.id
  }
  
  const existing = await prisma.cityAdmin.findUnique({
    where: { did_cityId: { did, cityId } },
  })
  
  if (!existing) {
    log('red', '❌ No city admin found with this DID for this city')
    return
  }
  
  await prisma.cityAdmin.delete({ where: { id: existing.id } })
  log('green', '✅ City admin removed successfully')
}

async function listAdmins() {
  log('cyan', '\n📋 All Admins')
  log('bright', '\nGlobal Admins:')
  
  const globalAdmins = await prisma.cityAdmin.findMany({
    where: { cityId: null },
    orderBy: { createdAt: 'asc' },
  })
  
  logTable(globalAdmins.map(a => ({
    ID: a.id.slice(0, 8) + '...',
    DID: a.did,
    Role: a.role,
    Added: a.createdAt.toISOString().split('T')[0],
  })))
  
  log('bright', '\nCity Admins:')
  
  const cityAdmins = await prisma.cityAdmin.findMany({
    where: { cityId: { not: null } },
    include: { city: { select: { name: true, slug: true } } },
    orderBy: [{ city: { name: 'asc' } }, { createdAt: 'asc' }],
  })
  
  logTable(cityAdmins.map(a => ({
    ID: a.id.slice(0, 8) + '...',
    DID: a.did,
    City: a.city?.name,
    CitySlug: a.city?.slug,
    Role: a.role,
    Added: a.createdAt.toISOString().split('T')[0],
  })))
}

async function listCities() {
  log('cyan', '\n🏙️  All Cities')
  
  const cities = await prisma.city.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          sellers: { where: { isSeller: true } },
          listings: { where: { status: 'live' } },
          admins: true,
        },
      },
    },
  })
  
  logTable(cities.map(c => ({
    ID: c.id.slice(0, 8) + '...',
    Name: c.name,
    Slug: c.slug,
    Country: c.country || '-',
    Active: c.isActive ? '✅' : '❌',
    Sellers: c._count.sellers,
    Listings: c._count.listings,
    Admins: c._count.admins,
  })))
}

async function checkAdmin(did: string) {
  log('cyan', `\n🔍 Checking admin status for: ${did}`)
  
  const adminRecords = await prisma.cityAdmin.findMany({
    where: { did },
    include: { city: { select: { name: true, slug: true } } },
  })
  
  if (adminRecords.length === 0) {
    log('yellow', '⚠️  This DID is not an admin')
    return
  }
  
  log('green', `✅ Found ${adminRecords.length} admin role(s):`)
  
  for (const record of adminRecords) {
    if (record.cityId === null) {
      console.log(`   🌍 Global Admin (${record.role})`)
    } else {
      console.log(`   🏙️  ${record.city?.name} Admin (${record.role})`)
    }
  }
}

async function printUsage() {
  console.log(`
${COLORS.bright}Admin CLI - City Admin Management${COLORS.reset}

${COLORS.cyan}Usage:${COLORS.reset}
  npm run admin <command> [arguments]

${COLORS.cyan}Commands:${COLORS.reset}
  ${COLORS.green}add-global${COLORS.reset} <did> [role]          Add a global admin (access to all cities)
  ${COLORS.green}remove-global${COLORS.reset} <did>              Remove a global admin
  ${COLORS.green}add-city${COLORS.reset} <did> <cityId> [role]   Add admin to a specific city
  ${COLORS.green}remove-city${COLORS.reset} <did> <cityId>       Remove admin from a city
  ${COLORS.green}list${COLORS.reset}                             List all admins
  ${COLORS.green}list-cities${COLORS.reset}                      List all cities
  ${COLORS.green}check${COLORS.reset} <did>                      Check admin status for a DID

${COLORS.cyan}Roles:${COLORS.reset}
  admin      - Full access (default)
  moderator  - Can review content
  viewer     - Read-only access

${COLORS.cyan}Examples:${COLORS.reset}
  npm run admin add-global did:plc:abc123
  npm run admin add-city did:plc:abc123 dakhla
  npm run admin add-city did:plc:xyz789 casablanca moderator
  npm run admin check did:plc:abc123
  npm run admin list
`)
}

async function main() {
  const [,, command, ...args] = process.argv
  
  try {
    switch (command) {
      case 'add-global':
        if (!args[0]) {
          log('red', '❌ Missing DID argument')
          return
        }
        await addGlobalAdmin(args[0], args[1])
        break
        
      case 'remove-global':
        if (!args[0]) {
          log('red', '❌ Missing DID argument')
          return
        }
        await removeGlobalAdmin(args[0])
        break
        
      case 'add-city':
        if (!args[0] || !args[1]) {
          log('red', '❌ Missing DID and/or cityId arguments')
          return
        }
        await addCityAdmin(args[0], args[1], args[2])
        break
        
      case 'remove-city':
        if (!args[0] || !args[1]) {
          log('red', '❌ Missing DID and/or cityId arguments')
          return
        }
        await removeCityAdmin(args[0], args[1])
        break
        
      case 'list':
        await listAdmins()
        break
        
      case 'list-cities':
        await listCities()
        break
        
      case 'check':
        if (!args[0]) {
          log('red', '❌ Missing DID argument')
          return
        }
        await checkAdmin(args[0])
        break
        
      case 'help':
      case '--help':
      case '-h':
      default:
        await printUsage()
    }
  } catch (error) {
    log('red', `\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
