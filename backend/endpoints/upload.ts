import express from "express";
import multer from "multer";
import path from "path";

export default function registerUpload(app: express.Express, db: any, ) {
  // File upload setup
  const uploadDir = path.join(__dirname, "../public/uploads");
  const storage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: (err: null, dest: string) => void) => {
      cb(null, uploadDir);
    },
    filename: (_req: any, file: { originalname: string }, cb: (err: null, name: string) => void) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });
  const upload = multer({ storage });

  // API: Upload file
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      // optional small delay to mimic other endpoints
      

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filename = req.file.filename;
      // return both filename and full url (static served at /uploads)
      const url = `/uploads/${filename}`;
      res.json({ filename, url });
    } catch (err) {
      res.status(500).json({ error: "File upload failed" });
    }
  });
}