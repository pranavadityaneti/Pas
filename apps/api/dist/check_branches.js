"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkMerchantBranches() {
    try {
        const columns = await prisma.$queryRaw `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'merchant_branches' AND table_schema = 'public'
    `;
        console.log(JSON.stringify(columns, null, 2));
    }
    catch (error) {
        console.error('Error checking columns:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkMerchantBranches();
//# sourceMappingURL=check_branches.js.map