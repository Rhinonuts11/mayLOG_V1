@@ .. @@
 import fetch, { Response } from 'node-fetch';
 
-const BASE_URL = 'https://[redacted]/v1/maylog-activity';
+const BASE_URL = process.env.ACTIVITY_API_URL || 'http://localhost:10001/v1/maylog-activity';
 
 // todo: USE discord-embedbuilder FOR DEV COMMANDS