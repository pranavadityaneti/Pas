import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize the Supabase Admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

router.post('/create-manager', async (req: Request, res: Response): Promise<any> => {
  try {
    const { phone, name, storeId } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header.' });
    }

    const token = authHeader.replace('Bearer ', '');

    // 1. Authenticate the calling user using their JWT
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // 2. The Owner-Only Guard: Caller is authorized if EITHER:
    //    (a) they are the root merchant owner of the branch's parent merchant, OR
    //    (b) they hold an 'owner' staff role for this specific branch
    let isAuthorized = false;

    // (a) Check if caller is the root owner of the merchant that owns this branch
    const { data: branchData } = await supabaseAdmin
      .from('merchant_branches')
      .select('merchant_id')
      .eq('id', storeId)
      .single();

    if (branchData?.merchant_id === caller.id) {
      isAuthorized = true;
    }

    // (b) Fallback: caller is an 'owner' staff member of ANY branch under the
    //     same parent merchant — i.e., they're an owner-level operator for this merchant.
    if (!isAuthorized && branchData?.merchant_id) {
      const { data: siblingBranches } = await supabaseAdmin
        .from('merchant_branches')
        .select('id')
        .eq('merchant_id', branchData.merchant_id);

      const siblingIds = (siblingBranches || []).map(b => b.id);
      if (siblingIds.length > 0) {
        const { data: callerOwnerStaff } = await supabaseAdmin
          .from('store_staff')
          .select('store_id')
          .eq('user_id', caller.id)
          .eq('role', 'owner')
          .in('store_id', siblingIds)
          .limit(1);
        if (callerOwnerStaff && callerOwnerStaff.length > 0) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Access denied. Only the store owner can create branch managers.'
      });
    }

    // 3. The Auth Handshake: Attempt to create the user
    let targetUserId: string;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      phone,
      user_metadata: { name, role: 'manager' },
      email_confirm: true,
      phone_confirm: true
    });

    if (createError) {
      // Handle edge case: The user/phone already exists in the system
      if (createError.message.includes('already exists') || createError.status === 422) {
        // Resolve the existing auth user via auth.admin (Supabase has no direct getUserByPhone,
        // so we list and filter). Normalize phone variants — input may be "9959123123",
        // stored may be "919959123123" or "+919959123123".
        const phoneVariants = new Set<string>();
        const digits = phone.replace(/\D/g, '');
        const last10 = digits.slice(-10);
        phoneVariants.add(digits);
        phoneVariants.add(last10);
        phoneVariants.add(`91${last10}`);
        phoneVariants.add(`+91${last10}`);

        const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) {
          return res.status(500).json({ error: 'Failed to look up existing user.' });
        }
        const match = listData?.users?.find((u: any) =>
          u.phone && phoneVariants.has(u.phone.replace(/\D/g, ''))
        );

        if (!match) {
          return res.status(400).json({ error: 'User phone already registered but could not resolve user ID. Please contact support.' });
        }
        targetUserId = match.id;
      } else {
        return res.status(400).json({ error: createError.message });
      }
    } else {
      targetUserId = newUser.user.id;
    }

    // 4. The Ledger Mapping: Assign the target user to the store as a manager.
    // Idempotent: if a row already exists for this (store_id, user_id), update it; else insert.
    const { data: existingRow } = await supabaseAdmin
      .from('store_staff')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    let insertError: any = null;
    if (existingRow) {
      const { error: updErr } = await supabaseAdmin
        .from('store_staff')
        .update({ role: 'manager', name, phone, is_active: true })
        .eq('id', existingRow.id);
      insertError = updErr;
    } else {
      const { error: insErr } = await supabaseAdmin
        .from('store_staff')
        .insert({
          store_id: storeId,
          user_id: targetUserId,
          role: 'manager',
          name,
          phone,
        });
      insertError = insErr;
    }

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'This user is already staff for this store.' });
      }
      console.error('store_staff insert/update error:', insertError);
      return res.status(500).json({ error: `Failed to assign manager role to store: ${insertError.message}` });
    }

    return res.status(201).json({ 
      message: 'Manager successfully created and assigned.',
      user_id: targetUserId
    });

  } catch (err) {
    console.error('Error in /create-manager:', err);
    return res.status(500).json({ error: 'Internal server error processing manager creation.' });
  }
});

export default router;
