const mongoose = require("mongoose");
const NodeCache = require("node-cache");
const { EventEmitter } = require("events");

class TenantConnectionManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      mongoHosts: config.mongoHosts || ["localhost:27017"],
      maxPoolSize: config.maxPoolSize || 10,
      minPoolSize: config.minPoolSize || 2,
      connectionIdleTimeout: config.connectionIdleTimeout || 300000, // 5 minutes
      cacheTTL: config.cacheTTL || 60, // 1 minute
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
      ...config,
    };

    this.connectionPools = new Map();
    this.cache = new NodeCache({
      stdTTL: this.config.cacheTTL,
      checkperiod: this.config.cacheTTL * 0.2,
    });
    this.availableHosts = [...this.config.mongoHosts];
    this.initializeMonitoring();
  }

  async getConnection(tenantId) {
    const poolKey = `tenant_${tenantId}`;
    let pool = this.connectionPools.get(poolKey);

    if (!pool) {
      pool = await this.createConnectionPool(poolKey);
      this.connectionPools.set(poolKey, pool);
    }

    return pool.acquire();
  }

  async createConnectionPool(poolKey) {
    const pool = {
      connections: [],
      acquire: async () => {
        let conn = pool.connections.find(
          (c) => c.readyState === 1 && !c.isAcquired
        );
        if (!conn) {
          conn = await this.createNewConnection(poolKey);
          pool.connections.push(conn);
        }
        conn.isAcquired = true;
        conn.lastUsed = Date.now();
        return conn;
      },
      release: (conn) => {
        conn.isAcquired = false;
        conn.lastUsed = Date.now();
      },
      cleanup: async () => {
        const now = Date.now();
        const idleConnections = pool.connections.filter(
          (c) =>
            !c.isAcquired &&
            now - c.lastUsed > this.config.connectionIdleTimeout
        );
        for (const conn of idleConnections) {
          await conn.close();
          pool.connections = pool.connections.filter((c) => c !== conn);
        }
        if (pool.connections.length < this.config.minPoolSize) {
          const newConns = await Promise.all(
            Array(this.config.minPoolSize - pool.connections.length)
              .fill()
              .map(() => this.createNewConnection(poolKey))
          );
          pool.connections.push(...newConns);
        }
      },
    };

    // Initialize pool with minimum connections
    const initialConnections = await Promise.all(
      Array(this.config.minPoolSize)
        .fill()
        .map(() => this.createNewConnection(poolKey))
    );
    pool.connections.push(...initialConnections);

    return pool;
  }

  async createNewConnection(poolKey) {
    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const uri = `mongodb://${this.getNextMongoHost()}/${poolKey}`;
        const conn = await mongoose.createConnection(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });

        conn.on("error", (error) => {
          console.error(`Connection error for ${poolKey}:`, error);
          this.emit("connectionError", { poolKey, error });
        });

        return conn;
      } catch (error) {
        console.error(`Attempt ${attempt + 1} failed for ${poolKey}:`, error);
        if (attempt === this.config.retryAttempts - 1) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay)
        );
      }
    }
  }

  getNextMongoHost() {
    if (this.availableHosts.length === 0) {
      this.availableHosts = [...this.config.mongoHosts];
    }
    return this.availableHosts.shift();
  }

  async closeConnection(conn) {
    await conn.close();
  }

  getFromCache(key) {
    return this.cache.get(key);
  }

  setInCache(key, value) {
    this.cache.set(key, value);
  }

  initializeMonitoring() {
    setInterval(() => this.performHealthCheck(), 60000); // Every minute
    setInterval(() => this.cleanupIdleConnections(), 300000); // Every 5 minutes
  }

  async performHealthCheck() {
    for (const [poolKey, pool] of this.connectionPools.entries()) {
      const activeConnections = pool.connections.filter(
        (c) => c.readyState === 1
      ).length;
      this.emit("healthCheck", {
        poolKey,
        activeConnections,
        totalConnections: pool.connections.length,
      });
    }
  }

  async cleanupIdleConnections() {
    for (const pool of this.connectionPools.values()) {
      await pool.cleanup();
    }
  }

  async switchToTenantDatabase(tenantId) {
    const cacheKey = `tenant_db_${tenantId}`;
    let dbInfo = this.getFromCache(cacheKey);

    if (!dbInfo) {
      try {
        const connection = await this.getConnection(tenantId);
        dbInfo = { dbName: connection.name, host: connection.host };
        this.setInCache(cacheKey, dbInfo);
        this.connectionPools.get(`tenant_${tenantId}`).release(connection);
      } catch (error) {
        console.error(
          `Failed to switch to database for tenant ${tenantId}:`,
          error
        );
        throw new Error(`Unable to connect to database for tenant ${tenantId}`);
      }
    }

    console.log(`Switched to database ${dbInfo.dbName} for tenant ${tenantId}`);
    return dbInfo;
  }
}

// Usage
const connectionManager = new TenantConnectionManager({
  mongoHosts: ["localhost:27017"], // Only include available hosts
  maxPoolSize: 20,
  minPoolSize: 5,
  connectionIdleTimeout: 600000, // 10 minutes
  cacheTTL: 300, // 5 minutes
  retryAttempts: 3,
  retryDelay: 1000,
});

connectionManager.on("connectionError", ({ poolKey, error }) => {
  console.error(`Error in connection pool ${poolKey}:`, error);
});

connectionManager.on(
  "healthCheck",
  ({ poolKey, activeConnections, totalConnections }) => {
    console.log(
      `Health check for ${poolKey}: ${activeConnections}/${totalConnections} active connections`
    );
  }
);

module.exports = {
  switchToTenantDatabase:
    connectionManager.switchToTenantDatabase.bind(connectionManager),
  connectionManager,
};
