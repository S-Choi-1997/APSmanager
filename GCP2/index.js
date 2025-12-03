const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp({
  storageBucket: process.env.STORAGE_BUCKET || "aps-list",
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();

// CORS configuration
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint (no auth required)
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "aps-inquiry-api" });
});

// Authentication middleware - verifies OAuth access token based on provider
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const provider = req.headers['x-provider'] || 'google'; // Default to google for backward compatibility

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized", message: "Missing or invalid authorization header" });
    }

    const accessToken = authHeader.split("Bearer ")[1];

    let userEmail = null;
    let userName = null;
    let userSub = null;

    // Verify token based on provider
    if (provider === 'google') {
      // Verify Google OAuth access token using Google's tokeninfo endpoint
      const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);

      if (!response.ok) {
        console.error("Google token verification failed:", response.status);
        return res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
      }

      const tokenInfo = await response.json();

      // Check if token has email scope
      if (!tokenInfo.email) {
        console.error("Token does not contain email");
        return res.status(401).json({ error: "unauthorized", message: "Token missing required email scope" });
      }

      // Check if email is verified
      if (tokenInfo.email_verified !== "true" && tokenInfo.email_verified !== true) {
        console.warn("Email not verified:", tokenInfo.email);
        return res.status(403).json({ error: "forbidden", message: "Email not verified" });
      }

      userEmail = tokenInfo.email;
      userName = tokenInfo.name;
      userSub = tokenInfo.sub;
    } else if (provider === 'naver') {
      // Verify Naver OAuth access token using Naver's user info endpoint
      const response = await fetch('https://openapi.naver.com/v1/nid/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error("Naver token verification failed:", response.status);
        return res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
      }

      const data = await response.json();

      if (data.resultcode !== '00') {
        console.error("Naver API error:", data.message);
        return res.status(401).json({ error: "unauthorized", message: "Naver token validation failed" });
      }

      const profile = data.response;

      if (!profile.email) {
        console.error("Naver profile does not contain email");
        return res.status(401).json({ error: "unauthorized", message: "Token missing required email scope" });
      }

      userEmail = profile.email;
      userName = profile.name;
      userSub = profile.id;
    } else {
      console.error("Unsupported provider:", provider);
      return res.status(400).json({ error: "bad_request", message: "Unsupported authentication provider" });
    }

    // Check if email is in the whitelist
    const allowedEmails = (process.env.ALLOWED_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

    if (allowedEmails.length === 0) {
      console.error("ALLOWED_EMAILS environment variable is not set");
      return res.status(500).json({ error: "server_config_error", message: "Server configuration error" });
    }

    if (!allowedEmails.includes(userEmail)) {
      console.warn(`Access denied for unauthorized email: ${userEmail} (provider: ${provider})`);
      return res.status(403).json({ error: "forbidden", message: "Access denied - unauthorized email" });
    }

    req.user = {
      email: userEmail,
      sub: userSub,
      name: userName,
      provider: provider,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ error: "unauthorized", message: "Invalid token" });
  }
};

// Apply authentication to all /inquiries routes
app.use("/inquiries", authenticate);

// GET /inquiries - List all inquiries with optional filtering
app.get("/inquiries", async (req, res) => {
  try {
    const { check, status, category, limit = "100", offset = "0" } = req.query;

    let query = db.collection("inquiries");

    // Apply filters
    if (check !== undefined) {
      query = query.where("check", "==", check === "true");
    }

    if (status) {
      query = query.where("status", "==", status);
    }

    if (category) {
      query = query.where("category", "==", category);
    }

    // Order by creation date (newest first)
    query = query.orderBy("createdAt", "desc");

    // Apply pagination
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    if (offsetNum > 0) {
      const offsetSnapshot = await query.limit(offsetNum).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limitNum);

    const snapshot = await query.get();

    const inquiries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Timestamp to ISO string
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
    }));

    res.json({
      status: "ok",
      data: inquiries,
      count: inquiries.length,
    });
  } catch (error) {
    console.error("Error fetching inquiries:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// GET /inquiries/:id - Get single inquiry by ID
app.get("/inquiries/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("inquiries").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "not_found", message: "Inquiry not found" });
    }

    const data = doc.data();

    res.json({
      status: "ok",
      data: {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching inquiry:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// PATCH /inquiries/:id - Update inquiry (check status, notes, etc.)
app.patch("/inquiries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Only allow specific fields to be updated
    const allowedFields = ["check", "status", "notes", "assignedTo"];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "bad_request", message: "No valid fields to update" });
    }

    // Add updated timestamp
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = req.user.sub || req.user.email; // Track who updated (Google user ID or email)

    const docRef = db.collection("inquiries").doc(id);

    // Check if document exists
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "not_found", message: "Inquiry not found" });
    }

    await docRef.update(updates);

    res.json({
      status: "ok",
      message: "Inquiry updated successfully",
      updated: updates,
    });
  } catch (error) {
    console.error("Error updating inquiry:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// GET /inquiries/:id/attachments/urls - Get signed download URLs for all attachments
app.get("/inquiries/:id/attachments/urls", async (req, res) => {
  try {
    const { id } = req.params;

    // Get inquiry document
    const doc = await db.collection("inquiries").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "not_found", message: "Inquiry not found" });
    }

    const data = doc.data();
    const attachments = data.attachments || [];

    if (attachments.length === 0) {
      return res.json({
        status: "ok",
        data: [],
      });
    }

    // Generate signed URLs for all attachments
    const urlPromises = attachments.map(async (attachment) => {
      try {
        // Use path or filename from attachment
        const filePath = attachment.path || attachment.filename;

        if (!filePath) {
          return {
            ...attachment,
            downloadUrl: null,
            error: "No file path",
          };
        }

        const file = bucket.file(filePath);

        // Check if file exists
        const [exists] = await file.exists();

        if (!exists) {
          return {
            ...attachment,
            downloadUrl: null,
            error: "File not found in storage",
          };
        }

        // Generate signed URL (valid for 1 hour)
        const [url] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        return {
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          downloadUrl: url,
        };
      } catch (error) {
        console.error(`Error generating URL for ${attachment.name}:`, error);
        return {
          ...attachment,
          downloadUrl: null,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(urlPromises);

    res.json({
      status: "ok",
      data: results,
    });
  } catch (error) {
    console.error("Error generating download URLs:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// DELETE /inquiries/:id - Delete inquiry (optional - use with caution)
app.delete("/inquiries/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const docRef = db.collection("inquiries").doc(id);

    // Check if document exists
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "not_found", message: "Inquiry not found" });
    }

    const data = doc.data();
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];

    // Delete attachments from Cloud Storage (best-effort; continue on individual errors)
    const attachmentResults = [];
    for (const attachment of attachments) {
      const filePath = attachment.path || attachment.filename;
      if (!filePath) {
        attachmentResults.push({
          name: attachment.name,
          path: null,
          status: "skipped",
          reason: "No file path on attachment",
        });
        continue;
      }

      try {
        await bucket.file(filePath).delete({ ignoreNotFound: true });
        attachmentResults.push({
          name: attachment.name || filePath,
          path: filePath,
          status: "deleted",
        });
      } catch (err) {
        console.error(`Error deleting attachment ${filePath}:`, err);
        attachmentResults.push({
          name: attachment.name || filePath,
          path: filePath,
          status: "error",
          error: err.message,
        });
      }
    }

    await docRef.delete();

    res.json({
      status: "ok",
      message: "Inquiry and attachments deleted",
      attachments: attachmentResults,
    });
  } catch (error) {
    console.error("Error deleting inquiry:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// Export the Express app for Cloud Functions
exports.api = app;
