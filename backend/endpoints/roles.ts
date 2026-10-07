import express from "express";

export default function registerRoles(app: express.Express, db: any, ) {
  // API: Get roles (with pagination and search)
  app.get("/api/roles", async (req, res) => {
    
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;

    try {
      const totalRow: any = await db.get(`SELECT COUNT(*) as count FROM roles`);
      const total = totalRow ? (totalRow.count ?? 0) : 0;

      const listSql = `SELECT id, name, status, createdOn FROM roles ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`;
      const items = await db.all(listSql);

      res.json({ items, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  // API: Get role by ID (include permissions)
  app.get('/api/roles/:id', async (req, res) => {
    
    const { id } = req.params;
    try {
      const role = await db.get(
        `SELECT id, name, status, createdOn FROM roles WHERE id = ?`,
        [id]
      );
      if (!role) return res.status(404).json({ error: "Role not found" });

      // load row-per-permission entries and assemble nested permissions object
      const permRows = await db.all(
        `SELECT module, permission, allowed FROM role_permissions WHERE role_id = ?`,
        [id]
      );

      const permissions: Record<string, Record<string, boolean>> = {};
      for (const r of permRows) {
        const mod = r.module || "General";
        const perm = r.permission;
        const allowed = Number(r.allowed) === 1;
        if (!permissions[mod]) permissions[mod] = {};
        permissions[mod][perm] = allowed;
      }

      res.json({ ...role, permissions });
    } catch (err) {
      console.error("Fetch role failed:", err);
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  // API: Get role by name (case-insensitive) and return users with that role
  app.get('/api/roles/name/:name', async (req, res) => {
    const raw = req.params.name ?? "";
    const nameParam = decodeURIComponent(raw).trim();
    if (!nameParam) {
      return res.status(400).json({ error: "Role name is required" });
    }

    try {
      // Try exact match first, then case-insensitive fallback
      let role = await db.get(
        `SELECT id, name, status, createdOn FROM roles WHERE name = ?`,
        [nameParam]
      );
      if (!role) {
        role = await db.get(
          `SELECT id, name, status, createdOn FROM roles WHERE LOWER(name) = ?`,
          [nameParam.toLowerCase()]
        );
      }

      if (!role) return res.status(404).json({ error: "Role not found" });

      // Fetch users that have this role (users.role stores role name)
      let users: any[] = [];
      try {
        users = await db.all(
          `SELECT id, username, fullName, role, status, createdOn FROM users WHERE role = ? ORDER BY id DESC`,
          [role.name]
        );
      } catch (uErr) {
        // If users table does not exist or query fails, return empty users array
        console.error("Failed to fetch users for role:", role.name, uErr);
        users = [];
      }

      // Fetch permissions for this role and assemble into nested object
      let permissions: Record<string, Record<string, boolean>> = {};
      try {
        const permRows = await db.all(
          `SELECT module, permission, allowed FROM role_permissions WHERE role_id = ?`,
          [role.id]
        );
        for (const r of (permRows || [])) {
          const mod = r.module || "General";
          const perm = r.permission;
          const allowed = Number(r.allowed) === 1;
          if (!permissions[mod]) permissions[mod] = {};
          permissions[mod][perm] = allowed;
        }
      } catch (pErr) {
        console.error("Failed to fetch permissions for role:", role.name, pErr);
        permissions = {};
      }

      // Return single response object that includes permissions and users
      res.json({ ...role, permissions, users });
    } catch (err) {
      console.error("Fetch role by name failed:", err);
      res.status(500).json({ error: "Failed to fetch role by name" });
    }
  });
 
   // API: Create role
   app.post("/api/roles", async (req, res) => {
    try {
      const { name, status } = req.body;
      const result = await db.run(`INSERT INTO roles (name, status, createdOn) VALUES (?, ?, NOW())`, [name, status]);
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM roles WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  // API: Update role
  app.put('/api/roles/:id', async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
      await db.run(
        `UPDATE roles SET name = ?, status = ? WHERE id = ?`,
        [name, status, id]
      );
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  // API: Delete role
  app.delete('/api/roles/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await db.run(`DELETE FROM roles WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // --- Permissions endpoints ---
  // GET /api/roles/:id/permissions  -> returns stored permissions (if any)
  app.get('/api/roles/:id/permissions', async (req, res) => {
    
    const { id } = req.params;
    try {
      const role = await db.get(`SELECT id FROM roles WHERE id = ?`, [id]);
      if (!role) return res.status(404).json({ error: "Role not found" });

      // assemble permissions from row-per-permission schema
      const permRows = await db.all(
        `SELECT module, permission, allowed FROM role_permissions WHERE role_id = ?`,
        [id]
      );

      const perms: Record<string, Record<string, boolean>> = {};
      for (const r of (permRows || [])) {
        const mod = r.module || "General";
        const perm = r.permission;
        const allowed = Number(r.allowed) === 1;
        if (!perms[mod]) perms[mod] = {};
        perms[mod][perm] = allowed;
      }

      res.json({ permissions: perms });
    } catch (err) {
      console.error("Fetch role permissions failed:", err);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  // POST /api/roles/:id/permissions  -> save permissions payload (row-per-permission schema)
  app.post('/api/roles/:id/permissions', async (req, res) => {
    
    const { id } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return res.status(400).json({ error: "Invalid permissions payload" });
    }

    try {
      const role = await db.get(`SELECT id FROM roles WHERE id = ?`, [id]);
      if (!role) return res.status(404).json({ error: "Role not found" });

      // Use a real connection and connection.beginTransaction() so START/COMMIT are not sent as prepared stmts
      const pool = await (db as any).initPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const moduleName of Object.keys(permissions)) {
          const permsObj = permissions[moduleName] || {};
          for (const permName of Object.keys(permsObj)) {
            const allowed = permsObj[permName] ? 1 : 0;
            await conn.execute(
              `INSERT INTO role_permissions (role_id, module, permission, allowed)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
              [id, moduleName, permName, allowed]
            );
          }
        }
        await conn.commit();
      } catch (txErr) {
        try { await conn.rollback(); } catch (_) {}
        throw txErr;
      } finally {
        conn.release();
      }

      res.json({ success: 1 });
    } catch (err) {
      console.error("Save role permissions failed:", err);
      res.status(500).json({ error: "Failed to save permissions" });
    }
  });
}