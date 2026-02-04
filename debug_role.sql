-- check if the user exists
SELECT * FROM "User" WHERE email = 'pranav.n@drut.club';

-- Try updating with ILIKE (case-insensitive) and return the result to confirm it worked
UPDATE "User"
SET role = 'MERCHANT'
WHERE email ILIKE 'pranav.n@drut.club'
RETURNING *;
