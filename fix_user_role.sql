-- Update the specific user to have the MERCHANT role
-- Replace 'pranav.n@drut.club' with the actual email if different, 
-- or rely on the user ID if known.
-- Since I don't have the user ID handy, I'll update by email as seen in the screenshot.

UPDATE "User"
SET role = 'MERCHANT'
WHERE email = 'pranav.n@drut.club';

-- Also ensure they have a manager entry in Store if not already linked (which they seems to be)
-- Ideally this is handled by the app logic, but just in case:
-- SELECT * FROM "Store" WHERE "managerId" = (SELECT id FROM "User" WHERE email = 'pranav.n@drut.club');
