#!/bin/bash
# setup/init-company.sh — Creates Company + Executive Director in Paperclip
# Called by setup.sh. Requires PAPERCLIP_API_URL and PAPERCLIP_API_KEY in environment.

set -e

PAPERCLIP_URL=${PAPERCLIP_API_URL:-http://localhost:3100}

ORG_NAME=$(python3 -c "import json; d=json.load(open('org.config.json')); print(d['org']['name'])")
ORG_MISSION=$(python3 -c "import json; d=json.load(open('org.config.json')); print(d['org']['mission'])")
ORG_TAGLINE=$(python3 -c "import json; d=json.load(open('org.config.json')); print(d['org']['tagline'])")

echo "  Creating company: $ORG_NAME..."
COMPANY=$(curl -sf -X POST "$PAPERCLIP_URL/api/companies" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$ORG_NAME\",
    \"description\": \"$ORG_TAGLINE\",
    \"goal\": \"$ORG_MISSION\"
  }")
COMPANY_ID=$(echo "$COMPANY" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "  Company: $COMPANY_ID"

echo "  Creating Executive Director..."
CEO=$(curl -sf -X POST "$PAPERCLIP_URL/api/companies/$COMPANY_ID/agents" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Executive Director\",
    \"role\": \"ceo\",
    \"title\": \"Executive Director\",
    \"capabilities\": \"Strategic leadership of a nonprofit incubator and accelerator. Builds the org through sequential director hires approved by the Board.\",
    \"adapterType\": \"local_llm\",
    \"adapterConfig\": {
      \"instructionsFilePath\": \"executive-director.md\",
      \"initialDelaySeconds\": $(( RANDOM % 300 ))
    },
    \"runtimeConfig\": {
      \"schedule\": { \"enabled\": true, \"intervalSec\": 86400, \"maxConcurrentRuns\": 1 },
      \"contextMode\": \"fat\"
    },
    \"budgetMonthlyCents\": 0
  }")
CEO_ID=$(echo "$CEO" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "  Executive Director: $CEO_ID"

# Save IDs for reference
echo "COMPANY_ID=$COMPANY_ID" > .ids
echo "CEO_ID=$CEO_ID" >> .ids
echo "  IDs saved to .ids"
