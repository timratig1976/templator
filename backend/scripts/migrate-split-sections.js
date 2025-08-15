const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateSplitSections() {
  console.log('🚀 Starting Split Sections Migration...');
  
  try {
    // Step 1: Get all current split assets
    const allAssets = await prisma.splitAsset.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${allAssets.length} total assets`);
    
    // Group by splitId
    const assetsBySplit = {};
    allAssets.forEach(asset => {
      if (!assetsBySplit[asset.splitId]) {
        assetsBySplit[asset.splitId] = { json: [], imageCrop: [] };
      }
      if (asset.kind === 'json') {
        assetsBySplit[asset.splitId].json.push(asset);
      } else if (asset.kind === 'image-crop') {
        assetsBySplit[asset.splitId].imageCrop.push(asset);
      }
    });
    
    console.log(`Processing ${Object.keys(assetsBySplit).length} splits`);
    
    // Step 2: For each split, create sections from JSON assets
    for (const [splitId, assets] of Object.entries(assetsBySplit)) {
      console.log(`\nProcessing split ${splitId}:`);
      console.log(`  - ${assets.json.length} JSON assets`);
      console.log(`  - ${assets.imageCrop.length} image-crop assets`);
      
      // Create sections from JSON assets
      const createdSections = [];
      for (const jsonAsset of assets.json) {
        const sectionData = {
          id: jsonAsset.id, // Reuse the same ID
          splitId: splitId,
          order: jsonAsset.order || 0,
          sectionType: jsonAsset.meta?.sectionType || 'unknown',
          sectionName: jsonAsset.meta?.sectionName || `Section ${jsonAsset.order || 0}`,
          bounds: jsonAsset.meta?.bounds || null,
          metadata: jsonAsset.meta || {},
          createdAt: jsonAsset.createdAt
        };
        
        // Create the section (this will be our new SplitSection)
        console.log(`    Creating section: ${sectionData.sectionName} (order: ${sectionData.order})`);
        createdSections.push(sectionData);
      }
      
      // Step 3: Update image-crop assets to link to sections
      for (const cropAsset of assets.imageCrop) {
        // Find matching section by order
        const matchingSection = createdSections.find(s => s.order === cropAsset.order);
        if (matchingSection) {
          console.log(`    Linking crop asset ${cropAsset.id} to section ${matchingSection.id}`);
          // We'll update this in the actual database changes
        } else {
          console.warn(`    Warning: No matching section found for crop asset ${cropAsset.id} (order: ${cropAsset.order})`);
        }
      }
    }
    
    console.log('\n✅ Migration analysis complete!');
    console.log('\nSummary:');
    
    let totalSections = 0;
    let totalCrops = 0;
    
    for (const [splitId, assets] of Object.entries(assetsBySplit)) {
      totalSections += assets.json.length;
      totalCrops += assets.imageCrop.length;
      console.log(`  Split ${splitId}: ${assets.json.length} sections → ${assets.imageCrop.length} crops`);
    }
    
    console.log(`\nTotal: ${totalSections} sections, ${totalCrops} image crops`);
    console.log('\n🎯 Ready to apply database changes!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  migrateSplitSections();
}

module.exports = { migrateSplitSections };
