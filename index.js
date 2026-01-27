require("dotenv").config(); // Load environment variables first
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const tenantRoutes = require("./routes/tenantRoutes");
const Document = require("./models/Document");
const userRoutes = require("./routes/userRoute");
const authRoutes = require("./routes/authRoutes");
const bulkRoutes = require("./routes/bulkRoutes");
const attachmentRoutes = require("./routes/attachementRoutes");
const logsRoutes = require("./routes/logsRoute");
const documentRoutes = require("./routes/documentRoutes");
const commentRoutes = require("./routes/commentRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const tenantMiddleware = require("./middleware/tenantMiddleware");
const updateContractStatus = require("./controllers/updateContractStatus");
const { startScheduler } = require("./tasks/backgroundTasks");
const filterByTenant = require("./middleware/filterTenant");
const geminiRoutes = require("./routes/geminiRoutes");
const annotationsRoutes = require("./routes/annotations");
const reportsRoutes = require("./routes/reportsRoutes");

// Create an Express app
const app = express();

connectDB("undefined");

// Define allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://192.168.1.150:3000",
  "http://192.168.1.150",
  "http://cms.coseke.cloud",
  "https://cms.coseke.cloud",
];

// CORS configuration for Express
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

const server = http.createServer(app);

// Socket.IO configuration
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(express.json());

// Routes
app.use("/api/tenants", tenantRoutes);
app.use("/api/auth", authRoutes);

// Apply middleware to routes
app.use(authMiddleware);
app.use(tenantMiddleware);
app.use(filterByTenant);

// Apply middleware to routes
app.use("/api/documents", documentRoutes);
app.use("/api", annotationsRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/gemini", geminiRoutes);
app.use("/api/bulk", bulkRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/users", userRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0"; // Listen on all available network interfaces

server.listen(PORT, HOST, () =>
  console.log(`Server running on http://${HOST}:${PORT}`),
);

// Socket.io logic
const defaultValue = "";

// Middleware to authorize document access
async function authorizeDocumentAccess(socket, documentId) {
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    socket.emit("error", "Invalid document ID");
    return false;
  }
  const document = await Document.findById(documentId);
  if (!document) {
    socket.emit("error", "Document not found");
    return false;
  }
  return true;
}

// Track connected sockets
const connectedSockets = new Map();

io.on("connection", (socket) => {
  console.log("New client connected");
  connectedSockets.set(socket.id, socket);

  socket.on("get-document", async (documentId) => {
    if (!(await authorizeDocumentAccess(socket, documentId))) return;

    const document = await findOrCreateDocument(documentId);
    socket.join(documentId);
    socket.emit("load-document", document.data);

    // Remove previous listeners if any
    socket.removeAllListeners("send-changes");
    socket.removeAllListeners("save-document");

    socket.on("send-changes", (delta) => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async (data) => {
      if (await authorizeDocumentAccess(socket, documentId)) {
        await Document.findByIdAndUpdate(documentId, { data });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    connectedSockets.delete(socket.id);
  });
});

async function findOrCreateDocument(id) {
  if (id == null) return;

  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue });
}

// Schedule contract status update task
updateContractStatus();

// Instantiate the CRON SCHEDULER
startScheduler();
