# CRITICAL INFRASTRUCTURE PROTOCOL
1. **IMMUTABLE FILES:** You are STRICTLY FORBIDDEN from modifying `eas.json`, `app.json`, `package.json`, or `.elasticbeanstalk/*` without explicit permission.
2. **ENVIRONMENT LOCK:** Production API = `https://api.pickatstore.io`. AWS Target = `pas-api-prod-v2`.
3. **AUDIT FIRST:** Always run `git status` and wait for human approval before executing `eas build` or `eb deploy`.
