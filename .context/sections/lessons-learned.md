# Lessons Learned

## Current Durable Lessons
- No durable lessons recorded yet

## Session-Derived Lessons
- When an LLM tool schema has required numeric fields, mirror those fields explicitly in the corresponding instructions to avoid hallucinated defaults or validation failures.
- The request_hire tool schema requires budgetMonthlyCents: The request_hire tool schema requires budgetMonthlyCents.
- The request_hire tool schema requires budgetMonthlyCents.
- The Executive Director Phase 1 hiring section originally omitted budgets for all director hires.
- The Executive Director instructions now include an explicit 0-cent monthly budget for each Phase 1 director hire.
- Decision pressure: Keep budget guidance in the instructions file so the model has deterministic values for required tool arguments.
- Decision pressure: The request_hire tool schema requires budgetMonthlyCents
- Recent execution pattern: Read adapter/src/tools.ts to confirm request_hire requires budgetMonthlyCents.
- Recent execution pattern: Edited instructions/executive-director.md to add six explicit Phase 1 budget lines.
- Recent execution pattern: Validated the updated Executive Director file contains six budget entries.
