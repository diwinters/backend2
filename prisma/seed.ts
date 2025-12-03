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
      role: 'super_admin',
    },
  });
  console.log(`✅ Created admin: ${admin.email}`);

  // Create sample apps
  const feedApp = await prisma.app.upsert({
    where: { slug: 'following' },
    update: {},
    create: {
      name: 'Following',
      slug: 'following',
      type: 'feed',
      icon: '👥',
      description: 'Posts from people you follow',
      config: {
        feed: 'following',
        feedType: 'timeline',
        displayMode: 'timeline', // Normal vertical scrolling feed
      },
      order: 0,
      isActive: true,
    },
  });
  console.log(`✅ Created app: ${feedApp.name}`);

  const discoverApp = await prisma.app.upsert({
    where: { slug: 'discover' },
    update: {},
    create: {
      name: 'Discover',
      slug: 'discover',
      type: 'feed',
      icon: '🔍',
      description: 'Discover new content',
      config: {
        feed: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
        feedType: 'feed',
        displayMode: 'timeline',
      },
      order: 1,
      isActive: true,
    },
  });
  console.log(`✅ Created app: ${discoverApp.name}`);

  // Video feed with grid display (like current VideoFeed tab)
  const videoGridApp = await prisma.app.upsert({
    where: { slug: 'videos' },
    update: {},
    create: {
      name: 'Videos',
      slug: 'videos',
      type: 'feed',
      icon: '📹',
      description: 'Video content in grid view',
      config: {
        feed: 'at://did:plc:example/app.bsky.feed.generator/videos',
        feedType: 'feed',
        displayMode: 'grid', // Grid of video thumbnails
      },
      order: 2,
      isActive: true,
    },
  });
  console.log(`✅ Created app: ${videoGridApp.name}`);

  // Immersive video feed (TikTok-style)
  const immersiveApp = await prisma.app.upsert({
    where: { slug: 'clips' },
    update: {},
    create: {
      name: 'Clips',
      slug: 'clips',
      type: 'feed',
      icon: '🎬',
      description: 'Short-form video clips',
      config: {
        feed: 'at://did:plc:example/app.bsky.feed.generator/clips',
        feedType: 'feed',
        displayMode: 'immersive', // Opens directly in TikTok-style view
        immersiveStartPosition: 'top', // Start from top/first post
        autoPlay: true,
      },
      order: 3,
      isActive: true,
    },
  });
  console.log(`✅ Created app: ${immersiveApp.name}`);

  const marketplaceApp = await prisma.app.upsert({
    where: { slug: 'marketplace' },
    update: {},
    create: {
      name: 'Marketplace',
      slug: 'marketplace',
      type: 'module',
      icon: '🛒',
      description: 'Buy and sell items',
      config: {
        layouts: [
          {
            id: 'featured',
            type: 'carousel',
            title: 'Featured',
            dataSource: 'featured',
          },
          {
            id: 'categories',
            type: 'grid',
            title: 'Categories',
            columns: 4,
            items: [
              { id: 'electronics', icon: '📱', label: 'Electronics' },
              { id: 'fashion', icon: '👕', label: 'Fashion' },
              { id: 'home', icon: '🏠', label: 'Home' },
              { id: 'sports', icon: '⚽', label: 'Sports' },
            ],
          },
          {
            id: 'listings',
            type: 'list',
            title: 'Recent Listings',
            dataSource: 'listings',
            fields: [
              { key: 'image', type: 'image', source: 'images[0]' },
              { key: 'title', type: 'text' },
              { key: 'price', type: 'currency' },
              { key: 'seller', type: 'user', source: 'seller.handle' },
            ],
            actions: [
              { id: 'view', type: 'navigation', config: { screen: 'ListingDetail' } },
              { id: 'message', type: 'dm', config: { recipient: 'seller.did' } },
            ],
          },
        ],
        dataEndpoints: {
          listings: {
            method: 'GET',
            url: '/api/listings/app/{appId}',
          },
          featured: {
            method: 'GET',
            url: '/api/listings/app/{appId}?featured=true',
          },
        },
        theme: {
          primaryColor: '#3b82f6',
        },
      },
      order: 10, // After feed apps
      isActive: true,
    },
  });
  console.log(`✅ Created app: ${marketplaceApp.name}`);

  const experiencesApp = await prisma.app.upsert({
    where: { slug: 'experiences' },
    update: {},
    create: {
      name: 'Experiences',
      slug: 'experiences',
      type: 'module',
      icon: '🎯',
      description: 'Book unique experiences',
      config: {
        layouts: [
          {
            id: 'search',
            type: 'form',
            fields: [
              { key: 'location', type: 'location', placeholder: 'Where?' },
              { key: 'date', type: 'date', placeholder: 'When?' },
              { key: 'guests', type: 'number', placeholder: 'Guests' },
            ],
            submitAction: { type: 'api', config: { endpoint: 'search' } },
          },
          {
            id: 'experiences',
            type: 'list',
            dataSource: 'experiences',
            fields: [
              { key: 'image', type: 'image', source: 'images[0]' },
              { key: 'title', type: 'text' },
              { key: 'price', type: 'currency', suffix: '/person' },
              { key: 'rating', type: 'rating' },
              { key: 'location', type: 'text', source: 'location.city' },
            ],
          },
        ],
        dataEndpoints: {
          experiences: {
            method: 'GET',
            url: '/api/listings/app/{appId}?type=experience',
          },
          search: {
            method: 'GET',
            url: '/api/listings/app/{appId}/search',
          },
        },
      },
      order: 3,
      isActive: true,
    },
  });
  console.log(`✅ Created app: ${experiencesApp.name}`);

  const homeApp = await prisma.app.upsert({
    where: { slug: 'home' },
    update: {},
    create: {
      name: 'Home',
      slug: 'home',
      type: 'home',
      icon: '🏠',
      description: 'Your personalized home feed',
      config: {
        widgets: [
          {
            id: 'notifications',
            type: 'notifications',
            config: { limit: 3 },
          },
          {
            id: 'quick-actions',
            type: 'quick_actions',
          },
          {
            id: 'recent-orders',
            type: 'recent_orders',
            config: { limit: 3 },
          },
          {
            id: 'marketplace-preview',
            type: 'feed_preview',
            appId: marketplaceApp.id,
            config: { limit: 4 },
          },
        ],
        quickActions: [
          {
            id: 'browse',
            icon: '🛒',
            label: 'Shop',
            action: { type: 'navigate_app', config: { slug: 'marketplace' } },
          },
          {
            id: 'experiences',
            icon: '🎯',
            label: 'Experiences',
            action: { type: 'navigate_app', config: { slug: 'experiences' } },
          },
          {
            id: 'orders',
            icon: '📦',
            label: 'My Orders',
            action: { type: 'navigate_screen', config: { screen: 'Orders' } },
          },
          {
            id: 'wallet',
            icon: '💰',
            label: 'Wallet',
            action: { type: 'navigate_screen', config: { screen: 'Wallet' } },
          },
        ],
      },
      order: -1, // Home app should be first
      isActive: false, // Enable when ready
    },
  });
  console.log(`✅ Created app: ${homeApp.name}`);

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
