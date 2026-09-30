const { Pool } = require('pg');
const pool = new Pool({ user:'erp_user', password:'erppass123', host:'localhost', database:'erp_db', port:5432 });
pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")
  .then(r => { console.log(r.rows.map(x=>x.tablename).join(', ')); pool.end(); })
  .catch(e => { console.error('DB ERROR:', e.message); pool.end(); process.exit(1); });
