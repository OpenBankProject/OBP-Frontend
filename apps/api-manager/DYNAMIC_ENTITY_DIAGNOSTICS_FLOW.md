# Dynamic Entity Diagnostics Flow

This document describes how the Dynamic Entity Diagnostics page processes data.

```
┌─────────────────────────────────────────────────────────────────────┐
│                  DYNAMIC ENTITY DIAGNOSTICS FLOW                     │
└─────────────────────────────────────────────────────────────────────┘

STEP 1: Fetch Entity Definitions
─────────────────────────────────
  API ENDPOINT:
  GET /obp/v5.1.0/management/system-dynamic-entities
  
  Response:
  {
    "dynamic_entities": [
      {
        "dynamicEntityId": "abc-123",
        "userId": "user-1",
        "ACME2Parcel": {
          "description": "...",
          "type": "object",
          "properties": {...}
        }
      },
      { ... more entities ... }
    ]
  }
  
  Extract:
  → Entity Name: "ACME2Parcel"
  → Entity ID: "abc-123"
  → Schema: {...properties...}


STEP 2: For EACH Entity, Fetch Data Records
────────────────────────────────────────────
  API ENDPOINT:
  GET /obp/dynamic-entity/{entityName}
  
  Example:
  GET /obp/dynamic-entity/ACME2Parcel
  
  Response (Raw):
  {
    "acme2_parcel_list": [
      { "acme2_parcel_id": "1", ... },
      { "acme2_parcel_id": "2", ... }
    ]
  }
  
  Process:
  1. Store rawResponse = { "acme2_parcel_list": [...] }
  2. Get responseKeys = ["acme2_parcel_list"]
  3. Find keys ending with "_list" → ["acme2_parcel_list"]
  4. Check if it's an array → YES
  5. Count records → 2


STEP 3: Create Diagnostic Object
─────────────────────────────────
  (No API call - just processing)
  
  {
    "dynamicEntityId": "abc-123",
    "entityName": "ACME2Parcel",
    "recordCount": 2,              ← Successfully counted!
    "error": undefined,            ← No error
    "schema": {...},
    "responseKeys": ["acme2_parcel_list"],
    "triedKeys": ["acme2_parcel_list"],
    "rawResponse": {...}           ← Full API response saved
  }


STEP 4: Display in UI
─────────────────────
  (No API call - just rendering)
  
  ┌─────────────────────────────────────────┐
  │ ACME2Parcel              [Has Data]     │
  │ ID: abc-123                             │
  │                                         │
  │ Record Count: 2                         │
  │ Schema Properties: 4                    │
  │                                         │
  │ [View CRUD] [View Definition]           │
  │                                         │
  │ ▶ Show Raw API Response                 │
  │   (Click to expand full JSON)           │
  └─────────────────────────────────────────┘


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY OF API ENDPOINTS USED:
───────────────────────────────
1. GET /obp/v5.1.0/management/system-dynamic-entities
   → Fetches list of all entity definitions (called ONCE)

2. GET /obp/dynamic-entity/{entityName}
   → Fetches data records for specific entity (called ONCE per entity)
   → Examples:
     - GET /obp/dynamic-entity/ACME2Parcel
     - GET /obp/dynamic-entity/ACME2Project
     - GET /obp/dynamic-entity/Person
```

## Total API Calls

If you have 10 entities, the diagnostics page makes:
- **1 API call** to get all entity definitions
- **10 API calls** to get data for each entity
- **Total: 11 API calls**
