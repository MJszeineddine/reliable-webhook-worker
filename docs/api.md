# API

## `POST /webhooks/crm`

Receives a simulated CRM webhook.

Required headers:

- `content-type: application/json`
- `x-crm-signature: sha256=<hmac>`

Accepted event types:

- `contact.created`
- `contact.updated`
- `deal.updated`
- `task.completed`

Successful new event response:

```json
{
  "accepted": true,
  "duplicate": false,
  "idempotencyKey": "sha256",
  "jobId": "sha256"
}
```

Duplicate response:

```json
{
  "accepted": false,
  "duplicate": true,
  "idempotencyKey": "sha256",
  "jobId": "sha256"
}
```

## `GET /jobs/:jobId`

Returns safe job status metadata.

```json
{
  "jobId": "sha256",
  "name": "sync-crm-event",
  "state": "waiting",
  "attemptsMade": 0,
  "timestamp": 1785234600000
}
```
