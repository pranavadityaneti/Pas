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

    // 2. The Owner-Only Guard: Verify the caller holds the "owner" role for this storeId
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from('store_staff')
      .select('role')
      .eq('store_id', storeId)
      .eq('user_id', caller.id)
      .eq('role', 'owner')
      .single();

    if (roleError || !callerRole) {
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
        // We query the mock_customers or users table. For simplicity if using custom public users table fallback:
        const { data: existingUser, error: findError } = await supabaseAdmin
          .from('users') // replace with your actual public user mapping view/table if different
          .select('id')
          .eq('phone', phone)
          .single();

        if (findError || !existingUser) {
          // If we can't find them, we don't have enough data to proceed
          return res.status(400).json({ error: 'User phone already registered but could not resolve user ID. Please contact support.' });
        }
        targetUserId = existingUser.id;
      } else {
        return res.status(400).json({ error: createError.message });
      }
    } else {
      targetUserId = newUser.user.id;
    }

    // 4. The Ledger Mapping: Assign the target user to the store as a manager
    const { error: insertError } = await supabaseAdmin
      .from('store_staff')
      .insert({
        store_id: storeId,
        user_id: targetUserId,
        role: 'manager'
      });

    // Handle case where they are already a manager at this specific store
    if (insertError) {
      if (insertError.code === '23505') { // Postgres unique violation code
        return res.status(400).json({ error: 'This user is already staff for this store.' });
      }
      return res.status(500).json({ error: 'Failed to assign manager role to store.' });
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
