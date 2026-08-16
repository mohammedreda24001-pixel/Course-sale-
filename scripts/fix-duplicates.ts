/**
 * Find and fix duplicate receipt numbers
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aypfkugcwxvxjmbxjfkt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cGZrdWdjd3h2eGptYnhqZmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzMjA2OSwiZXhwIjoyMDk3MDA4MDY5fQ._xSGxe8YJJjyqyrM4ZXjb9BtGyu3lesVgC0tIFPWUUE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function findAndFixDuplicates() {
  console.log('🔍 Looking for duplicate receipt numbers...\n');
  
  try {
    // 1. Find all orders with receipt numbers (not empty/null)
    const { data: allOrders, error } = await supabase
      .from('orders')
      .select('id, receiptNumber, createdAt')
      .not('receiptNumber', 'is', null)
      .neq('receiptNumber', '')
      .order('createdAt');

    if (error) throw error;
    
    console.log(`📊 Found ${allOrders?.length || 0} orders with receipt numbers`);
    
    // 2. Group by receipt number to find duplicates
    const receiptMap = new Map<string, any[]>();
    
    allOrders?.forEach(order => {
      const receipt = order.receiptNumber?.trim();
      if (receipt) {
        if (!receiptMap.has(receipt)) {
          receiptMap.set(receipt, []);
        }
        receiptMap.get(receipt)?.push(order);
      }
    });
    
    // 3. Show duplicates
    const duplicates: string[] = [];
    receiptMap.forEach((orders, receiptNum) => {
      if (orders.length > 1) {
        duplicates.push(receiptNum);
        console.log(`\n⚠️  Duplicate: "${receiptNum}" appears ${orders.length} times:`);
        orders.forEach(o => {
          console.log(`   - ID: ${o.id}, Created: ${o.createdAt}`);
        });
      }
    });
    
    if (duplicates.length === 0) {
      console.log('\n✅ No duplicates found!');
      return;
    }
    
    console.log(`\n\n📋 Summary: Found ${duplicates.length} duplicate receipt number(s)`);
    console.log('\n'.repeat(2));
    console.log('=' .repeat(60));
    console.log('SQL TO FIX DUPLICATES (Run in Supabase SQL Editor):');
    console.log('=' .repeat(60));
    
    // Generate fix SQL for each duplicate
    let sqlFixes = '-- Fix duplicate receipt numbers\n\n';
    
    duplicates.forEach((receiptNum, idx) => {
      const orders = receiptMap.get(receiptNum)!;
      
      // Keep the first one, renumber the rest
      for (let i = 1; i < orders.length; i++) {
        const newReceipt = `${receiptNum}-${i + 1}`;
        sqlFixes += `-- Fix duplicate #${idx + 1}.${i}: Change order ${orders[i].id} from "${receiptNum}" to "${newReceipt}"\n`;
        sqlFixes += `UPDATE orders SET "receiptNumber" = '${newReceipt}' WHERE id = ${orders[i].id};\n\n`;
      }
    });
    
    console.log(sqlFixes);
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAndFixDuplicates();
