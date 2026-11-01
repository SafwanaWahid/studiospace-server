import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { MongoMemoryReplSet } from "mongodb-memory-server";
const run =
  process.env.RUN_INTEGRATION === "1" ||
  process.env.npm_lifecycle_event === "test:integration";
test(
  "authentication, ownership, cookie JWT, booking collisions, status transitions and CRUD",
  { skip: !run, timeout: 180000 },
  async () => {
    const mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [{ args: ["--nounixsocket"] }],
      binary: { version: "8.0.17" },
    });
    const port = 5100;
    const origin = "http://localhost:3000";
    let log = "";
    const server = spawn(process.execPath, ["index.js"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        MONGODB_URI: mongo.getUri(),
        DB_NAME: "test",
        CLIENT_URL: origin,
        PORT: String(port),
        BETTER_AUTH_SECRET: "test-better-auth-secret-12345678901234567890",
        JWT_SECRET: "test-jwt-secret-12345678901234567890",
        NODE_ENV: "test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => {
      log += chunk;
    });
    server.stderr.on("data", (chunk) => {
      log += chunk;
    });
    try {
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(`http://localhost:${port}/api/health`)).ok) {
            ready = true;
            break;
          }
        } catch {}
        if (server.exitCode !== null) break;
        await delay(150);
      }
      assert.ok(ready, log);
      function agent() {
        const cookies = new Map();
        return async (path, method = "GET", body) => {
          const response = await fetch(`http://localhost:${port}/api${path}`, {
            method,
            headers: {
              origin,
              "content-type": "application/json",
              cookie: [...cookies]
                .map(([key, val]) => `${key}=${val}`)
                .join("; "),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          for (const cookie of response.headers.getSetCookie()) {
            const pair = cookie.split(";")[0];
            const index = pair.indexOf("=");
            cookies.set(pair.slice(0, index), pair.slice(index + 1));
          }
          const data = await response.json();
          return {
            status: response.status,
            data,
            cookies: response.headers.getSetCookie(),
          };
        };
      }
      const host = agent();
      const guest = agent();
      const anon = agent();
      assert.equal((await anon("/studios", "POST", {})).status, 401);
      assert.equal(
        (
          await host("/auth/sign-up/email", "POST", {
            name: "Host",
            email: "host@test.com",
            password: "abcdef",
          })
        ).status,
        400,
      );
      for (const [request, name, email] of [
        [host, "Host", "host@test.com"],
        [guest, "Guest", "guest@test.com"],
      ]) {
        const signup = await request("/auth/sign-up/email", "POST", {
          name,
          email,
          password: "Abcdef12",
        });
        assert.equal(signup.status, 200, JSON.stringify(signup.data));
        assert.equal((await request("/auth/get-session")).data, null);
        const login = await request("/auth/sign-in/email", "POST", {
          email,
          password: "Abcdef12",
        });
        assert.equal(login.status, 200, JSON.stringify(login.data));
        assert.ok((await request("/auth/get-session")).data.user);
        assert.equal((await request("/studios", "POST", {})).status, 401);
        const token = await request("/access", "POST");
        assert.equal(token.status, 200);
        assert.ok(
          token.cookies.some(
            (cookie) =>
              cookie.includes("HttpOnly") && cookie.includes("studio_access="),
          ),
        );
      }
      const created = await host("/studios", "POST", {
        title: "Test Studio",
        ownerEmail: "guest@test.com",
        category: "Photo Studio",
        hourlyRate: 50,
        deposit: 100,
        capacity: 8,
        location: "Dhaka",
        overview:
          "A bright creative studio with everything you need for a productive session.",
        images: ["https://example.com/photo.jpg"],
        amenities: ["Wi-Fi"],
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      const id = created.data._id;
      assert.equal(created.data.ownerEmail, "host@test.com");
      const disposable = await host("/studios", "POST", {
        ...created.data,
        title: "Disposable studio",
      });
      assert.equal(disposable.status, 201);
      assert.equal(
        (await host(`/studios/${disposable.data._id}`, "DELETE")).status,
        200,
      );
      assert.equal((await host(`/studios/${disposable.data._id}`)).status, 404);
      assert.equal((await guest(`/studios/${id}`, "DELETE")).status, 404);
      assert.equal(
        (
          await guest(`/studios/${id}`, "PATCH", {
            ...created.data,
            hourlyRate: 1,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await host(`/studios/${id}`, "PATCH", {
            ...created.data,
            hourlyRate: 60,
          })
        ).status,
        200,
      );
      const tomorrow = new Date(Date.now() + 86400000);
      const end = new Date(+tomorrow + 7200000);
      const payload = {
        studioId: id,
        start: tomorrow.toISOString(),
        end: end.toISOString(),
      };
      const first = await guest("/bookings", "POST", payload);
      assert.equal(first.status, 201, JSON.stringify(first.data));
      assert.equal(first.data.total, 220);
      const second = await guest("/bookings", "POST", payload);
      assert.equal(second.status, 201);
      const confirmations = await Promise.all(
        [first, second].map((booking) =>
          host(`/bookings/${booking.data._id}`, "PATCH", {
            status: "Confirmed",
          }),
        ),
      );
      assert.deepEqual(
        confirmations.map((result) => result.status).sort(),
        [200, 409],
      );
      assert.equal((await guest("/bookings", "POST", payload)).status, 409);
      const confirmedIndex = confirmations.findIndex(
        (result) => result.status === 200,
      );
      const confirmedId = [first, second][confirmedIndex].data._id;
      assert.equal(
        (
          await guest(`/bookings/${confirmedId}`, "PATCH", {
            status: "Cancelled",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await host(`/bookings/${confirmedId}`, "PATCH", {
            status: "Completed",
          })
        ).status,
        409,
      );
      const adjacent = await guest("/bookings", "POST", {
        studioId: id,
        start: end.toISOString(),
        end: new Date(+end + 3600000).toISOString(),
      });
      assert.equal(adjacent.status, 201);
      assert.equal(
        (
          await guest(`/bookings/${adjacent.data._id}`, "PATCH", {
            status: "Confirmed",
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await guest(`/bookings/${adjacent.data._id}`, "PATCH", {
            status: "Cancelled",
          })
        ).status,
        200,
      );
      assert.equal((await host(`/studios/${id}`, "DELETE")).status, 409);
      const session = await host("/auth/sign-out", "POST", {});
      assert.equal(session.status, 200);
      assert.equal((await host("/studios", "POST", created.data)).status, 401);
    } finally {
      server.kill("SIGTERM");
      await mongo.stop();
    }
  },
);
