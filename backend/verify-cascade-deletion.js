const { PrismaClient } = require('@prisma/client');

async function verifyDatabaseCleanup() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking database for remaining artifacts after project deletion...\n');
    
    // Check Projects table
    const projectCount = await prisma.project.count();
    console.log(`📊 Projects: ${projectCount}`);
    
    // Check DesignSplits table
    const splitCount = await prisma.designSplit.count();
    console.log(`📊 DesignSplits: ${splitCount}`);
    
    // Check SplitAssets table
    const assetCount = await prisma.splitAsset.count();
    console.log(`📊 SplitAssets: ${assetCount}`);
    
    // Check for any orphaned records
    const orphanedSplits = await prisma.designSplit.findMany({
      where: {
        projectId: {
          not: null
        },
        project: null
      }
    });
    
    const orphanedAssets = await prisma.splitAsset.findMany({
      where: {
        projectId: {
          not: null
        },
        project: null
      }
    });
    
    console.log(`\n🔍 Orphaned Records Check:`);
    console.log(`   Orphaned DesignSplits: ${orphanedSplits.length}`);
    console.log(`   Orphaned SplitAssets: ${orphanedAssets.length}`);
    
    // Summary
    const totalRecords = projectCount + splitCount + assetCount;
    console.log(`\n✅ Total Records in Database: ${totalRecords}`);
    
    if (totalRecords === 0) {
      console.log('🎉 SUCCESS: Database is completely clean! Cascade deletion worked perfectly.');
    } else {
      console.log('⚠️  WARNING: Some records remain in the database.');
      
      if (projectCount > 0) {
        const projects = await prisma.project.findMany();
        console.log('Remaining projects:', projects.map(p => ({ id: p.id, name: p.name })));
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabaseCleanup();
