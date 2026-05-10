# Future Considerations

This document tracks long-term architectural shifts, performance optimizations, and feature ideas that are currently out of scope but worth revisiting as the project scales or requirements evolve.

---

## Sockudo (Pusher Protocol) for High-Scale Real-time Transport

**Category**: Infrastructure / Performance
**Status**: Deferred / Under Consideration
**Related Decisions**: [D1 — Socket.IO over Ably](decisions.md#d1--socketio-over-ably-and-raw-websocket)

### Context
[Sockudo](https://github.com/sockudo/sockudo) is a high-performance, Rust-based WebSocket server compatible with the Pusher protocol. It offers significant advantages over Socket.io for massive scaling and bandwidth optimization.

### Why consider it?
- **Performance**: Rust-based, capable of handling 100k+ concurrent connections on a single node with very low memory overhead.
- **Delta Compression**: Saves 60–90% bandwidth by only sending "diffs" between messages—extremely beneficial for live leaderboards and fast-paced game updates.
- **Offloading**: Moves the WebSocket overhead (connection management, heartbeat, fan-out) out of the Node.js event loop to a dedicated high-performance process.
- **Protocol Compatibility**: Uses the Pusher protocol, which is a mature industry standard with excellent client libraries.

### Impact / Refactoring Required
- **Pub/Sub vs. RPC**: Sockudo is primarily Pub/Sub. We would need to move current "Request-Response" socket events (like `create_game`, `join_game`) to standard **HTTP REST routes** in Fastify.
- **Authentication**: Requires a `/pusher/auth` endpoint for private/presence channel authorization.
- **Connection Lifecycle**: Instead of `io.on('disconnect')`, we would use **Webhooks** from Sockudo to notify the backend of joins/leaves.
- **Frontend**: Replace `socket.io-client` with `pusher-js` or `laravel-echo`.

### Trigger to Revisit
- Sustained traffic exceeding the capacity of a single Socket.io instance (approx. 5k+ concurrent users).
- Significant bandwidth costs related to real-time updates.
- Need for advanced multi-region distribution where Sockudo's NATS/Redis integration shines.

---

## Centrifugo for Robust, Feature-Rich Real-time Infrastructure

**Category**: Infrastructure / Reliability
**Status**: Deferred / Under Consideration
**Related Decisions**: [D1 — Socket.IO over Ably](decisions.md#d1--socketio-over-ably-and-raw-websocket)

### Context
[Centrifugo](https://github.com/centrifugal/centrifugo) is a standalone real-time messaging server written in Go. It acts as a language-agnostic "sidecar" that handles persistent connections, allowing the backend to focus on business logic.

### Why consider it?
- **Feature Set**: Out-of-the-box support for channel history (recovery), presence (who's online), and namespaces.
- **Protocol Flexibility**: Supports WebSockets, SSE, GRPC, and WebTransport.
- **Reliability**: Highly mature and battle-tested (in production at companies like Badoo and VK).
- **Decoupling**: Connections are authenticated via JWT; the backend interacts with Centrifugo via a REST or gRPC API, making it easy to swap or upgrade backend services without dropping client connections.
- **Scalability**: Scales horizontally using Redis or NATS.

### Impact / Refactoring Required
- **Backend Role Change**: The Node.js app would stop handling WebSocket connections directly. It would instead sign JWTs for clients and push events to Centrifugo via its API.
- **Client Migration**: Replace `socket.io-client` with the `centrifuge-js` SDK.
- **Infrastructure**: Requires deploying and managing a separate Centrifugo instance (Go binary).

### Trigger to Revisit
- Need for **message history/recovery** (e.g., if a player reconnects and needs to see missed chat or game events).
- Moving to a **polyglot microservices** architecture where multiple backends (Go, Python, Node) need to push events to the same clients.
- Requirement for **millions of concurrent connections** where a standalone Go server provides better resource efficiency than Node.js.
