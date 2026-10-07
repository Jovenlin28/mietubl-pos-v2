import express from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = express.Router();

// Normalize STORAGE_ENDPOINT so it is the region endpoint only
const rawEndpoint = (process.env.STORAGE_ENDPOINT || "").trim();
let endpoint: string | undefined = undefined;
if (rawEndpoint) {
  // If user accidentally put the space name into endpoint (e.g. https://myspace.sgp1.digitaloceanspaces.com)
  // extract the region host part "sgp1.digitaloceanspaces.com"
  const m = rawEndpoint.match(/^https?:\/\/(?:[^.]+\.)?(.+\.digitaloceanspaces\.com)$/i);
  if (m && m[1]) {
    endpoint = `https://${m[1]}`;
  } else {
    endpoint = rawEndpoint; // fallback to whatever they provided
  }
}

// Use virtual-hosted style signing (forcePathStyle: false) so presigned URL host will be bucket.region.digitaloceanspaces.com
const s3 = new S3Client({
  region: process.env.STORAGE_REGION || "sgp1",
  endpoint: endpoint || undefined,
  credentials: {
    accessKeyId: process.env.STORAGE_KEY || "",
    secretAccessKey: process.env.STORAGE_SECRET || "",
  },
  forcePathStyle: false, // <-- important: virtual-hosted style to match returned URL
});

router.get("/api/upload/presign", async (req, res) => {
  try {
    const filename = req.query.filename as string;
    const contentType = (req.query.contentType as string) || undefined;
    if (!filename) return res.status(400).json({ error: "filename required" });

    const params: any = {
      Bucket: process.env.STORAGE_BUCKET,
      Key: filename,
      // make uploaded object public (signed into the URL)
      ACL: "public-read",
    };
    if (contentType) params.ContentType = contentType;

    const cmd = new PutObjectCommand(params);

    // returns presigned URL that expects the browser PUT to include x-amz-acl (or signed via params)
    const expiresIn = Number(process.env.PRESIGN_EXPIRES) || 300;
    const url = await getSignedUrl(s3, cmd, { expiresIn });

    const expiresAt = Date.now() + expiresIn * 1000;
    console.log("presign generated:", params.Bucket, params.Key, "expiresIn:", expiresIn, "expiresAt:", new Date(expiresAt).toISOString());

    res.json({ url, method: "PUT", bucket: params.Bucket, key: params.Key, expiresAt });
  } catch (err) {
    console.error("presign error", err);
    res.status(500).json({ error: "failed to create presign" });
  }
});

export default router;