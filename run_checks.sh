echo "--- Check 1: Valid JSON ---"
node -e "JSON.parse(require('fs').readFileSync('org.config.json','utf8'))" && echo "PASS" || echo "FAIL"

echo "--- Check 2: setup.sh syntax ---"
bash -n setup.sh && echo "PASS" || echo "FAIL"

echo "--- Check 3: setup/init-company.sh syntax ---"
bash -n setup/init-company.sh && echo "PASS" || echo "FAIL"

echo "--- Check 4: adapter compilation ---"
if [ -f "adapter/node_modules/.bin/tsc" ]; then
  ./adapter/node_modules/.bin/tsc --noEmit -p adapter/tsconfig.json && echo "PASS" || echo "FAIL"
else
  echo "SKIP (tsc not found in adapter/node_modules/.bin/)"
fi

echo "--- Check 5: Simulate org-profile generation ---"
python3 - << 'PYEOF' > profile_output.txt 2>/dev/null
import json
try:
    with open('org.config.json') as f:
        cfg = json.load(f)
    org = cfg['org']
    inc = cfg['programs']['incubator']
    acc = cfg['programs']['accelerator']
    cul = cfg['culture']
    lines = [
        "# Organization Profile",
        "",
        "> Auto-generated test",
        "",
        "## Who We Are",
        "**Name:** " + org['name'],
        "**Mission:** " + org['mission'],
        "## Routing Reference",
        "- Score 0-" + str(inc['score_range'][0] - 1) + ": Decline",
        "- Score " + str(inc['score_range'][0]) + "-" + str(inc['score_range'][1]) + ": Incubator -- contact " + inc['director_name'],
        "- Score " + str(acc['score_range'][0]) + "-" + str(acc['score_range'][1]) + ": Accelerator -- contact " + acc['director_name'],
    ]
    print("\n".join(lines))
except Exception as e:
    print(f"ERROR: {e}")
PYEOF
if [ -s profile_output.txt ] && ! grep -q "ERROR:" profile_output.txt; then
  cat profile_output.txt
  echo "PASS"
else
  cat profile_output.txt
  echo "FAIL"
fi

echo "--- Check 6: Hardcoded names removed ---"
MATCHES=$(grep -rnE "Br\. Fahad|Sr\. Darain" instructions/)
if [ -z "$MATCHES" ]; then
  echo "PASS"
else
  echo "FAIL: Found matches:"
  echo "$MATCHES"
fi

echo "--- Check 7: org-profile injection line ---"
grep -n "org-profile" adapter/src/index.ts && echo "PASS" || echo "FAIL"
