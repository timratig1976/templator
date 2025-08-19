const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateCutLines() {
  console.log('🚀 Starting Cut Lines Migration...');
  
  try {
    // Step 1: Get all current assets
    const allAssets = await prisma.splitAsset.findMany({
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${allAssets.length} total assets`);
    
    // Step 2: Separate JSON (cut lines) from image-crop (image parts)
    const jsonAssets = allAssets.filter(a => a.kind === 'json');
    const imageCropAssets = allAssets.filter(a => a.kind === 'image-crop');
    
    console.log(`- ${jsonAssets.length} JSON assets (cut lines data)`);
    console.log(`- ${imageCropAssets.length} image-crop assets (split image parts)`);
    
    // Step 3: Create migration data structure
    const migrationPlan = {
      cutLines: jsonAssets.map(asset => ({
        id: asset.id,
        splitId: asset.splitId,
        order: asset.order || 0,
        sectionType: asset.meta?.sectionType || 'unknown',
        sectionName: asset.meta?.sectionName || `Section ${asset.order || 0}`,
        bounds: asset.meta?.bounds || null,
        metadata: asset.meta || {},
        createdAt: asset.createdAt
      })),
      imageParts: imageCropAssets.map(asset => {
        // Find matching cut line by splitId and order
        const matchingCutLine = jsonAssets.find(j => 
          j.splitId === asset.splitId && j.order === asset.order
        );
        
        return {
          id: asset.id,
          cutLineId: matchingCutLine?.id || null,
          storageUrl: asset.storageUrl,
          size: asset.meta?.size || null,
          width: asset.meta?.width || null,
          height: asset.meta?.height || null,
          format: asset.meta?.format || 'png',
          createdAt: asset.createdAt
        };
      })
    };
    
    // Step 4: Display migration plan
    console.log('\n📋 Migration Plan:');
    console.log(`Will create ${migrationPlan.cutLines.length} cut lines:`);
    migrationPlan.cutLines.forEach(cutLine => {
      console.log(`  - ${cutLine.sectionName} (order: ${cutLine.order})`);
    });
    
    console.log(`\nWill create ${migrationPlan.imageParts.length} image parts:`);
    const partsWithCutLines = migrationPlan.imageParts.filter(p => p.cutLineId);
    const orphanedParts = migrationPlan.imageParts.filter(p => !p.cutLineId);
    
    console.log(`  - ${partsWithCutLines.length} linked to cut lines`);
    console.log(`  - ${orphanedParts.length} orphaned (no matching cut line)`);
    
    if (orphanedParts.length > 0) {
      console.log('\n⚠️  Orphaned image parts:');
      orphanedParts.forEach(part => {
        console.log(`    - ${part.id} (no cut line found)`);
      });
    }
    
    // Step 5: Show the new structure
    console.log('\n🎯 New Database Structure:');
    console.log('┌─ SplitCutLine (cut lines data)');
    console.log('│  ├─ id, splitId, order, sectionType, sectionName');
    console.log('│  ├─ bounds (x, y, width, height)');
    console.log('│  └─ metadata (additional section data)');
    console.log('│');
    console.log('└─ SplitImagePart (cropped images you manage)');
    console.log('   ├─ id, cutLineId, storageUrl');
    console.log('   ├─ size, width, height, format');
    console.log('   └─ createdAt');
    
    console.log('\n✅ Migration analysis complete!');
    console.log('\nBenefits:');
    console.log('- Clean separation of concerns');
    console.log('- Cut lines data in dedicated table');
    console.log('- Image parts easy to manage/delete');
    console.log('- Proper foreign key relationships');
    console.log('- No more mixed "kind" filtering needed');
    
  } catch (error) {
    console.error('❌ Migration analysis failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  migrateCutLines();
}

module.exports = { migrateCutLines };
