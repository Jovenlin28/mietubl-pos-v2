import express from "express";
import { Store } from "../models/Store";

export default function registerStores(app: express.Express, db: any, ) {
  app.get("/api/stores", async (req, res) => {
    
    const perPage = parseInt(req.query.perPage as string) || 10;
    const currentPage = parseInt(req.query.currentPage as string) || 1;
    const offset = (currentPage - 1) * perPage;
    const search = (req.query.search as string)?.trim();

    let where = "";
    const params: any[] = [];
    if (search) {
      where = "WHERE name LIKE ? OR address LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }

    try {
      const totalRow = await db.get(`SELECT COUNT(*) as count FROM stores ${where}`, params.length ? params : undefined);
      const total = totalRow ? totalRow.count : 0;

      const listSql = `SELECT * FROM stores ${where} ORDER BY id DESC LIMIT ${perPage} OFFSET ${offset}`;
      const items = await db.all(listSql, params.length ? params : undefined);

      res.json({ items, total });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stores" });
    }
  });

  // API: Add store
  app.post("/api/stores", async (req, res) => {
    try {
      const { name, address, phoneNumber, status } = req.body;
      const result = await db.run(
        `INSERT INTO stores (name, address, phoneNumber, status, createdOn) VALUES (?, ?, ?, ?, NOW())`,
        [name, address, phoneNumber ?? null, status ?? "Active"]
      );
      const newId = (result as any).insertId ?? (result as any).lastID;
      const created = await db.get(`SELECT * FROM stores WHERE id = ?`, [newId]);
      res.status(201).json({ success: 1, item: created });
    } catch (err) {
      res.status(500).json({ error: "Failed to create store" });
    }
  });

  // API: Update store
  app.put("/api/stores/:id", async (req, res) => {
    
    const { id } = req.params;
    const { name, address, phoneNumber, status } = req.body as Store;

    if (!name || !address) {
      return res.status(400).json({ error: "Store name and address are required." });
    }

    try {
      const existing = await db.get(`SELECT * FROM stores WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Store not found" });

      const phoneValue = typeof phoneNumber !== "undefined" ? phoneNumber : existing.phoneNumber;
      const statusValue = typeof status !== "undefined" ? status : existing.status;

      await db.run(
        `UPDATE stores SET name = ?, address = ?, phoneNumber = ?, status = ? WHERE id = ?`,
        [name, address, phoneValue ?? null, statusValue ?? null, id]
      );

      const updated = await db.get(`SELECT id, name, address, phoneNumber, status, createdOn FROM stores WHERE id = ?`, [id]);
      res.json({ success: 1, item: updated });
    } catch (err) {
      console.error("Update store failed:", err);
      res.status(500).json({ error: "Failed to update store" });
    }
  });

  // API: Delete store
  app.delete("/api/stores/:id", async (req, res) => {
    
    const { id } = req.params;
    try {
      const existing = await db.get(`SELECT id FROM stores WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Store not found" });

      await db.run(`DELETE FROM stores WHERE id = ?`, [id]);
      res.json({ success: 1 });
    } catch (err) {
      console.error("Delete store failed:", err);
      res.status(500).json({ error: "Failed to delete store" });
    }
  });
}