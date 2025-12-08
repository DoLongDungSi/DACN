# Project Repair Plan

## Current Issues:
1. **Port Mismatch**: Backend listens on port 5001, but docker-compose maps "5000:5000", nginx proxies to backend:5001. Fix docker-compose to "5000:5001".
2. **Avatar Image Processing Error**: Likely base64 data URL too large or invalid. Limit size or use file upload instead.
3. **Problem Detail Loading**: API calls hanging due to port issue. Fix port to resolve.
4. **CSV Upload/Download**: Paths fixed, test with port fix.
5. **Submissions**: Fixed, test with port fix.
6. **Database Schema**: Added is_deleted, but data lost on rebuild. Seed data if needed.

## Step-by-Step Fix Plan:

1. **Fix Port Configuration**:
   - docker-compose.yml: Change backend ports to "5000:5001"
   - frontend/nginx.conf: Ensure proxy_pass http://backend:5001/api/

2. **Restart Containers**:
   - docker-compose down
   - docker-compose up --build

3. **Test Core Flow**:
   - Login
   - View problems list
   - Click problem detail
   - Create new problem
   - Upload CSV files
   - Submit solution
   - View submissions

4. **Fix Avatar**:
   - Add size limit to avatar upload
   - Test cropping and upload

5. **Seed Data**:
   - Use initialData route to populate tags, metrics, sample problems

6. **Verify All Features**:
   - Images load
   - CSV download
   - Submissions update
   - Data description shows

## Files to Edit:
- docker-compose.yml (ports)
- frontend/nginx.conf (proxy)
- backend/routes/users.js (avatar size limit)