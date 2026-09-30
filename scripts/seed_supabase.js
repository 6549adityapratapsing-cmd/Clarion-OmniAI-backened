require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xdmwqroagfbkoyhimsyz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function seedSupabase() {
  console.log('=================================================================');
  console.log('🚀 SEEDING SUPABASE DATABASE & AUTHENTICATION');
  console.log('Project URL:', SUPABASE_URL);
  console.log('=================================================================\n');

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Define Accounts: 1 Admin + 3 Students
  const accountsToSeed = [
    {
      email: 'admin@clarion.ai',
      password: 'Password@123',
      fullName: 'Alexander Vance',
      role: 'ADMIN',
      department: 'Platform Architecture & Governance'
    },
    {
      email: 'student.aarav@university.edu',
      password: 'Password@123',
      fullName: 'Aarav Sharma (Student)',
      role: 'REVIEWER',
      department: 'Accounts Payable Operations'
    },
    {
      email: 'student.priya@university.edu',
      password: 'Password@123',
      fullName: 'Priya Patel (Student)',
      role: 'REVIEWER',
      department: 'Procurement & Vendor Audit'
    },
    {
      email: 'student.rohan@university.edu',
      password: 'Password@123',
      fullName: 'Rohan Mehta (Student)',
      role: 'VIEWER',
      department: 'Financial Analysis'
    }
  ];

  console.log('--- Step 1: Registering / Ensuring Accounts in Supabase Auth ---');
  const seededUsers = [];

  for (const acc of accountsToSeed) {
    try {
      // Check if user already exists
      const { data: listData } = await adminClient.auth.admin.listUsers();
      let existing = listData?.users?.find(u => u.email?.toLowerCase() === acc.email.toLowerCase());

      if (!existing) {
        const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
          email: acc.email,
          password: acc.password,
          email_confirm: true,
          user_metadata: {
            fullName: acc.fullName,
            role: acc.role,
            department: acc.department
          }
        });

        if (createError) {
          console.error(`❌ Failed to create ${acc.email}:`, createError.message);
        } else {
          console.log(`✅ Registered in Supabase Auth: ${acc.email} [${acc.role}] (ID: ${createData.user.id})`);
          seededUsers.push({ ...acc, id: createData.user.id });
        }
      } else {
        // Update user metadata in case it changed
        await adminClient.auth.admin.updateUserById(existing.id, {
          user_metadata: {
            fullName: acc.fullName,
            role: acc.role,
            department: acc.department
          }
        });
        console.log(`✅ Verified in Supabase Auth: ${acc.email} [${acc.role}] (ID: ${existing.id})`);
        seededUsers.push({ ...acc, id: existing.id });
      }
    } catch (err) {
      console.error(`Error processing ${acc.email}:`, err.message);
    }
  }

  // 2. Test Logging In Each User via Supabase Auth
  console.log('\n--- Step 2: Testing Supabase Auth Login for All Seeded Users ---');
  for (const user of seededUsers) {
    try {
      const { data: authData, error: signInError } = await anonClient.auth.signInWithPassword({
        email: user.email,
        password: user.password
      });

      if (signInError) {
        console.error(`❌ Login failed for ${user.email}:`, signInError.message);
      } else {
        const tokenSnippet = authData.session.access_token.substring(0, 30) + '...';
        console.log(`✅ Login SUCCESS: ${user.email}`);
        console.log(`   Session JWT: ${tokenSnippet}`);
        console.log(`   Verified Role: ${authData.user.user_metadata?.role}`);
        console.log(`   Department: ${authData.user.user_metadata?.department}`);
      }
    } catch (err) {
      console.error(`Exception during login of ${user.email}:`, err.message);
    }
  }

  // 3. Create & Seed Supabase Storage
  console.log('\n--- Step 3: Setting Up Supabase Storage Bucket & Seed Documents ---');
  try {
    const { data: bucket, error: bucketError } = await adminClient.storage.createBucket('documents', {
      public: true,
      fileSizeLimit: 20971520 // 20 MB
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.warn('⚠️ Bucket creation notice:', bucketError.message);
    } else {
      console.log('✅ Supabase Storage bucket "documents" is ready and active.');
    }

    // Seed mock PDF business documents into Supabase Storage
    const sampleFiles = [
      {
        path: 'seed/INV_2026_001_Acme_Industrial_Clean.pdf',
        content: '%PDF-1.4\n% Clarion OmniAI Clean Commercial Invoice Sample\nSupplier: Acme Industrial Supplies\nInvoice: INV-2026-001\nTotal: INR 11800.00\n'
      },
      {
        path: 'seed/INV_2026_005_PO_Mismatch_Scenario_5.pdf',
        content: '%PDF-1.4\n% Clarion OmniAI PO Mismatch Scenario Invoice\nSupplier: TechFlow IT\nInvoice: INV-2026-005\nRef PO: PO-2026-088\nTotal: INR 102000.00\n'
      },
      {
        path: 'seed/PO_2026_088_TechFlow_Baseline.pdf',
        content: '%PDF-1.4\n% Clarion OmniAI Baseline Purchase Order\nSupplier: TechFlow IT\nPO: PO-2026-088\nTotal: INR 95000.00\n'
      }
    ];

    for (const f of sampleFiles) {
      const { data: uploadData, error: uploadError } = await adminClient.storage
        .from('documents')
        .upload(f.path, Buffer.from(f.content), {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.warn(`Upload warning for ${f.path}:`, uploadError.message);
      } else {
        console.log(`✅ Uploaded to Supabase Storage: ${f.path}`);
      }
    }

    // List seeded files
    const { data: fileList } = await adminClient.storage.from('documents').list('seed');
    console.log(`\n✅ Verified Files in Supabase Storage (${fileList?.length || 0} items):`);
    fileList?.forEach(file => {
      console.log(`   - ${file.name} (${file.metadata?.size || 'unknown'} bytes)`);
    });

  } catch (storageErr) {
    console.error('Storage seeding error:', storageErr.message);
  }

  console.log('\n=================================================================');
  console.log('🎉 SUPABASE SEEDING AND VERIFICATION COMPLETED SUCCESSFULLY');
  console.log('=================================================================');
}

seedSupabase().catch(console.error);
