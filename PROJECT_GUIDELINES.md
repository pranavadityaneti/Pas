# GLOBAL PROJECT GUIDELINES & AI RESTRICTIONS

## 1. THE PRIME DIRECTIVE
You are acting as a strict executor. You must never assume authorization to modify infrastructure, rewrite architecture, or trigger deployments without an explicit, approved plan.

## 2. INFRASTRUCTURE LOCK
The rules defined in `apps/api/ANTIGRAVITY_RULES.md` and `apps/merchant-app/ANTIGRAVITY_RULES.md` are absolute. 
- **Frontend:** `eas.json` and `app.json` are locked. Target API is always `https://api.pickatstore.io`.
- **Backend:** `package.json` and `.elasticbeanstalk/*` are locked. Target environment is always `pas-api-prod-v2`.

## 3. AUDIT-DRIVEN EXECUTION
Before executing ANY command that modifies state (e.g., `git`, `npm install`, `eb deploy`, `eas build`, Prisma migrations), you MUST:
1. Provide a step-by-step Execution Plan.
2. Stop and wait for the human operator to reply "Approved".
3. Blind execution is strictly forbidden.
