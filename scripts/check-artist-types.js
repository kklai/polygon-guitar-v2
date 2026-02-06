const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// 初始化 Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkArtistTypes() {
  console.log('🔍 檢查 Firestore artists 集合中的 artistType 值...\n');

  try {
    // 獲取所有 artists 文檔
    const artistsSnapshot = await db.collection('artists').get();
    
    if (artistsSnapshot.empty) {
      console.log('❌ 資料庫中冇任何 artists');
      process.exit(0);
    }

    // 統計所有不同的 artistType
    const artistTypes = new Map(); // type -> count
    const artistsByType = new Map(); // type -> [{name, id}]
    const artistsWithoutType = [];

    artistsSnapshot.forEach((doc) => {
      const artist = doc.data();
      const type = artist.artistType;
      
      if (!type) {
        artistsWithoutType.push({
          id: doc.id,
          name: artist.name || 'N/A'
        });
        return;
      }

      // 統計數量
      artistTypes.set(type, (artistTypes.get(type) || 0) + 1);

      // 保存示例藝人
      if (!artistsByType.has(type)) {
        artistsByType.set(type, []);
      }
      if (artistsByType.get(type).length < 5) {
        artistsByType.get(type).push({
          id: doc.id,
          name: artist.name || 'N/A'
        });
      }
    });

    // 顯示結果
    console.log('📊 ArtistType 統計結果：');
    console.log('=' .repeat(60));
    
    if (artistTypes.size === 0) {
      console.log('⚠️ 所有 artist 都冇 artistType 欄位');
    } else {
      // 按數量排序
      var sortedTypes = Array.from(artistTypes.entries())
        .sort((a, b) => b[1] - a[1]);

      sortedTypes.forEach(([type, count]) => {
        console.log(`\n🎵 ${type}: ${count} 個藝人`);
        
        // 顯示示例
        const examples = artistsByType.get(type) || [];
        if (examples.length > 0) {
          console.log('   示例：');
          examples.forEach(artist => {
            console.log(`     - ${artist.name} (${artist.id})`);
          });
        }
      });
    }

    // 顯示冇 artistType 的藝人
    if (artistsWithoutType.length > 0) {
      console.log(`\n\n⚠️ 冇 artistType 欄位的藝人：${artistsWithoutType.length} 個`);
      console.log('=' .repeat(60));
      artistsWithoutType.slice(0, 10).forEach(artist => {
        console.log(`   - ${artist.name} (${artist.id})`);
      });
      if (artistsWithoutType.length > 10) {
        console.log(`   ... 還有 ${artistsWithoutType.length - 10} 個`);
      }
    }

    // 特別標註可能是組合/樂隊的值
    console.log('\n\n🎸 可能是組合/樂隊類型的值：');
    console.log('=' .repeat(60));
    
    const bandKeywords = ['group', 'band', '樂隊', '組合', 'team', 'group', 'duo', 'trio', 'band'];
    const potentialBandTypes = sortedTypes.filter(([type]) => {
      const lowerType = type.toLowerCase();
      return bandKeywords.some(keyword => lowerType.includes(keyword));
    });

    if (potentialBandTypes.length === 0) {
      console.log('⚠️ 冇找到明顯的組合/樂隊類型');
      console.log('\n建議檢查所有不同的 artistType 值：');
      sortedTypes.forEach(([type, count]) => {
        console.log(`   - ${type} (${count} 個)`);
      });
    } else {
      potentialBandTypes.forEach(([type, count]) => {
        console.log(`\n✅ ${type}: ${count} 個藝人`);
        const examples = artistsByType.get(type) || [];
        if (examples.length > 0) {
          console.log('   示例：');
          examples.forEach(artist => {
            console.log(`     - ${artist.name}`);
          });
        }
      });
    }

    console.log('\n\n📈 總結：');
    console.log('=' .repeat(60));
    console.log(`總藝人數: ${artistsSnapshot.size}`);
    console.log(`不同 artistType 數量: ${artistTypes.size}`);
    console.log(`冇 artistType 的藝人: ${artistsWithoutType.length}`);

  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
  
  process.exit(0);
}

checkArtistTypes();
