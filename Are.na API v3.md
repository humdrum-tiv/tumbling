---
date created: 2026-03-12
date modified: 2026-03-12
---
# Are.na

Are.na is a platform for connecting ideas and building knowledge. Users collect content — images, text, links, files — into channels, building personal and collaborative knowledge networks.

- Website: https://www.are.na

## Are.na API — Full Reference

Version: 3.0.0
This document covers the Are.na developer API. It does not describe the full website.

Developer resources:
- API docs: https://www.are.na/developers/explore
- OpenAPI spec: https://api.are.na/v3/openapi.json
- Full reference (markdown): https://www.are.na/developers/all.md
- Compact reference (markdown): https://www.are.na/developers/all-compact.md
- LLM index: https://www.are.na/llms.txt
- Sitemap: https://www.are.na/developers/sitemap.xml

## API Overview
The Are.na REST API provides programmatic access to the Are.na platform - a tool for connecting ideas and building knowledge together.

## Getting Started

All API requests use `https://api.are.na` as the base URL. Responses are JSON with consistent structure including hypermedia links for resource discovery.

## Authentication

Most endpoints work without authentication but provide additional access when authenticated. Use the standard `Authorization` header:

```
Authorization: Bearer YOUR_TOKEN
```

**Supported Token Types:**
- **OAuth2 Access Token**: Obtained via [OAuth2 flow](https://www.are.na/developers/explore/authentication) (supports PKCE)
- **Personal Access Token**: From [are.na/settings/oauth](https://www.are.na/settings/personal-access-tokens)

For OAuth2, note that the authorization endpoint is hosted on the main site (`www.are.na/oauth/authorize`),
while the token endpoint is on the API (`api.are.na/v3/oauth/token`).

**Authentication Levels:**
- **Public**: No authentication needed (e.g., `/v3/ping`)
- **Optional**: Works unauthenticated but respects permissions when authenticated
- **Required**: Returns `401 Unauthorized` without valid token (e.g., `/v3/me`)

## Scopes

OAuth2 tokens and personal access tokens support the following scopes:

| Scope | Description |
|-------|-------------|
| `read` | Read-only access (default) — write operations will return `403 Forbidden` |
| `write` | Full read and write access |

Tokens default to `read` scope. Request `write` scope when creating a token or authorizing an OAuth2 application to enable write access. Read-only tokens can view all resources the user has access to but cannot create, update, or delete anything.

## Rate Limiting

**Acceptable Use**: This API is intended for building applications that integrate with Are.na, not for scraping or bulk data collection. Automated crawling, systematic downloading of content, or any form of structured data harvesting is prohibited. If you need bulk access to data for research or other purposes, please [contact us](mailto:help@are.na) to discuss your use case.

Rate limits are enforced per-minute based on your tier:

| Tier | Requests/Minute |
|------|-----------------|
| Guest (unauthenticated) | 30 |
| Free | 120 |
| Premium | 300 |
| Supporter/Lifetime | 600 |

**Rate Limit Headers** (included in every response):
- `X-RateLimit-Limit`: Your tier’s per-minute limit
- `X-RateLimit-Tier`: Current tier (guest/free/premium/supporter)
- `X-RateLimit-Window`: Time window in seconds (always 60)
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

When you exceed limits, you’ll receive a `429 Too Many Requests` response with upgrade recommendations and retry timing.

## Request Validation

All parameters are validated against this OpenAPI specification. Invalid requests return `400 Bad Request` with detailed error messages.

## Error Responses

Errors use standard HTTP status codes with JSON bodies:

```json
{
  "error": "Not Found",
  "code": 404,
  "details": {
    "message": "The resource you requested does not exist"
  }
}
```

Common status codes:
- `400`: Invalid request parameters
- `401`: Authentication required or invalid
- `403`: Insufficient permissions
- `404`: Resource not found
- `429`: Rate limit exceeded

## Pagination

List endpoints return paginated results. Use these query parameters:
- `page`: Page number (default: 1)
- `per`: Items per page (default: 24, max: 100)

Responses include a `meta` object with pagination info:

```json
{
  "data": [...],
  "meta": {
    "current_page": 1,
    "per_page": 25,
    "total_pages": 5,
    "total_count": 120,
    "next_page": 2,
    "prev_page": null,
    "has_more_pages": true
  }
}
```

## Best Practices

Are.na channels and users can contain thousands of items. The following guidelines will help you build responsive, well-behaved integrations.

### Paginate, Don’t Enumerate

Never try to load an entire channel or user’s content in one pass. Use `page` and `per` parameters to fetch only the data you need right now. Check `meta.has_more_pages` and load subsequent pages on demand rather than in a loop.

**Do:**
- Fetch the first page and display it immediately
- Load more pages as the user scrolls or explicitly requests them

**Don’t:**
- Loop through all pages at startup to “build a complete picture”
- Set `per=100` and iterate until `has_more_pages` is `false`

### Use HTTP Caching

All responses include `Cache-Control` and `ETag` headers. Unauthenticated responses are `max-age=300, public` — your client can reuse them for 5 minutes without any network request. Authenticated responses are `private, no-cache` — your client may store them but must revalidate before each reuse.

To revalidate, send the `ETag` value from a previous response as `If-None-Match`:

```
GET /v3/channels/123
If-None-Match: "abc123"
```

If the resource hasn’t changed, the API returns `304 Not Modified` with no body, saving bandwidth. Single-resource endpoints (e.g., `/v3/channels/:id`, `/v3/blocks/:id`) also skip server-side work entirely on a match. Note that 304 responses still count against your rate limit.

### Fetch Summaries Before Details

Start with lightweight list endpoints (e.g., a channel’s first page of contents) before drilling into individual blocks or nested resources. Avoid eagerly resolving every connection or nested object — fetch details only when a user explicitly needs them.

### Respect Rate Limits Gracefully

Monitor the `X-RateLimit-Limit` and `X-RateLimit-Reset` headers. If you receive a `429` response, wait until the reset window before retrying — don’t retry in a tight loop. Consider adding exponential backoff and a short delay between sequential requests (e.g., 200–500ms) when making multiple calls.

### Design for Partial Data

Channels can have tens of thousands of connections. Your application should function well with just the first page of results, not require the full dataset upfront. Display what you have and offer the user a way to load more.

### Build Statically When Possible

If you’re building a website that displays Are.na content, prefer static site generation (fetching data at build time) over live API requests on every page view. This eliminates rate limit concerns for your visitors and makes your site faster and more resilient. If you need fresher data, cache responses server-side with a reasonable TTL rather than proxying every request through to the API.

### Avoid Write-Heavy Loops

If you’re creating or connecting multiple blocks, batch your logic and add delays between write operations. Rapid-fire mutations can hit rate limits quickly and may trigger abuse detection.

## Authentication
Docs page: https://www.are.na/developers/explore/authentication

### POST /v3/oauth/token

- Label: Obtain access token
- Docs: https://www.are.na/developers/explore/authentication/post-token
- Markdown: https://www.are.na/developers/explore/authentication/post-token.md
- Requires resource id: no
- Response content type: application/json

Exchange credentials for an access token. This is the OAuth 2.0 token endpoint.

**Supported Grant Types:**

- `authorization_code`: Exchange an authorization code for an access token
- `authorization_code` + PKCE: For public clients without a client secret
- `client_credentials`: Authenticate as your application (server-to-server)

**PKCE Support:** For public clients (mobile apps, SPAs), use PKCE:
1. Generate a random `code_verifier` (43-128 chars, alphanumeric + `-._~`)
2. Create `code_challenge` = Base64URL(SHA256(code_verifier))
3. In the authorization request to `https://www.are.na/oauth/authorize`, include:
   - `code_challenge`: The generated challenge
   - `code_challenge_method`: `S256`
4. When exchanging the code at this endpoint, include `code_verifier`

See [RFC 7636](https://tools.ietf.org/html/rfc7636) for details.

Access tokens do not expire and can be used indefinitely. Register your application
at [are.na/oauth/applications](https://www.are.na/oauth/applications) to obtain client credentials.

## Block
Docs page: https://www.are.na/developers/explore/block

### GET /v3/blocks/{id}

- Label: Get a block
- Docs: https://www.are.na/developers/explore/block
- Markdown: https://www.are.na/developers/explore/block.md
- Requires resource id: yes
- Response content type: application/json

Returns detailed information about a specific block by its ID. Respects visibility rules and user permissions.

### GET /v3/blocks/batch/{batch_id}

- Label: Get batch status
- Docs: https://www.are.na/developers/explore/block/{batch_id}
- Markdown: https://www.are.na/developers/explore/block/{batch_id}.md
- Requires resource id: no
- Response content type: application/json

Returns the current status of a batch block creation job.
Poll this endpoint to track progress and retrieve results.

Batch results are available for 24 hours after submission.

**⚠️ Premium Only**: This endpoint requires a Premium subscription.

### GET /v3/blocks/{id}/comments

- Label: Get block comments
- Docs: https://www.are.na/developers/explore/block/comments
- Markdown: https://www.are.na/developers/explore/block/comments.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated list of comments on this block.
Comments are ordered by creation date (ascending by default, oldest first).

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_desc|created_at_asc — Sort by the date the relationship was created.

### GET /v3/blocks/{id}/connections

- Label: Get block connections
- Docs: https://www.are.na/developers/explore/block/connections
- Markdown: https://www.are.na/developers/explore/block/connections.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated list of channels where this block appears.
This shows all channels that contain this block, respecting visibility rules and user permissions.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_desc|created_at_asc — Sort by the date the relationship was created.
- filter: select (optional) options=ALL|OWN|EXCLUDE_OWN — Filter connections by ownership.

### POST /v3/blocks/batch

- Label: Batch create blocks
- Docs: https://www.are.na/developers/explore/block/post-batch
- Markdown: https://www.are.na/developers/explore/block/post-batch.md
- Requires resource id: no
- Response content type: application/json

Queues multiple blocks for asynchronous creation and connects them to one
or more channels. Returns immediately with a `batch_id` that can be used
to poll for status via `GET /v3/blocks/batch/{batch_id}`.

Designed for import use cases such as migrating from other services
or re-importing Are.na exports.

Each block in the `blocks` array follows the same format as single block
creation. Blocks are processed sequentially in the background and partial
success is supported — if some blocks fail, the successful ones are still
created.

**Limits:**
- Maximum 50 blocks per request
- Maximum 20 channels per request
- All channels must be **private**

**Batch results are available for 24 hours after submission.**

**⚠️ Premium Only**: This endpoint requires a Premium subscription.

### POST /v3/blocks

- Label: Create a block
- Docs: https://www.are.na/developers/explore/block/post-block
- Markdown: https://www.are.na/developers/explore/block/post-block.md
- Requires resource id: no
- Response content type: application/json

Creates a new block and connects it to one or more channels.

The `value` field accepts either a URL or text content:
- If `value` is a valid URL, the block type is inferred (Image, Link, Embed, etc.)
- If `value` is plain text, a Text block is created

You can connect the block to multiple channels at once (up to 20).

**Authentication required.**

### POST /v3/blocks/{id}/comments

- Label: Create a comment
- Docs: https://www.are.na/developers/explore/block/post-comments
- Markdown: https://www.are.na/developers/explore/block/post-comments.md
- Requires resource id: yes
- Response content type: application/json

Creates a new comment on a block.

**Authentication required.**

You can mention users in the comment body using `@username` syntax.

### PUT /v3/blocks/{id}

- Label: Update a block
- Docs: https://www.are.na/developers/explore/block/put-block
- Markdown: https://www.are.na/developers/explore/block/put-block.md
- Requires resource id: yes
- Response content type: application/json

Updates a block’s metadata. Only the block owner can update it.

**Authentication required.**

## Channel
Docs page: https://www.are.na/developers/explore/channel

### GET /v3/channels/{id}

- Label: Get a channel
- Docs: https://www.are.na/developers/explore/channel
- Markdown: https://www.are.na/developers/explore/channel.md
- Requires resource id: yes
- Response content type: application/json

Returns detailed information about a specific channel by its ID or slug. Respects visibility rules and user permissions.

### GET /v3/channels/{id}/connections

- Label: Get channel connections
- Docs: https://www.are.na/developers/explore/channel/connections
- Markdown: https://www.are.na/developers/explore/channel/connections.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated list of channels where this channel appears.
This shows all channels that contain this channel, respecting visibility rules and user permissions.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_desc|created_at_asc — Sort by the date the relationship was created.

### GET /v3/channels/{id}/contents

- Label: Get channel contents
- Docs: https://www.are.na/developers/explore/channel/contents
- Markdown: https://www.are.na/developers/explore/channel/contents.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated contents (blocks and channels) from a channel.
Respects visibility rules and user permissions.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=position_asc|position_desc|created_at_asc|created_at_desc|updated_at_asc|updated_at_desc — Sort channel contents. Use `position` for the owner’s manual
arrangement, or sort by date. Defaults to `position_desc`.

- user_id: number (optional) — Filter by user who added the content

### GET /v3/channels/{id}/followers

- Label: Get channel followers
- Docs: https://www.are.na/developers/explore/channel/followers
- Markdown: https://www.are.na/developers/explore/channel/followers.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated list of users who follow this channel.
All followers are users.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_desc|created_at_asc — Sort by the date the relationship was created.

### POST /v3/channels

- Label: Create a channel
- Docs: https://www.are.na/developers/explore/channel/post-channel
- Markdown: https://www.are.na/developers/explore/channel/post-channel.md
- Requires resource id: no
- Response content type: application/json

Creates a new channel owned by the authenticated user or a group they belong to.

**Authentication required.**

### PUT /v3/channels/{id}

- Label: Update a channel
- Docs: https://www.are.na/developers/explore/channel/put-channel
- Markdown: https://www.are.na/developers/explore/channel/put-channel.md
- Requires resource id: yes
- Response content type: application/json

Updates an existing channel. Only provided fields are updated.

**Authentication required.**

### DELETE /v3/channels/{id}

- Label: Delete a channel
- Docs: https://www.are.na/developers/explore/channel/delete-channel
- Markdown: https://www.are.na/developers/explore/channel/delete-channel.md
- Requires resource id: yes
- Response content type: application/json

Deletes a channel. This can not be undone.

**Authentication required.**

## Comment
Docs page: https://www.are.na/developers/explore/comment

### DELETE /v3/comments/{id}

- Label: Delete a comment
- Docs: https://www.are.na/developers/explore/comment/delete-comment
- Markdown: https://www.are.na/developers/explore/comment/delete-comment.md
- Requires resource id: yes
- Response content type: application/json

Deletes a comment. Only the comment author can delete their comments.

**Authentication required.**

## Connection
Docs page: https://www.are.na/developers/explore/connection

### GET /v3/connections/{id}

- Label: Get connection details
- Docs: https://www.are.na/developers/explore/connection
- Markdown: https://www.are.na/developers/explore/connection.md
- Requires resource id: yes
- Response content type: application/json

Returns detailed information about a connection,
including abilities (whether the current user can remove the connection).

The connection ID is included in the `connection` object when blocks/channels
are returned as part of channel contents.

### POST /v3/connections

- Label: Create a connection
- Docs: https://www.are.na/developers/explore/connection/post-connection
- Markdown: https://www.are.na/developers/explore/connection/post-connection.md
- Requires resource id: no
- Response content type: application/json

Connects a block or channel to one or more channels.
Returns the created connection(s).

**Authentication required.**

### POST /v3/connections/{id}/move

- Label: Move a connection
- Docs: https://www.are.na/developers/explore/connection/post-move
- Markdown: https://www.are.na/developers/explore/connection/post-move.md
- Requires resource id: yes
- Response content type: application/json

Moves a connection to a new position within its channel.
Requires sort permission on the channel.

**Authentication required.**

### DELETE /v3/connections/{id}

- Label: Delete a connection
- Docs: https://www.are.na/developers/explore/connection/delete-connection
- Markdown: https://www.are.na/developers/explore/connection/delete-connection.md
- Requires resource id: yes
- Response content type: application/json

Removes a block or channel from a channel by deleting the connection.
The block/channel itself is not deleted - it may still exist in other channels.

**Authentication required.**

## Group
Docs page: https://www.are.na/developers/explore/group

### GET /v3/groups/{id}

- Label: Get a group
- Docs: https://www.are.na/developers/explore/group
- Markdown: https://www.are.na/developers/explore/group.md
- Requires resource id: yes
- Response content type: application/json

Returns detailed information about a specific group by its slug. Includes group profile, bio, owner, and counts.

### GET /v3/groups/{id}/contents

- Label: Get group contents
- Docs: https://www.are.na/developers/explore/group/contents
- Markdown: https://www.are.na/developers/explore/group/contents.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated contents (blocks and channels) created by a group.
Uses the search API to find all content added by the specified group.
Respects visibility rules and user permissions.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_asc|created_at_desc|updated_at_asc|updated_at_desc — Sort by creation or last update time.
- type: select (optional) options=Text|Image|Link|Attachment|Embed|Channel|Block — Filter to a specific content type.

### GET /v3/groups/{id}/followers

- Label: Get group followers
- Docs: https://www.are.na/developers/explore/group/followers
- Markdown: https://www.are.na/developers/explore/group/followers.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated list of users who follow this group.
All followers are users.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_desc|created_at_asc — Sort by the date the relationship was created.

## Search
Docs page: https://www.are.na/developers/explore/search

### GET /v3/search

- Label: Search across Are.na
- Docs: https://www.are.na/developers/explore/search
- Markdown: https://www.are.na/developers/explore/search.md
- Requires resource id: no
- Response content type: application/json

Search across blocks, channels, users, and groups.

**⚠️ Premium Only**: This endpoint requires a Premium subscription.

**Examples:**
- Simple: `/v3/search?query=brutalism`
- Images only: `/v3/search?query=architecture&type=Image`
- My content: `/v3/search?query=*&scope=my`
- In a channel: `/v3/search?query=design&channel_id=12345`
- By a user: `/v3/search?query=*&user_id=456`
- PDFs sorted by date: `/v3/search?query=*&ext=pdf&sort=created_at_desc`

Parameters:
- query: string (optional) — The search query string. Supports full-text search across titles,
descriptions, and content. Use `*` as a wildcard to match everything
(useful when filtering by type, scope, or extension).

- type: select[] (optional) options=All|Text|Image|Link|Attachment|Embed|Channel|Block|User|Group — Filter results by content type. Accepts comma-separated values.
- Block subtypes: `Text`, `Image`, `Link`, `Attachment`, `Embed`
- Aggregate types: `Block` (all block types), `Channel`, `User`, `Group`
- `All` returns everything (default behavior)
- scope: select (optional) options=all|my|following — Limit search to a specific context.
- user_id: number (optional) — Limit search to a specific user’s content.
- group_id: number (optional) — Limit search to a specific group’s content.
- channel_id: number (optional) — Limit search to a specific channel’s content.
- ext: select[] (optional) options=aac|ai|aiff|avi|avif|bmp|csv|doc|docx|eps|epub|fla|gif|h264|heic|heif|ind|indd|jpeg|jpg|key|kml|kmz|latex|m4a|ma|mb|mid|midi|mov|mp3|mp4|mp4v|mpeg|mpg|mpg4|numbers|oga|ogg|ogv|otf|pages|pdf|pgp|png|ppt|pptx|psd|svg|swa|swf|tex|texi|texinfo|tfm|tif|tiff|torrent|ttc|ttf|txt|wav|webm|webp|wma|xls|xlsx|xlt — Filter results by file extension. Accepts comma-separated values.
Only applies to Attachment and Image block types. Common extensions
include: pdf, jpg, png, gif, mp4, mp3, doc, xls, etc.

- sort: select (optional) options=score_desc|created_at_desc|created_at_asc|updated_at_desc|updated_at_asc|name_asc|name_desc|connections_count_desc|random — Sort by relevance, date, name, or popularity. Defaults to `score_desc`.
Use `random` with `seed` for reproducible random ordering.

- after: string (optional) — Filter to only return results updated after this timestamp.
Useful for incremental syncing or finding recently modified content.
Format: ISO 8601 datetime string.

- seed: number (optional) — Random seed for reproducible random ordering. Only used when
`sort=random`. Providing the same seed will return results in
the same order, useful for pagination through random results.

- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)

## System
Docs page: https://www.are.na/developers/explore/system

### GET /v3/openapi

- Label: Get OpenAPI specification
- Docs: https://www.are.na/developers/explore/system/openapi
- Markdown: https://www.are.na/developers/explore/system/openapi.md
- Requires resource id: no
- Response content type: application/yaml

Returns the OpenAPI 3.0 specification for this API in YAML format. This endpoint provides the complete API contract for programmatic access and documentation generation.

### GET /v3/openapi.json

- Label: Get OpenAPI specification (JSON)
- Docs: https://www.are.na/developers/explore/system/openapi-json
- Markdown: https://www.are.na/developers/explore/system/openapi-json.md
- Requires resource id: no
- Response content type: application/json

Returns the OpenAPI 3.0 specification for this API in JSON format. This endpoint provides the complete API contract in JSON for tools that prefer JSON over YAML.

### GET /v3/ping

- Label: Ping endpoint
- Docs: https://www.are.na/developers/explore/system/ping
- Markdown: https://www.are.na/developers/explore/system/ping.md
- Requires resource id: no
- Response content type: application/json

Public utility endpoint for API health checks and connection testing.

## Upload
Docs page: https://www.are.na/developers/explore/upload

### POST /v3/uploads/presign

- Label: Get a presigned upload URL
- Docs: https://www.are.na/developers/explore/upload/post-presign
- Markdown: https://www.are.na/developers/explore/upload/post-presign.md
- Requires resource id: no
- Response content type: application/json

Returns presigned S3 PUT URLs for direct file upload. Use this to upload
files (images, attachments) without sending them through the API server.
Supports up to 50 files per request.

**Upload flow:**
1. Call this endpoint with an array of files (filename + content type)
2. PUT each file’s bytes to its returned `upload_url` with the matching `Content-Type` header
3. Create blocks via `POST /v3/blocks` with `value` set to the S3 URL:
   `https://s3.amazonaws.com/arena_images-temp/<key>`

Presigned URLs expire after 1 hour.

**Authentication required.**

## User
Docs page: https://www.are.na/developers/explore/user

### GET /v3/users/{id}

- Label: Get a user
- Docs: https://www.are.na/developers/explore/user
- Markdown: https://www.are.na/developers/explore/user.md
- Requires resource id: yes
- Response content type: application/json

Returns detailed information about a specific user by their slug. Includes user profile, bio, and counts.

### GET /v3/users/{id}/contents

- Label: Get user contents
- Docs: https://www.are.na/developers/explore/user/contents
- Markdown: https://www.are.na/developers/explore/user/contents.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated contents (blocks and channels) created by a user.
Uses the search API to find all content added by the specified user.
Respects visibility rules and user permissions.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_asc|created_at_desc|updated_at_asc|updated_at_desc — Sort by creation or last update time.
- type: select (optional) options=Text|Image|Link|Attachment|Embed|Channel|Block — Filter to a specific content type.

### GET /v3/users/{id}/followers

- Label: Get user followers
- Docs: https://www.are.na/developers/explore/user/followers
- Markdown: https://www.are.na/developers/explore/user/followers.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated list of users who follow this user.
All followers are users.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_desc|created_at_asc — Sort by the date the relationship was created.

### GET /v3/users/{id}/following

- Label: Get user following
- Docs: https://www.are.na/developers/explore/user/following
- Markdown: https://www.are.na/developers/explore/user/following.md
- Requires resource id: yes
- Response content type: application/json

Returns paginated list of users, channels, and groups that this user follows.
Can be filtered by type to return only specific followable types.

Parameters:
- page: number (optional) — Page number for pagination
- per: number (optional) — Number of items per page (max 100)
- sort: select (optional) options=created_at_desc|created_at_asc — Sort by the date the relationship was created.
- type: select (optional) options=User|Channel|Group — Filter by followable type

### GET /v3/me

- Label: Get current user
- Docs: https://www.are.na/developers/explore/user/me
- Markdown: https://www.are.na/developers/explore/user/me.md
- Requires resource id: no
- Response content type: application/json

Returns the currently authenticated user’s profile