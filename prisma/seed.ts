import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create super admin
  const passwordHash = await bcrypt.hash('admin123', 12);
  
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@miniapps.local' },
    update: {},
    create: {
      email: 'admin@miniapps.local',
      passwordHash,
      name: 'Super Admin',
    },
  });
  console.log(`✅ Created admin: ${admin.email}`);

  // Create sample apps using create (not upsert since no unique slug)
  // First, delete existing apps to avoid duplicates
  await prisma.app.deleteMany({});
  
  const feedApp = await prisma.app.create({
    data: {
      name: 'Following',
      type: 'feed',
      icon: '👥',
      description: 'Posts from people you follow',
      config: {
        feed: 'following',
        feedType: 'timeline',
        displayMode: 'timeline',
      },
      order: 0,
      enabled: true,
    },
  });
  console.log(`✅ Created app: ${feedApp.name}`);

  const discoverApp = await prisma.app.create({
    data: {
      name: 'Discover',
      type: 'feed',
      icon: '🔍',
      description: 'Discover new content',
      config: {
        feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
        feedType: 'feed',
        displayMode: 'timeline',
      },
      order: 1,
      enabled: true,
    },
  });
  console.log(`✅ Created app: ${discoverApp.name}`);

  const videoGridApp = await prisma.app.create({
    data: {
      name: 'Videos',
      type: 'feed',
      icon: '📹',
      description: 'Video content in grid view',
      config: {
        feed: 'at://did:plc:example/app.bsky.feed.generator/videos',
        feedType: 'feed',
        displayMode: 'grid',
      },
      order: 2,
      enabled: true,
    },
  });
  console.log(`✅ Created app: ${videoGridApp.name}`);

  const marketplaceApp = await prisma.app.create({
    data: {
      name: 'Marketplace',
      type: 'module',
      icon: '🛒',
      description: 'Buy and sell items',
      config: {
        moduleType: 'marketplace',
        categories: ['Electronics', 'Fashion', 'Home', 'Sports'],
        layouts: [
          {
            id: 'listings',
            type: 'list',
            title: 'Recent Listings',
            dataSource: 'listings',
          },
        ],
      },
      order: 10,
      enabled: true,
    },
  });
  console.log(`✅ Created app: ${marketplaceApp.name}`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📧 Admin credentials:');
  console.log('   Email: admin@miniapps.local');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
