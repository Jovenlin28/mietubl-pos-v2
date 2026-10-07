import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import bcrypt from "bcryptjs";

export default function registerUsers(app: express.Express, db: any, ) {
  // API: Get users (with pagination and search)
  app.get("/api/users", async (req, res) => {
    
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const search = (req.query.search as string)?.trim();

    let where = "";
    const params: any[] = [];
    if (search) {
      where = "WHERE fullName LIKE ? OR username LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }

    try {
      const totalRow = await db.get(`SELECT COUNT(*) as count FROM users ${where}`, params.length ? params : undefined);
      const total = totalRow ? totalRow.count : 0;

      const listSql = `SELECT id, fullName, phone, username, role, status, avatar, createdOn FROM users ${where} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`;
      const items = await db.all(listSql, params.length ? params : undefined);

      res.json({ items, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // API: Get user by ID
  app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    // include avatar in single-user response
    try {
      const user = await db.get(
        `SELECT id, fullName, phone, username, role, status, createdOn, avatar FROM users WHERE id = ?`,
        [id]
      );
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      console.error("GET /api/users/:id failed:", err);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // API: Create user
  app.post('/api/users', async (req, res) => {
    try {
      const { fullName, phone, username, password, role, status, avatar } = req.body;
      const usernameTrim = (username ?? "").toString().trim();
      if (!usernameTrim) {
        return res.status(400).json({ error: "Username is required." });
      }

      // Check if username already exists
      const existing = await db.get(`SELECT id FROM users WHERE username = ?`, [usernameTrim]);
      if (existing) {
        return res.status(409).json({ error: "Username already exists. Please try another username" });
      }

      // Hash password before saving
      const plainPwd = (password ?? "").toString();
      const hashedPwd = plainPwd ? await bcrypt.hash(plainPwd, 10) : "";
      const result = await db.run(
        `INSERT INTO users (fullName, phone, username, password, role, status, avatar, createdOn)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [fullName, phone ?? null, usernameTrim, hashedPwd, role ?? null, status ?? "Active", avatar ?? null]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM users WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      console.error("Create user failed:", err);
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  
  // API: Update user
  app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { fullName, phone, username, password, role, status, avatar } = req.body as User;
    try {
      const usernameTrim = (username ?? "").toString().trim();
      if (!usernameTrim) {
        return res.status(400).json({ error: "Username is required." });
      }

      // Check for username conflict with other users
      const conflict = await db.get(`SELECT id FROM users WHERE username = ? AND id != ?`, [usernameTrim, id]);
      if (conflict) {
        return res.status(409).json({ error: "Username already exists. Please try another username" });
      }

      // If password is undefined or empty, do not update password
      if (typeof password === "undefined" || password === "") {
        await db.run(
          `UPDATE users SET fullName = ?, phone = ?, username = ?, role = ?, status = ?, avatar = ? WHERE id = ?`,
          [fullName, phone, usernameTrim, role, status, avatar ?? null, id]
        );
      } else {
        // Hash new password before updating
        const hashedPwd = await bcrypt.hash(password, 10);
        await db.run(
          `UPDATE users SET fullName = ?, phone = ?, username = ?, password = ?, role = ?, status = ?, avatar = ? WHERE id = ?`,
          [fullName, phone, usernameTrim, hashedPwd, role, status, avatar ?? null, id]
        );
      }
 
       // Fetch updated user to include latest fields in token
       const updatedUser = await db.get(
         `SELECT id, username, role, fullName, status, phone, avatar FROM users WHERE id = ?`,
         [id]
       );
 
       // Sign new JWT so client can refresh stored token after profile update
       const secret = process.env.JWT_SECRET || "";
       let token: string | null = null;
       try {
         if (updatedUser) {
           token = jwt.sign(
             {
               id: updatedUser.id,
               username: updatedUser.username,
               role: updatedUser.role,
               fullName: updatedUser.fullName,
               status: updatedUser.status,
               phone: updatedUser.phone,
               avatar: updatedUser.avatar
             },
             secret,
             { expiresIn: "1d" }
           );
         }
       } catch (signErr) {
         console.error("Failed to sign JWT after user update:", signErr);
       }
 
      res.json({ success: 1, token, user: updatedUser });
    } catch (err) {
      console.error("Update user failed:", err);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // API: Login endpoint
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    try {
      const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
      if (!user) return res.status(401).json({ error: "Invalid username or password." });

      const storedPwd: string = typeof user.password === "string" ? user.password : "";
      let match = false;
      if (storedPwd && storedPwd.startsWith("$2")) {
        match = await bcrypt.compare(password, storedPwd);
      } else {
        match = storedPwd === password;
        if (match) {
          try {
            const newHash = await bcrypt.hash(password, 10);
            await db.run(`UPDATE users SET password = ? WHERE id = ?`, [newHash, user.id]);
          } catch {}
        }
      }
      if (!match) return res.status(401).json({ error: "Invalid username or password." });

      // Fetch role_id (trim + case-insensitive)
      let roleId: number | null = null;
      try {
        const roleRow = await db.get(
          `SELECT id FROM roles WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
          [user.role || ""]
        );
        roleId = roleRow?.id ?? null;
      } catch (rErr) {
        console.error("Lookup role_id failed:", rErr);
      }

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          role_id: roleId, // included in JWT payload too (optional)
          fullName: user.fullName,
          status: user.status,
          phone: user.phone,
          avatar: user.avatar
        },
        process.env.JWT_SECRET || "",
        { expiresIn: "1d" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
            username: user.username,
          role: user.role,
          role_id: roleId, // NEW FIELD
          status: user.status,
          createdOn: user.createdOn,
        },
      });
    } catch (err) {
      console.error("Login failed:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // API: Delete user
  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      // verify user exists
      const existing = await db.get(`SELECT id FROM users WHERE id = ?`, [id]);
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }

      await db.run(`DELETE FROM users WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("Delete user failed:", err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });
 
 }