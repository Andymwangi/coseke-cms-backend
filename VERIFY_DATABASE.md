# Database Verification Commands

Run these commands on your cloud server to verify the actual database name:

## Option 1: Check via MongoDB Shell

```bash
# Connect to MongoDB
mongosh

# List all databases
show dbs

# Check which database the app is using
use undefined
show collections

# Exit
exit
```

## Option 2: Check Backend Logs

```bash
# View PM2 logs (you already did this)
pm2 logs cms-backend --lines 50

# Look for lines like:
# "Connected to <database_name> database"
```

## Option 3: Check from Node.js

Create a quick verification script:

```bash
cd /var/www/cms-backend/server
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/undefined').then(() => { console.log('DB Name:', mongoose.connection.name); console.log('Collections:', mongoose.connection.db.listCollections().toArray()); mongoose.disconnect(); });"
```

## What Your Logs Already Showed

From the logs you shared earlier:

```
0|cms-api  | Server running on http://0.0.0.0:5005
0|cms-api  | Connected to undefined database
```

This confirms the database name is **`undefined`**.

## Additional Verification

Check the `.env` file on the server:

```bash
cat /var/www/cms-backend/server/.env | grep MONGO
```

The `MONGO_URI` you shared was:

```
MONGO_URI=mongodb://localhost:27017/
```

Notice it doesn't specify a database name after the `/`, so the code defaults to using `undefined` (from `connectDB('undefined')` in `index.js`).
